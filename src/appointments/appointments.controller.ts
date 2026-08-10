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
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
  AppointmentResponseDto,
} from './dto/appointment.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Appointments')
@ApiBearerAuth('access-token')
@Controller('profiles/:profileId/appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post('add')
  @ApiOperation({ summary: 'Add an appointment link to a profile' })
  @ApiResponse({
    status: 201,
    description: 'Appointment created successfully',
    type: AppointmentResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: CreateAppointmentDto })
  createAppointment(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: CreateAppointmentDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.appointmentsService.createAppointment(user, profileId, dto);
  }

  @Get('all')
  @ApiOperation({ summary: 'List all appointments for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Appointments retrieved successfully',
    type: [AppointmentResponseDto],
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @ApiQuery({ name: 'include_deleted', required: false })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  getAllAppointments(
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
    return this.appointmentsService.getAllAppointments(
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
  @ApiOperation({ summary: 'Get a specific appointment by ID' })
  @ApiResponse({
    status: 200,
    description: 'Appointment retrieved successfully',
    type: AppointmentResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
  getAppointmentById(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.appointmentsService.getAppointmentById(user, profileId, id);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a specific appointment' })
  @ApiResponse({
    status: 200,
    description: 'Appointment updated successfully',
    type: AppointmentResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
  @ApiBody({ type: UpdateAppointmentDto })
  updateAppointment(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateAppointmentDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.appointmentsService.updateAppointment(user, profileId, id, dto);
  }

  @Patch('delete/:id')
  @ApiOperation({ summary: 'Soft delete a specific appointment' })
  @ApiResponse({ status: 204, description: 'Appointment deleted successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
  deleteAppointment(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.appointmentsService.deleteAppointment(user, profileId, id);
  }

  @Patch('restore/:id')
  @ApiOperation({ summary: 'Restore a soft-deleted appointment' })
  @ApiResponse({
    status: 200,
    description: 'Appointment restored successfully',
    type: AppointmentResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
  restoreAppointment(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.appointmentsService.restoreAppointment(user, profileId, id);
  }

  @Patch('visibility/:id')
  @ApiOperation({ summary: 'Toggle visibility of an appointment' })
  @ApiResponse({
    status: 200,
    description: 'Appointment visibility updated successfully',
    type: AppointmentResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
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
    return this.appointmentsService.toggleVisibility(
      user,
      profileId,
      id,
      isVisible,
    );
  }

  @Patch('default/:id')
  @ApiOperation({ summary: 'Set an appointment as default' })
  @ApiResponse({
    status: 200,
    description: 'Default appointment set successfully',
    type: AppointmentResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
  setDefaultAppointment(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.appointmentsService.setDefaultAppointment(user, profileId, id);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get the default appointment for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Default appointment retrieved successfully',
    type: AppointmentResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  getDefaultAppointment(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.appointmentsService.getDefaultAppointment(user, profileId);
  }

  @Patch('all/delete')
  @ApiOperation({ summary: 'Bulk delete appointments' })
  @ApiResponse({
    status: 204,
    description: 'Appointments deleted successfully',
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkDeleteDto })
  bulkDelete(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkDeleteDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.appointmentsService.bulkDelete(user, profileId, dto);
  }

  @Patch('all/restore')
  @ApiOperation({ summary: 'Bulk restore appointments' })
  @ApiResponse({
    status: 200,
    description: 'Appointments restored successfully',
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkRestoreDto })
  bulkRestore(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkRestoreDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.appointmentsService.bulkRestore(user, profileId, dto);
  }

  @Patch('visibility/all')
  @ApiOperation({ summary: 'Bulk update visibility of appointments' })
  @ApiResponse({
    status: 204,
    description: 'Appointments visibility updated successfully',
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
    return this.appointmentsService.bulkVisibility(user, profileId, dto);
  }
}
