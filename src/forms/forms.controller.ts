import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Request,
  ValidationPipe,
  Param,
  Query,
} from '@nestjs/common';
import { FormsService } from './forms.service';
import {
  CreateFormDto,
  UpdateFormDto,
  CreateFormFromTemplateDto,
  CreateTemplateDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
  FormResponseDto,
  TemplateResponseDto,
  SubmissionResponseDto,
  SubmitFormDto,
} from './dto/form.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PublicRoute } from 'src/auth/decorators/public-route.decorator';

@ApiTags('Forms')
@ApiBearerAuth('access-token')
@Controller('profiles/:profileId/forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Post('add')
  @ApiOperation({ summary: 'Create a new form' })
  @ApiResponse({
    status: 201,
    description: 'Form created successfully',
    type: FormResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: CreateFormDto })
  createForm(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: CreateFormDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.formsService.createForm(user, profileId, dto);
  }

  @Get('all')
  @ApiOperation({ summary: 'List all forms for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Forms retrieved successfully',
    type: [FormResponseDto],
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @ApiQuery({ name: 'include_deleted', required: false })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  getAllForms(
    @Request() req,
    @Param('profileId') profileId: string,
    @Query('page') page: number = 1,
    @Query('per_page') perPage: number = 25,
    @Query('include_deleted') includeDeleted: boolean = false,
    @Query('sort') sort?: string,
    @Query('order') order: 'asc' | 'desc' = 'asc',
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.formsService.getAllForms(
      user,
      profileId,
      page,
      perPage,
      includeDeleted,
      sort,
      order,
    );
  }

  @Get('one/:id')
  @ApiOperation({ summary: 'Get a specific form by ID' })
  @ApiResponse({
    status: 200,
    description: 'Form retrieved successfully',
    type: FormResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Form ID' })
  getFormById(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.formsService.getFormById(user, profileId, id);
  }

  @PublicRoute()
  @Get('public/:id')
  @ApiOperation({ summary: 'Get a specific form by ID' })
  @ApiResponse({
    status: 200,
    description: 'Form retrieved successfully',
    type: FormResponseDto,
  })
  @ApiParam({ name: 'id', description: 'Form ID' })
  getPublicFormById(@Param('id') id: string) {
    return this.formsService.getPublicFormById(id);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a specific form' })
  @ApiResponse({
    status: 200,
    description: 'Form updated successfully',
    type: FormResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Form ID' })
  @ApiBody({ type: UpdateFormDto })
  updateForm(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateFormDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.formsService.updateForm(user, profileId, id, dto);
  }

  @Patch('delete/:id')
  @ApiOperation({ summary: 'Soft delete a specific form' })
  @ApiResponse({ status: 204, description: 'Form deleted successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Form ID' })
  deleteForm(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.formsService.deleteForm(user, profileId, id);
  }

  @Patch('restore/:id')
  @ApiOperation({ summary: 'Restore a soft-deleted form' })
  @ApiResponse({
    status: 200,
    description: 'Form restored successfully',
    type: FormResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Form ID' })
  restoreForm(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.formsService.restoreForm(user, profileId, id);
  }

  @Patch('visibility/:id')
  @ApiOperation({ summary: 'Toggle visibility of a form' })
  @ApiResponse({
    status: 200,
    description: 'Form visibility updated successfully',
    type: FormResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Form ID' })
  @ApiBody({
    schema: { type: 'object', properties: { is_visible: { type: 'boolean' } } },
  })
  toggleVisibility(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
    @Body('is_visible') isVisible: boolean,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.formsService.toggleVisibility(user, profileId, id, isVisible);
  }

  @Get('submissions/all')
  @ApiOperation({ summary: 'Get all submissions for all forms in a profile' })
  @ApiResponse({
    status: 200,
    description: 'Submissions retrieved successfully',
    type: [SubmissionResponseDto],
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date (ISO string)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'End date (ISO string)',
  })
  getAllSubmissions(
    @Request() req,
    @Param('profileId') profileId: string,
    @Query('page') page: number = 1,
    @Query('per_page') perPage: number = 25,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.formsService.getAllSubmissions(
      user,
      profileId,
      page,
      perPage,
      from,
      to,
    );
  }

  @Get('submissions/:id')
  @ApiOperation({ summary: 'Get submissions for a specific form' })
  @ApiResponse({
    status: 200,
    description: 'Submissions retrieved successfully',
    type: [SubmissionResponseDto],
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Form ID' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date (ISO string)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'End date (ISO string)',
  })
  getFormSubmissions(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('per_page') perPage: number = 25,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.formsService.getFormSubmissions(
      user,
      profileId,
      id,
      page,
      perPage,
      from,
      to,
    );
  }

  @Patch('submissions/delete/:submissionId')
  @ApiOperation({ summary: 'Soft delete a submission' })
  @ApiResponse({ status: 204, description: 'Submission deleted successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'submissionId', description: 'Submission ID' })
  deleteSubmission(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('submissionId') submissionId: string,
    @Query('formId') formId: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.formsService.deleteSubmission(
      user,
      profileId,
      formId,
      submissionId,
    );
  }

  @Post('from-template/:templateId')
  @ApiOperation({ summary: 'Create a form from a template' })
  @ApiResponse({
    status: 201,
    description: 'Form created from template successfully',
    type: FormResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiBody({ type: CreateFormFromTemplateDto })
  createFormFromTemplate(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('templateId') templateId: string,
    @Body(ValidationPipe) dto: CreateFormFromTemplateDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.formsService.createFormFromTemplate(
      user,
      profileId,
      templateId,
      dto,
    );
  }

  @Post('form-templates/add')
  @ApiOperation({ summary: 'Create a custom form template' })
  @ApiResponse({
    status: 201,
    description: 'Template created successfully',
    type: TemplateResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: CreateTemplateDto })
  createTemplate(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: CreateTemplateDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.formsService.createTemplate(user, profileId, dto);
  }

  @Patch('all/delete')
  @ApiOperation({ summary: 'Bulk delete forms' })
  @ApiResponse({ status: 204, description: 'Forms deleted successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkDeleteDto })
  bulkDelete(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkDeleteDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.formsService.bulkDelete(user, profileId, dto);
  }

  @Patch('all/restore')
  @ApiOperation({ summary: 'Bulk restore forms' })
  @ApiResponse({ status: 200, description: 'Forms restored successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkRestoreDto })
  bulkRestore(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkRestoreDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.formsService.bulkRestore(user, profileId, dto);
  }

  @Patch('visibility/all')
  @ApiOperation({ summary: 'Bulk update visibility of forms' })
  @ApiResponse({
    status: 204,
    description: 'Forms visibility updated successfully',
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkVisibilityDto })
  bulkVisibility(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkVisibilityDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.formsService.bulkVisibility(user, profileId, dto);
  }

  @PublicRoute()
  @Post('submit/public/:id')
  @ApiOperation({
    summary: 'Submit a form (Public endpoint - no authentication required)',
  })
  @ApiResponse({
    status: 201,
    description: 'Form submitted successfully',
    type: SubmissionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Form not found, inactive, hidden, or deleted',
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Form ID' })
  @ApiBody({ type: SubmitFormDto })
  submitPublicForm(
    @Param('profileId') profileId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: SubmitFormDto,
  ) {
    return this.formsService.submitPublicForm(profileId, id, dto);
  }
}

@ApiTags('Form Templates')
@ApiBearerAuth('access-token')
@Controller('form-templates')
export class FormTemplatesController {
  constructor(private readonly formsService: FormsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all form templates' })
  @ApiResponse({
    status: 200,
    description: 'Templates retrieved successfully',
    type: [TemplateResponseDto],
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by category',
  })
  @ApiQuery({
    name: 'is_system',
    required: false,
    description: 'Filter system templates',
    type: Boolean,
  })
  getFormTemplates(
    @Query('category') category?: string,
    @Query('is_system') isSystem?: string,
  ) {
    const isSystemBool = isSystem === 'true';
    return this.formsService.getFormTemplates(category, isSystemBool);
  }
}
