import { HttpException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateFormDto, UpdateFormDto, CreateFormFromTemplateDto, CreateTemplateDto, BulkVisibilityDto, BulkDeleteDto, BulkRestoreDto, FormStatus, SubmitFormDto } from './dto/form.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PlanLimitException } from '../subscriptions/exceptions/plan-limit.exception';
import { PlanTier } from '../generated/prisma/client';

@Injectable()
export class FormsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async createForm(user: any, profileId: string, dto: CreateFormDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      // Enforce custom forms limit (aggregate across all user profiles)
      const limits = await this.subscriptionsService.getUserLimits(user.id);
      const currentCount = await this.databaseService.form.count({
        where: { profile: { userId: user.id }, deletedAt: null },
      });
      if (currentCount >= limits.customForms) {
        throw new PlanLimitException('customForms', PlanTier.PRO_LITE);
      }

      const form = await this.databaseService.form.create({
        data: { profileId, title: dto.title, description: dto.description, form_type: dto.form_type, template_id: dto.template_id, status: dto.status as any, fields: dto.fields as any, form_url: dto.form_url, is_visible: dto.is_visible !== undefined ? dto.is_visible : true },
      });
      return { success: true, message: 'Form created successfully', data: { form } };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return { success: false, message: error.message };
    }
  }

  async getAllForms(user: any, profileId: string, page: number = 1, perPage: number = 25, includeDeleted: boolean = false, sort?: string, order: 'asc' | 'desc' = 'asc') {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const skip = (page - 1) * perPage;
      const where: any = { profileId };
      if (!includeDeleted) where.deletedAt = null;
      const orderBy: any = sort ? { [sort]: order } : { createdAt: order };

      const [forms, total] = await Promise.all([
        this.databaseService.form.findMany({ where, skip, take: perPage, orderBy: [orderBy] }),
        this.databaseService.form.count({ where }),
      ]);

      return { success: true, message: 'Forms retrieved successfully', data: { forms, pagination: { page, per_page: perPage, total, pages: Math.ceil(total / perPage) } } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getFormById(user: any, profileId: string, formId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const form = await this.databaseService.form.findFirst({ where: { id: formId, profileId, deletedAt: null } });
      if (!form) return { success: false, message: 'Form not found' };

      return { success: true, message: 'Form retrieved successfully', data: { form } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getPublicFormById(formId: string) {
    try {
      const form = await this.databaseService.form.findFirst({ where: { id: formId, deletedAt: null } });
      if (!form) return { success: false, message: 'Form not found' };

      return { success: true, message: 'Form retrieved successfully', data: { form } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async updateForm(user: any, profileId: string, formId: string, dto: UpdateFormDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const form = await this.databaseService.form.findFirst({ where: { id: formId, profileId, deletedAt: null } });
      if (!form) return { success: false, message: 'Form not found' };

      const updateData: any = {};
      if (dto.title !== undefined) updateData.title = dto.title;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.status !== undefined) updateData.status = dto.status as any;
      if (dto.form_url !== undefined) updateData.form_url = dto.form_url;
      if (dto.is_visible !== undefined) updateData.is_visible = dto.is_visible;
      if (dto.fields !== undefined) updateData.fields = dto.fields as any;

      const updatedForm = await this.databaseService.form.update({ where: { id: formId }, data: updateData });
      return { success: true, message: 'Form updated successfully', data: { form: updatedForm } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async deleteForm(user: any, profileId: string, formId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const form = await this.databaseService.form.findFirst({ where: { id: formId, profileId, deletedAt: null } });
      if (!form) return { success: false, message: 'Form not found' };

      await this.databaseService.form.update({ where: { id: formId }, data: { deletedAt: new Date() } });
      return { success: true, message: 'Form deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async restoreForm(user: any, profileId: string, formId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const form = await this.databaseService.form.findFirst({ where: { id: formId, profileId } });
      if (!form) return { success: false, message: 'Form not found' };

      const restoredForm = await this.databaseService.form.update({ where: { id: formId }, data: { deletedAt: null } });
      return { success: true, message: 'Form restored successfully', data: { form: restoredForm } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async toggleVisibility(user: any, profileId: string, formId: string, isVisible: boolean) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const form = await this.databaseService.form.findFirst({ where: { id: formId, profileId, deletedAt: null } });
      if (!form) return { success: false, message: 'Form not found' };

      const updatedForm = await this.databaseService.form.update({ where: { id: formId }, data: { is_visible: isVisible } });
      return { success: true, message: 'Form visibility updated successfully', data: { form: updatedForm } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getFormSubmissions(user: any, profileId: string, formId: string, page: number = 1, perPage: number = 25, from?: string, to?: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const form = await this.databaseService.form.findFirst({ where: { id: formId, profileId, deletedAt: null } });
      if (!form) return { success: false, message: 'Form not found' };

      const skip = (page - 1) * perPage;
      const where: any = { formId, deletedAt: null };
      if (from || to) {
        where.submitted_at = {};
        if (from) where.submitted_at.gte = new Date(from);
        if (to) where.submitted_at.lte = new Date(to);
      }

      const [submissions, total] = await Promise.all([
        this.databaseService.submission.findMany({ where, skip, take: perPage, orderBy: { submitted_at: 'desc' } }),
        this.databaseService.submission.count({ where }),
      ]);

      return { success: true, message: 'Submissions retrieved successfully', data: { submissions, pagination: { page, per_page: perPage, total, pages: Math.ceil(total / perPage) } } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getAllSubmissions(user: any, profileId: string, page: number = 1, perPage: number = 25, from?: string, to?: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      // Get all forms for this profile
      const forms = await this.databaseService.form.findMany({
        where: { profileId, deletedAt: null },
        select: { id: true },
      });

      const formIds = forms.map(form => form.id);
      
      if (formIds.length === 0) {
        return { 
          success: true, 
          message: 'Submissions retrieved successfully', 
          data: { 
            submissions: [], 
            pagination: { page, per_page: perPage, total: 0, pages: 0 } 
          } 
        };
      }

      const skip = (page - 1) * perPage;
      const where: any = { 
        formId: { in: formIds }, 
        deletedAt: null 
      };
      
      if (from || to) {
        where.submitted_at = {};
        if (from) where.submitted_at.gte = new Date(from);
        if (to) where.submitted_at.lte = new Date(to);
      }

      const [submissions, total] = await Promise.all([
        this.databaseService.submission.findMany({ 
          where, 
          skip, 
          take: perPage, 
          orderBy: { submitted_at: 'desc' } 
        }),
        this.databaseService.submission.count({ where }),
      ]);

      return { 
        success: true, 
        message: 'Submissions retrieved successfully', 
        data: { 
          submissions, 
          pagination: { 
            page, 
            per_page: perPage, 
            total, 
            pages: Math.ceil(total / perPage) 
          } 
        } 
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async deleteSubmission(user: any, profileId: string, formId: string, submissionId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const form = await this.databaseService.form.findFirst({ where: { id: formId, profileId, deletedAt: null } });
      if (!form) return { success: false, message: 'Form not found' };

      const submission = await this.databaseService.submission.findFirst({ where: { id: submissionId, formId, deletedAt: null } });
      if (!submission) return { success: false, message: 'Submission not found' };

      await this.databaseService.submission.update({ where: { id: submissionId }, data: { deletedAt: new Date() } });
      return { success: true, message: 'Submission deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getFormTemplates(category?: string, isSystem?: boolean) {
    try {
      const where: any = {};
      if (category) where.category = category;
      if (isSystem !== undefined) where.is_system = isSystem;

      const templates = await this.databaseService.formTemplate.findMany({ where, orderBy: { createdAt: 'desc' } });
      return { success: true, message: 'Templates retrieved successfully', data: { templates } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async createFormFromTemplate(user: any, profileId: string, templateId: string, dto: CreateFormFromTemplateDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const template = await this.databaseService.formTemplate.findFirst({ where: { id: templateId } });
      if (!template) return { success: false, message: 'Template not found' };

      let fields = template.preview_fields as any[];
      if (dto.customize_fields && dto.customize_fields.length > 0) {
        fields = fields.map(field => {
          const custom = dto.customize_fields.find(c => c.name === field.name);
          return custom ? { ...field, ...custom } : field;
        });
      }

      const form = await this.databaseService.form.create({
        data: { profileId, title: dto.title, description: dto.description, form_type: 'template', template_id: templateId, status: dto.status as any, fields: fields as any, is_visible: dto.is_visible !== undefined ? dto.is_visible : true },
      });
      return { success: true, message: 'Form created from template successfully', data: { form } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async createTemplate(user: any, profileId: string, dto: CreateTemplateDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const template = await this.databaseService.formTemplate.create({
        data: { name: dto.name, category: dto.category, description: dto.description, preview_fields: dto.fields as any, is_system: false },
      });
      return { success: true, message: 'Template created successfully', data: { template } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async bulkDelete(user: any, profileId: string, dto: BulkDeleteDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const where: any = { profileId, deletedAt: null };
      if (dto.ids && dto.ids.length > 0) where.id = { in: dto.ids };

      await this.databaseService.form.updateMany({ where, data: { deletedAt: new Date() } });
      return { success: true, message: 'Forms deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async bulkRestore(user: any, profileId: string, dto: BulkRestoreDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const where: any = { profileId, deletedAt: { not: null } };
      if (dto.ids && dto.ids.length > 0) where.id = { in: dto.ids };

      await this.databaseService.form.updateMany({ where, data: { deletedAt: null } });
      return { success: true, message: 'Forms restored successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async bulkVisibility(user: any, profileId: string, dto: BulkVisibilityDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      await this.databaseService.form.updateMany({ where: { profileId, id: { in: dto.ids }, deletedAt: null }, data: { is_visible: dto.is_visible } });
      return { success: true, message: 'Forms visibility updated successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async submitPublicForm(profileId: string, formId: string, dto: SubmitFormDto) {
    try {
      // Verify the form exists, belongs to the profile, is ACTIVE, visible, and not deleted
      const form = await this.databaseService.form.findFirst({
        where: {
          id: formId,
          profileId: profileId,
          status: 'ACTIVE',
          is_visible: true,
          deletedAt: null,
        },
      });

      if (!form) {
        return {
          success: false,
          message: 'Form not found, inactive, hidden, or deleted',
        };
      }

      // Create the submission
      const submission = await this.databaseService.submission.create({
        data: {
          formId: formId,
          answers: dto.answers as any,
          submitted_at: new Date(),
        },
      });

      return {
        success: true,
        message: 'Form submitted successfully',
        data: {
          submission,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

