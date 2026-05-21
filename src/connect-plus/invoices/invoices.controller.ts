import {
	Controller,
	Get,
	Post,
	Patch,
	Param,
	Query,
	Body,
	UseGuards,
	Req,
	Res,
	Header,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { CpInvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { MarkInvoicePaidDto } from './dto/mark-paid.dto';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/workspaces/:wsId/invoices')
export class CpInvoicesController {
	constructor(private readonly service: CpInvoicesService) {}

	@Post()
	@CpRoles(CpRole.STAFF, CpRole.WORKSPACE_ADMIN)
	@ApiOperation({ summary: 'Create invoice' })
	create(
		@CpContext() ctx: CpRequestContext,
		@Body() dto: CreateInvoiceDto,
		@Req() req: Request,
	) {
		return this.service.create(ctx, dto, req);
	}

	@Get()
	@CpRoles(CpRole.WORKSPACE_ADMIN)
	@ApiOperation({ summary: 'List all invoices' })
	listAll(@CpContext() ctx: CpRequestContext, @Query() query: ListInvoicesQueryDto) {
		return this.service.listAll(ctx, query);
	}

	@Get('assigned')
	@CpRoles(CpRole.STAFF)
	@ApiOperation({ summary: 'List invoices for my assigned clients' })
	listAssigned(@CpContext() ctx: CpRequestContext, @Query() query: ListInvoicesQueryDto) {
		return this.service.listAssigned(ctx, query);
	}

	@Get('me')
	@CpRoles(CpRole.CLIENT)
	@ApiOperation({ summary: 'List my invoices' })
	listMine(@CpContext() ctx: CpRequestContext, @Query() query: ListInvoicesQueryDto) {
		return this.service.listMine(ctx, query);
	}

	@Get('export')
	@CpRoles(CpRole.WORKSPACE_ADMIN)
	@Header('Content-Type', 'text/csv; charset=utf-8')
	@ApiOperation({ summary: 'Export invoices as CSV' })
	exportCsv(@CpContext() ctx: CpRequestContext) {
		return this.service.exportCsv(ctx);
	}

	@Get(':invoiceId/download')
	@CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CLIENT)
	@ApiOperation({ summary: 'Download invoice PDF' })
	async download(
		@CpContext() ctx: CpRequestContext,
		@Param('invoiceId') invoiceId: string,
		@Res() res: Response,
	) {
		return this.service.downloadPdf(ctx, invoiceId, res);
	}

	@Patch(':invoiceId/send')
	@CpRoles(CpRole.STAFF, CpRole.WORKSPACE_ADMIN)
	@ApiOperation({ summary: 'Send invoice to client' })
	send(
		@CpContext() ctx: CpRequestContext,
		@Param('invoiceId') invoiceId: string,
		@Req() req: Request,
	) {
		return this.service.send(ctx, invoiceId, req);
	}

	@Patch(':invoiceId/mark-paid')
	@CpRoles(CpRole.WORKSPACE_ADMIN)
	@ApiOperation({ summary: 'Mark invoice as paid' })
	markPaid(
		@CpContext() ctx: CpRequestContext,
		@Param('invoiceId') invoiceId: string,
		@Body() dto: MarkInvoicePaidDto,
		@Req() req: Request,
	) {
		return this.service.markPaid(ctx, invoiceId, dto, req);
	}

	@Patch(':invoiceId/cancel')
	@CpRoles(CpRole.WORKSPACE_ADMIN)
	@ApiOperation({ summary: 'Cancel invoice' })
	cancel(
		@CpContext() ctx: CpRequestContext,
		@Param('invoiceId') invoiceId: string,
		@Req() req: Request,
	) {
		return this.service.cancel(ctx, invoiceId, req);
	}

	@Patch(':invoiceId')
	@CpRoles(CpRole.STAFF, CpRole.WORKSPACE_ADMIN)
	@ApiOperation({ summary: 'Update invoice draft' })
	update(
		@CpContext() ctx: CpRequestContext,
		@Param('invoiceId') invoiceId: string,
		@Body() dto: UpdateInvoiceDto,
		@Req() req: Request,
	) {
		return this.service.update(ctx, invoiceId, dto, req);
	}

	@Get(':invoiceId')
	@CpRoles(CpRole.STAFF, CpRole.WORKSPACE_ADMIN, CpRole.CLIENT)
	@ApiOperation({ summary: 'Get invoice detail' })
	findById(@CpContext() ctx: CpRequestContext, @Param('invoiceId') invoiceId: string) {
		return this.service.findById(ctx, invoiceId);
	}
}
