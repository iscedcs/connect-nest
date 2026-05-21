import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CpPublicService } from './public.service';
import { PublicRoute } from '../../auth/decorators/public-route.decorator';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { SaveContactDto } from './dto/save-contact.dto';
import { RecordInteractionDto } from './dto/record-interaction.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Connect Plus - Public')
@PublicRoute()
@Controller('cp/public/:workspaceSlug')
export class CpPublicController {
  constructor(private readonly service: CpPublicService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get public company profile' })
  @ApiResponse({ status: 200, description: 'Public profile' })
  getPublicProfile(@Param('workspaceSlug') workspaceSlug: string) {
    return this.service.getPublicProfile(workspaceSlug);
  }

  @Post('appointments')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Book appointment (public)' })
  @ApiResponse({ status: 201, description: 'Appointment booked' })
  bookAppointment(
    @Param('workspaceSlug') workspaceSlug: string,
    @Body() dto: BookAppointmentDto,
  ) {
    return this.service.bookAppointment(workspaceSlug, dto);
  }

  @Post('contacts/save')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save contact (public form submission)' })
  @ApiResponse({ status: 200, description: 'Contact saved' })
  saveContact(
    @Param('workspaceSlug') workspaceSlug: string,
    @Body() dto: SaveContactDto,
  ) {
    return this.service.saveContact(workspaceSlug, dto);
  }

  @Post('interactions')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record card interaction' })
  @ApiResponse({ status: 200, description: 'Interaction recorded' })
  recordInteraction(
    @Param('workspaceSlug') workspaceSlug: string,
    @Body() dto: RecordInteractionDto,
    @Req() req: Request,
  ) {
    const ip = req.ip;
    return this.service.recordInteraction(workspaceSlug, dto, ip);
  }
}

