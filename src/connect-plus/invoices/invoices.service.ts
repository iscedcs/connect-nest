import {
	Injectable,
	ForbiddenException,
	NotFoundException,
	BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { createWriteStream } from 'fs';
import { mkdir, readFile, stat } from 'fs/promises';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { DatabaseService } from '../../database/database.service';
import { Prisma, CpInvoiceStatus, CpNotificationType, CpRole } from '../../generated/prisma/client';
import { CpRequestContext } from '../types/cp-request.types';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { MarkInvoicePaidDto } from './dto/mark-paid.dto';
import { paginateResult } from '../utils/paginate';

const invoiceInclude = {
	client: { include: { member: true } },
	createdByStaff: { include: { member: true } },
	items: { orderBy: { order: 'asc' } },
	workspace: { include: { companyProfile: true } },
} as const;

type InvoiceWithRelations = Prisma.CpInvoiceGetPayload<{ include: typeof invoiceInclude }>;

@Injectable()
export class CpInvoicesService {
	constructor(
		private readonly db: DatabaseService,
		private readonly auditLog: CpAuditLogService,
		private readonly notifications: CpNotificationsService,
	) {}

	private toDecimal(value: string | number | Prisma.Decimal | null | undefined): Prisma.Decimal {
		if (value === null || value === undefined) return new Prisma.Decimal(0);
		return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
	}

	private roundMoney(value: Prisma.Decimal): Prisma.Decimal {
		return new Prisma.Decimal(value.toFixed(4));
	}

	private async requireWorkspaceContext(ctx: CpRequestContext): Promise<string> {
		if (!ctx.workspaceId) throw new ForbiddenException('Workspace context required');
		return ctx.workspaceId;
	}

	private async resolveStaffProfile(ctx: CpRequestContext) {
		if (!ctx.memberId) return null;
		return this.db.cpStaffProfile.findFirst({
			where: { workspaceId: ctx.workspaceId ?? undefined, memberId: ctx.memberId, deletedAt: null },
			include: { member: true },
		});
	}

	private async resolveClientByContext(ctx: CpRequestContext) {
		if (!ctx.workspaceId) throw new ForbiddenException('Workspace context required');
		const client = await this.db.cpClient.findFirst({
			where: { workspaceId: ctx.workspaceId, member: { authUserId: ctx.authUserId }, deletedAt: null },
			include: { member: true, assignedStaff: { include: { member: true } } },
		});
		if (!client) throw new NotFoundException('Client profile not found');
		return client;
	}

	private async getCompanyProfile(workspaceId: string) {
		return this.db.cpCompanyProfile.findUnique({ where: { workspaceId } });
	}

	private getInvoiceDefaults(profile: Awaited<ReturnType<typeof this.getCompanyProfile>>) {
		return (profile?.invoiceDefaults as
			| { taxRate?: number | string; currency?: string; paymentTermsDays?: number }
			| null
			| undefined) ?? null;
	}

	private normalizeDate(value?: string): Date | null {
		if (!value) return null;
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid date');
		return parsed;
	}

	private async generateInvoiceNumber(): Promise<string> {
		const prefix = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
		for (let attempt = 0; attempt < 10; attempt += 1) {
			const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
			const candidate = `${prefix}-${suffix}`;
			const existing = await this.db.cpInvoice.findUnique({ where: { invoiceNumber: candidate } });
			if (!existing) return candidate;
		}
		throw new BadRequestException('Unable to generate invoice number');
	}

	private async ensureClientCanUseStaffWorkspace(
		ctx: CpRequestContext,
		clientId: string,
	) {
		const client = await this.db.cpClient.findFirst({
			where: { id: clientId, workspaceId: ctx.workspaceId ?? undefined, deletedAt: null },
			include: { assignedStaff: true, member: true },
		});
		if (!client) throw new NotFoundException('Client not found');

		if (ctx.role === CpRole.STAFF) {
			const staffProfile = await this.resolveStaffProfile(ctx);
			if (!staffProfile) throw new ForbiddenException('Staff profile not found');
			if (client.assignedStaffId !== staffProfile.id) {
				throw new ForbiddenException('Client is not assigned to you');
			}
			return { client, staffProfile };
		}

		return { client, staffProfile: await this.resolveStaffProfile(ctx) };
	}

	private calculateLineItems(items: Array<{ description: string; quantity: string; unitPrice: string }>) {
		return items.map((item, index) => {
			const quantity = this.toDecimal(item.quantity);
			const unitPrice = this.toDecimal(item.unitPrice);
			const total = this.roundMoney(quantity.mul(unitPrice));
			return {
				description: item.description,
				quantity,
				unitPrice,
				total,
				order: index,
			};
		});
	}

	private calculateTotals(
		items: Array<{ description: string; quantity: string; unitPrice: string }>,
		taxAmountInput?: string,
		discountAmountInput?: string,
		taxRate?: number | string,
	) {
		const lineItems = this.calculateLineItems(items);
		const subtotal = lineItems.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0));
		const taxAmount = taxAmountInput !== undefined
			? this.toDecimal(taxAmountInput)
			: taxRate !== undefined && taxRate !== null
				? this.roundMoney(subtotal.mul(this.toDecimal(taxRate)).div(100))
				: new Prisma.Decimal(0);
		const discountAmount = discountAmountInput !== undefined
			? this.toDecimal(discountAmountInput)
			: new Prisma.Decimal(0);
		const totalAmount = this.roundMoney(subtotal.add(taxAmount).minus(discountAmount));
		return { lineItems, subtotal, taxAmount, discountAmount, totalAmount };
	}

	private async writeInvoicePdf(invoice: InvoiceWithRelations): Promise<string> {
		const outputDir = path.resolve(process.cwd(), 'storage', 'cp-invoices');
		await mkdir(outputDir, { recursive: true });
		const filePath = path.join(outputDir, `${invoice.invoiceNumber}.pdf`);

		const doc = new PDFDocument({ margin: 48, size: 'A4' });
		const stream = createWriteStream(filePath);
		const completed = new Promise<void>((resolve, reject) => {
			stream.on('finish', resolve);
			stream.on('error', reject);
		});

		doc.pipe(stream);
		doc.fontSize(20).text('Invoice', { align: 'center' });
		doc.moveDown();
		doc.fontSize(11).text(`Invoice Number: ${invoice.invoiceNumber}`);
		doc.text(`Workspace: ${invoice.workspace.name}`);
		doc.text(`Client: ${invoice.client.name}`);
		doc.text(`Status: ${invoice.status}`);
		if (invoice.dueDate) doc.text(`Due Date: ${invoice.dueDate.toISOString().slice(0, 10)}`);
		doc.moveDown();
		doc.fontSize(13).text('Line Items');
		doc.moveDown(0.5);
		invoice.items.forEach((item) => {
			doc.fontSize(10).text(`${item.description}  x${item.quantity.toString()}  @ ${item.unitPrice.toString()}  = ${item.total.toString()}`);
		});
		doc.moveDown();
		doc.fontSize(11).text(`Tax: ${invoice.taxAmount?.toString() ?? '0.0000'}`);
		doc.text(`Discount: ${invoice.discountAmount?.toString() ?? '0.0000'}`);
		doc.fontSize(13).text(`Total: ${invoice.totalAmount.toString()}`);
		doc.end();

		await completed;
		return filePath;
	}

	private async loadInvoiceForAccess(invoiceId: string) {
		const invoice = await this.db.cpInvoice.findFirst({
			where: { id: invoiceId, deletedAt: null },
			include: invoiceInclude,
		});
		if (!invoice) throw new NotFoundException('Invoice not found');
		return invoice;
	}

	private async assertCanAccessInvoice(ctx: CpRequestContext, invoice: InvoiceWithRelations) {
		if (ctx.role === CpRole.WORKSPACE_ADMIN) {
			if (invoice.workspaceId !== ctx.workspaceId) throw new ForbiddenException('Invoice is outside this workspace');
			return;
		}

		if (ctx.role === CpRole.STAFF) {
			const staffProfile = await this.resolveStaffProfile(ctx);
			if (!staffProfile) throw new ForbiddenException('Staff profile not found');
			const isOwnClient = invoice.client.assignedStaffId === staffProfile.id;
			const isCreatedByMe = invoice.createdByStaffId === staffProfile.id;
			if (!isOwnClient && !isCreatedByMe) throw new ForbiddenException('Invoice is not assigned to you');
			return;
		}

		if (ctx.role === CpRole.CLIENT) {
			const client = await this.resolveClientByContext(ctx);
			if (invoice.clientId !== client.id) throw new ForbiddenException('Invoice is not yours');
			return;
		}

		throw new ForbiddenException('Access denied');
	}

	private async assertCanCreateForClient(ctx: CpRequestContext, clientId: string) {
		if (ctx.role !== CpRole.STAFF && ctx.role !== CpRole.WORKSPACE_ADMIN) {
			throw new ForbiddenException('Only staff and admins can create invoices');
		}
		return this.ensureClientCanUseStaffWorkspace(ctx, clientId);
	}

	async create(ctx: CpRequestContext, dto: CreateInvoiceDto, req: Request) {
		const workspaceId = await this.requireWorkspaceContext(ctx);
		const { client, staffProfile } = await this.assertCanCreateForClient(ctx, dto.clientId);
		const companyProfile = await this.getCompanyProfile(workspaceId);
		const defaults = this.getInvoiceDefaults(companyProfile);
		const totals = this.calculateTotals(dto.items, dto.taxAmount, dto.discountAmount, defaults?.taxRate);
		const invoiceNumber = await this.generateInvoiceNumber();
		const dueDate = this.normalizeDate(dto.dueDate) ?? (
			defaults?.paymentTermsDays ? new Date(Date.now() + defaults.paymentTermsDays * 24 * 60 * 60 * 1000) : null
		);

		const invoice = await this.db.$transaction(async (tx) => {
			return tx.cpInvoice.create({
				data: {
					workspaceId,
					clientId: client.id,
					createdByStaffId: staffProfile?.id ?? null,
					invoiceNumber,
					status: CpInvoiceStatus.DRAFT,
					dueDate,
					notes: dto.notes ?? null,
					totalAmount: totals.totalAmount,
					taxAmount: totals.taxAmount,
					discountAmount: totals.discountAmount,
					currency: dto.currency ?? defaults?.currency ?? 'NGN',
					items: {
						create: totals.lineItems.map((item) => ({
							description: item.description,
							quantity: item.quantity,
							unitPrice: item.unitPrice,
							total: item.total,
							order: item.order,
						})),
					},
				},
				include: invoiceInclude,
			});
		});

		this.auditLog.write({
			ctx,
			req,
			workspaceId,
			eventType: 'INVOICE_CREATED',
			targetEntity: 'CpInvoice',
			targetEntityId: invoice.id,
			action: 'CREATE',
			after: invoice,
		});

		return invoice;
	}

	async listAll(ctx: CpRequestContext, query: ListInvoicesQueryDto) {
		const workspaceId = await this.requireWorkspaceContext(ctx);
		const page = query.page ?? 1;
		const limit = query.limit ?? 20;
		const where = {
			workspaceId,
			deletedAt: null,
			...(query.status ? { status: query.status } : {}),
		};

		const [data, total] = await this.db.$transaction([
			this.db.cpInvoice.findMany({ where, include: invoiceInclude, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
			this.db.cpInvoice.count({ where }),
		]);

		return paginateResult(data, total, page, limit);
	}

	async listAssigned(ctx: CpRequestContext, query: ListInvoicesQueryDto) {
		const workspaceId = await this.requireWorkspaceContext(ctx);
		const staffProfile = await this.resolveStaffProfile(ctx);
		if (!staffProfile) throw new NotFoundException('Staff profile not found');

		const page = query.page ?? 1;
		const limit = query.limit ?? 20;
		const where = {
			workspaceId,
			deletedAt: null,
			client: { assignedStaffId: staffProfile.id },
			...(query.status ? { status: query.status } : {}),
		};

		const [data, total] = await this.db.$transaction([
			this.db.cpInvoice.findMany({ where, include: invoiceInclude, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
			this.db.cpInvoice.count({ where }),
		]);

		return paginateResult(data, total, page, limit);
	}

	async listMine(ctx: CpRequestContext, query: ListInvoicesQueryDto) {
		const client = await this.resolveClientByContext(ctx);
		const page = query.page ?? 1;
		const limit = query.limit ?? 20;
		const where = {
			clientId: client.id,
			deletedAt: null,
			...(query.status ? { status: query.status } : {}),
		};

		const [data, total] = await this.db.$transaction([
			this.db.cpInvoice.findMany({ where, include: invoiceInclude, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
			this.db.cpInvoice.count({ where }),
		]);

		return paginateResult(data, total, page, limit);
	}

	async findById(ctx: CpRequestContext, invoiceId: string) {
		const invoice = await this.loadInvoiceForAccess(invoiceId);
		await this.assertCanAccessInvoice(ctx, invoice);
		return invoice;
	}

	async update(ctx: CpRequestContext, invoiceId: string, dto: UpdateInvoiceDto, req: Request) {
		const invoice = await this.loadInvoiceForAccess(invoiceId);
		await this.assertCanAccessInvoice(ctx, invoice);
		if (invoice.status !== CpInvoiceStatus.DRAFT) {
			throw new ForbiddenException('Only draft invoices can be updated');
		}

		const staffProfile = await this.resolveStaffProfile(ctx);
		const companyProfile = await this.getCompanyProfile(invoice.workspaceId);
		const defaults = this.getInvoiceDefaults(companyProfile);
		const items = dto.items ?? invoice.items.map((item) => ({ description: item.description, quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString() }));
		const totals = this.calculateTotals(items, dto.taxAmount ?? invoice.taxAmount?.toString(), dto.discountAmount ?? invoice.discountAmount?.toString(), defaults?.taxRate);
		const dueDate = dto.dueDate ? this.normalizeDate(dto.dueDate) : invoice.dueDate;

		const updated = await this.db.$transaction(async (tx) => {
			await tx.cpInvoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
			return tx.cpInvoice.update({
				where: { id: invoice.id },
				data: {
					dueDate,
					notes: dto.notes ?? invoice.notes,
					currency: dto.currency ?? invoice.currency,
					totalAmount: totals.totalAmount,
					taxAmount: totals.taxAmount,
					discountAmount: totals.discountAmount,
					createdByStaffId: invoice.createdByStaffId ?? staffProfile?.id ?? null,
					items: {
						create: totals.lineItems.map((item) => ({
							description: item.description,
							quantity: item.quantity,
							unitPrice: item.unitPrice,
							total: item.total,
							order: item.order,
						})),
					},
				},
				include: invoiceInclude,
			});
		});

		this.auditLog.write({
			ctx,
			req,
			workspaceId: invoice.workspaceId,
			eventType: 'INVOICE_UPDATED',
			targetEntity: 'CpInvoice',
			targetEntityId: invoice.id,
			action: 'UPDATE',
			before: invoice,
			after: updated,
		});

		return updated;
	}

	async send(ctx: CpRequestContext, invoiceId: string, req: Request) {
		const invoice = await this.loadInvoiceForAccess(invoiceId);
		await this.assertCanAccessInvoice(ctx, invoice);
		if (invoice.status !== CpInvoiceStatus.DRAFT) {
			throw new ForbiddenException('Only draft invoices can be sent');
		}

		const pdfPath = await this.writeInvoicePdf(invoice);
		const updated = await this.db.cpInvoice.update({
			where: { id: invoice.id },
			data: {
				status: CpInvoiceStatus.SENT,
				sentAt: new Date(),
				pdfUrl: pdfPath,
			},
			include: invoiceInclude,
		});

		this.auditLog.write({
			ctx,
			req,
			workspaceId: invoice.workspaceId,
			eventType: 'INVOICE_SENT',
			targetEntity: 'CpInvoice',
			targetEntityId: invoice.id,
			action: 'SEND',
			before: invoice,
			after: updated,
		});

		if (updated.client.member?.authUserId) {
			this.notifications.send({
				recipientAuthId: updated.client.member.authUserId,
				type: CpNotificationType.INVOICE_ISSUED,
				title: `Invoice ${updated.invoiceNumber} sent`,
				message: `Your invoice ${updated.invoiceNumber} is ready.`,
				workspaceId: updated.workspaceId,
				metadata: { invoiceId: updated.id, invoiceNumber: updated.invoiceNumber } as unknown as Prisma.InputJsonValue,
			});
		}

		return updated;
	}

	async markPaid(ctx: CpRequestContext, invoiceId: string, dto: MarkInvoicePaidDto, req: Request) {
		const invoice = await this.loadInvoiceForAccess(invoiceId);
		if (ctx.role !== CpRole.WORKSPACE_ADMIN) throw new ForbiddenException('Admin access required');
		if (invoice.status === CpInvoiceStatus.PAID) throw new ForbiddenException('Invoice is already paid');

		const updated = await this.db.cpInvoice.update({
			where: { id: invoice.id },
			data: {
				status: CpInvoiceStatus.PAID,
				paidAt: new Date(),
				paidVia: dto.paidVia ?? null,
				externalRef: dto.externalRef ?? null,
			},
			include: invoiceInclude,
		});

		this.auditLog.write({
			ctx,
			req,
			workspaceId: invoice.workspaceId,
			eventType: 'INVOICE_PAID',
			targetEntity: 'CpInvoice',
			targetEntityId: invoice.id,
			action: 'UPDATE',
			before: invoice,
			after: updated,
		});

		if (updated.client.member?.authUserId) {
			this.notifications.send({
				recipientAuthId: updated.client.member.authUserId,
				type: CpNotificationType.INVOICE_PAID,
				title: `Invoice ${updated.invoiceNumber} paid`,
				message: `We received payment for invoice ${updated.invoiceNumber}.`,
				workspaceId: updated.workspaceId,
			});
		}

		return updated;
	}

	async cancel(ctx: CpRequestContext, invoiceId: string, req: Request) {
		const invoice = await this.loadInvoiceForAccess(invoiceId);
		if (ctx.role !== CpRole.WORKSPACE_ADMIN) throw new ForbiddenException('Admin access required');
		if (invoice.status === CpInvoiceStatus.PAID) throw new ForbiddenException('Paid invoices cannot be cancelled');

		const updated = await this.db.cpInvoice.update({
			where: { id: invoice.id },
			data: { status: CpInvoiceStatus.CANCELLED },
			include: invoiceInclude,
		});

		this.auditLog.write({
			ctx,
			req,
			workspaceId: invoice.workspaceId,
			eventType: 'INVOICE_CANCELLED',
			targetEntity: 'CpInvoice',
			targetEntityId: invoice.id,
			action: 'UPDATE',
			before: invoice,
			after: updated,
		});

		if (updated.client.member?.authUserId) {
			this.notifications.send({
				recipientAuthId: updated.client.member.authUserId,
				type: CpNotificationType.INVOICE_CANCELLED,
				title: `Invoice ${updated.invoiceNumber} cancelled`,
				message: `Invoice ${updated.invoiceNumber} has been cancelled.`,
				workspaceId: updated.workspaceId,
			});
		}

		return updated;
	}

	async downloadPdf(ctx: CpRequestContext, invoiceId: string, res: Response) {
		const invoice = await this.loadInvoiceForAccess(invoiceId);
		if (ctx.role === CpRole.CLIENT) {
			const client = await this.resolveClientByContext(ctx);
			if (invoice.clientId !== client.id) throw new ForbiddenException('Invoice is not yours');
		} else if (ctx.role !== CpRole.WORKSPACE_ADMIN) {
			throw new ForbiddenException('Access denied');
		}

		if (!invoice.pdfUrl) {
			throw new NotFoundException('Invoice PDF has not been generated yet');
		}

		if (/^https?:\/\//i.test(invoice.pdfUrl)) {
			return res.redirect(invoice.pdfUrl);
		}

		try {
			const fileExists = await stat(invoice.pdfUrl);
			if (!fileExists.isFile()) throw new Error('Missing file');
			return res.download(invoice.pdfUrl, `${invoice.invoiceNumber}.pdf`);
		} catch {
			throw new NotFoundException('Invoice PDF file not found');
		}
	}

	async exportCsv(ctx: CpRequestContext) {
		const workspaceId = await this.requireWorkspaceContext(ctx);
		const invoices = await this.db.cpInvoice.findMany({
			where: { workspaceId, deletedAt: null },
			include: {
				client: true,
				createdByStaff: true,
			},
			orderBy: { createdAt: 'desc' },
		});

		const headers = [
			'invoiceNumber',
			'status',
			'clientName',
			'clientEmail',
			'currency',
			'totalAmount',
			'taxAmount',
			'discountAmount',
			'dueDate',
			'sentAt',
			'paidAt',
		];

		const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
		const rows = invoices.map((invoice) => [
			invoice.invoiceNumber,
			invoice.status,
			invoice.client.name,
			invoice.client.email ?? '',
			invoice.currency,
			invoice.totalAmount.toString(),
			invoice.taxAmount?.toString() ?? '',
			invoice.discountAmount?.toString() ?? '',
			invoice.dueDate?.toISOString() ?? '',
			invoice.sentAt?.toISOString() ?? '',
			invoice.paidAt?.toISOString() ?? '',
		]);

		return [headers.join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n');
	}
}
