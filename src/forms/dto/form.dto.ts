import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsObject,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

// Using Prisma's FormStatus enum - import from @prisma/client if needed
// For DTO purposes, we'll use string literals that match Prisma enum
export type FormStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

export class FormFieldDto {
  @ApiPropertyOptional({
    description: 'Field ID (for updates)',
    example: 'fld_1',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    description: 'Field type',
    example: 'text',
    enum: [
      'text',
      'email',
      'textarea',
      'select',
      'checkbox',
      'radio',
      'number',
      'date',
    ],
  })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Field label', example: 'Full Name' })
  @IsString()
  label: string;

  @ApiProperty({
    description: 'Field name (for form submission)',
    example: 'full_name',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Whether field is required',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({
    description: 'Options for select/radio fields',
    example: ['Option 1', 'Option 2'],
  })
  @IsOptional()
  @IsArray()
  options?: string[];

  @ApiPropertyOptional({
    description: 'Field validations',
    example: { max: 1000, min: 10 },
  })
  @IsOptional()
  @IsObject()
  validations?: any;
}

export class CreateFormDto {
  @ApiProperty({ description: 'Form title', example: 'Contact Me' })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Form description',
    example: 'Business inquiries',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Form type', example: 'custom' })
  @IsString()
  form_type: string;

  @ApiPropertyOptional({
    description: 'Template ID if created from template',
    example: 'tmpl_contact_basic',
  })
  @IsOptional()
  @IsString()
  template_id?: string;

  @ApiProperty({
    description: 'Form status',
    example: 'DRAFT',
    enum: ['DRAFT', 'ACTIVE', 'CLOSED'],
  })
  @IsString()
  status: FormStatus;

  @ApiPropertyOptional({
    description:
      'External form URL (e.g., Google Forms, Typeform, etc.). If not provided, will use internal form.',
    example: 'https://docs.google.com/forms/d/e/1FAIpQLSd...',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  form_url?: string;

  @ApiPropertyOptional({
    description: 'Whether form is visible',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;

  @ApiProperty({ description: 'Form fields', type: [FormFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields: FormFieldDto[];
}

export class UpdateFormDto {
  @ApiPropertyOptional({ description: 'Form title', example: 'Contact Me' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Form description',
    example: 'Business inquiries',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Form status',
    example: 'ACTIVE',
    enum: ['DRAFT', 'ACTIVE', 'CLOSED'],
  })
  @IsOptional()
  @IsString()
  status?: FormStatus;

  @ApiPropertyOptional({
    description: 'External form URL',
    example: 'https://docs.google.com/forms/d/e/1FAIpQLSd...',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  form_url?: string;

  @ApiPropertyOptional({
    description: 'Whether form is visible',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;

  @ApiPropertyOptional({ description: 'Form fields', type: [FormFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields?: FormFieldDto[];
}

export class CreateFormFromTemplateDto {
  @ApiProperty({ description: 'Form title', example: 'Contact Me' })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Form description',
    example: 'Business inquiries',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Form status',
    example: 'DRAFT',
    enum: ['DRAFT', 'ACTIVE', 'CLOSED'],
  })
  @IsString()
  status: FormStatus;

  @ApiPropertyOptional({
    description: 'Whether form is visible',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;

  @ApiPropertyOptional({
    description: 'Custom field overrides',
    type: [FormFieldDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  customize_fields?: FormFieldDto[];
}

export class CreateTemplateDto {
  @ApiProperty({ description: 'Template name', example: 'Event Registration' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Template category', example: 'application' })
  @IsString()
  category: string;

  @ApiPropertyOptional({
    description: 'Template description',
    example: 'Template for event registration forms',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Template fields', type: [FormFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields: FormFieldDto[];
}

export {
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
} from '../../common/dto/bulk-operations.dto';

export class FormResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the form',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Profile ID this form belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  profileId: string;

  @ApiProperty({ description: 'Form title', example: 'Contact Me' })
  title: string;

  @ApiPropertyOptional({
    description: 'Form description',
    example: 'Business inquiries',
  })
  description?: string;

  @ApiProperty({ description: 'Form type', example: 'custom' })
  form_type: string;

  @ApiPropertyOptional({
    description: 'Template ID',
    example: 'tmpl_contact_basic',
  })
  template_id?: string;

  @ApiProperty({
    description: 'Form status',
    example: 'DRAFT',
    enum: ['DRAFT', 'ACTIVE', 'CLOSED'],
  })
  status: FormStatus;

  @ApiProperty({
    description: 'Form fields (JSON)',
    type: 'object',
    additionalProperties: true,
  })
  fields: any;

  @ApiPropertyOptional({
    description: 'External form URL',
    example: 'https://docs.google.com/forms/d/e/1FAIpQLSd...',
  })
  form_url?: string;

  @ApiProperty({ description: 'Whether form is visible', example: true })
  is_visible: boolean;

  @ApiProperty({
    description: 'Timestamp when the form was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the form was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the form was deleted (soft delete)',
    example: '2024-01-01T00:00:00.000Z',
  })
  deletedAt?: Date;
}

export class TemplateResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the template',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({ description: 'Template name', example: 'Basic Contact Form' })
  name: string;

  @ApiProperty({ description: 'Template category', example: 'contact' })
  category: string;

  @ApiPropertyOptional({
    description: 'Template description',
    example: 'Simple contact form',
  })
  description?: string;

  @ApiProperty({
    description: 'Preview fields (JSON)',
    type: 'object',
    additionalProperties: true,
  })
  preview_fields: any;

  @ApiProperty({
    description: 'Whether this is a system template',
    example: true,
  })
  is_system: boolean;

  @ApiProperty({
    description: 'Timestamp when the template was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;
}

export class SubmitFormDto {
  @ApiProperty({
    description:
      'Form submission answers (key-value pairs matching form fields)',
    type: 'object',
    additionalProperties: true,
    example: {
      full_name: 'John Doe',
      email: 'john@example.com',
      message: 'Hello!',
    },
  })
  @IsObject()
  answers: Record<string, any>;
}

export class SubmissionResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the submission',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Form ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  formId: string;

  @ApiProperty({
    description: 'Submission timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  submitted_at: Date;

  @ApiProperty({
    description: 'Submission answers (JSON)',
    type: 'object',
    additionalProperties: true,
  })
  answers: any;

  @ApiProperty({
    description: 'Timestamp when the submission was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the submission was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the submission was deleted (soft delete)',
    example: '2024-01-01T00:00:00.000Z',
  })
  deletedAt?: Date;
}
