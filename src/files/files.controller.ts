import { Controller, Get, Post, Patch, Delete, Body, Request, ValidationPipe, Param, Query } from '@nestjs/common';
import { FilesService } from './files.service';
import { CreateFileDto, UpdateFileDto, BulkVisibilityDto, BulkDeleteDto, BulkRestoreDto, FileResponseDto, DownloadResponseDto } from './dto/file.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('Files')
@ApiBearerAuth('access-token')
@Controller('profiles/:profileId/files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('add')
  @ApiOperation({ summary: 'Register an uploaded file\'s metadata' })
  @ApiResponse({ status: 201, description: 'File created successfully', type: FileResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: CreateFileDto })
  createFile(@Request() req, @Param('profileId') profileId: string, @Body(ValidationPipe) dto: CreateFileDto) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.filesService.createFile(user, profileId, dto);
  }

  @Get('all')
  @ApiOperation({ summary: 'List all files for a profile' })
  @ApiResponse({ status: 200, description: 'Files retrieved successfully', type: [FileResponseDto] })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @ApiQuery({ name: 'include_deleted', required: false })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  getAllFiles(@Request() req, @Param('profileId') profileId: string, @Query('page') page: number = 1, @Query('per_page') perPage: number = 25, @Query('include_deleted') includeDeleted: boolean = false, @Query('sort') sort?: string, @Query('order') order: 'asc' | 'desc' = 'asc') {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.filesService.getAllFiles(user, profileId, page, perPage, includeDeleted, sort, order);
  }

  @Get('one/:id')
  @ApiOperation({ summary: 'Get a specific file by ID' })
  @ApiResponse({ status: 200, description: 'File retrieved successfully', type: FileResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'File ID' })
  getFileById(@Request() req, @Param('profileId') profileId: string, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.filesService.getFileById(user, profileId, id);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a specific file' })
  @ApiResponse({ status: 200, description: 'File updated successfully', type: FileResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiBody({ type: UpdateFileDto })
  updateFile(@Request() req, @Param('profileId') profileId: string, @Param('id') id: string, @Body(ValidationPipe) dto: UpdateFileDto) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.filesService.updateFile(user, profileId, id, dto);
  }

  @Patch('delete/:id')
  @ApiOperation({ summary: 'Soft delete a specific file' })
  @ApiResponse({ status: 204, description: 'File deleted successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'File ID' })
  deleteFile(@Request() req, @Param('profileId') profileId: string, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.filesService.deleteFile(user, profileId, id);
  }

  @Patch('restore/:id')
  @ApiOperation({ summary: 'Restore a soft-deleted file' })
  @ApiResponse({ status: 200, description: 'File restored successfully', type: FileResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'File ID' })
  restoreFile(@Request() req, @Param('profileId') profileId: string, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.filesService.restoreFile(user, profileId, id);
  }

  @Patch('visibility/:id')
  @ApiOperation({ summary: 'Toggle visibility of a file' })
  @ApiResponse({ status: 200, description: 'File visibility updated successfully', type: FileResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiBody({ schema: { type: 'object', properties: { is_visible: { type: 'boolean' } } } })
  toggleVisibility(@Request() req, @Param('profileId') profileId: string, @Param('id') id: string, @Body('is_visible') isVisible: boolean) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.filesService.toggleVisibility(user, profileId, id, isVisible);
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Get files by type for a profile' })
  @ApiResponse({ status: 200, description: 'Files retrieved successfully', type: [FileResponseDto] })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'type', description: 'File type category (pdf, image, doc, other)' })
  getFilesByType(@Request() req, @Param('profileId') profileId: string, @Param('type') type: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.filesService.getFilesByType(user, profileId, type);
  }

  @Get('download/:id')
  @ApiOperation({ summary: 'Get a time-limited download URL for a file' })
  @ApiResponse({ status: 200, description: 'Download URL generated successfully', type: DownloadResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'File ID' })
  getDownloadUrl(@Request() req, @Param('profileId') profileId: string, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.filesService.getDownloadUrl(user, profileId, id);
  }

  @Delete('permanent/:id')
  @ApiOperation({ summary: 'Permanently delete a file from database and optionally Digital Ocean Spaces' })
  @ApiResponse({ status: 204, description: 'File permanently deleted successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiQuery({ name: 'force_delete', required: false, description: 'When true, deletes physical file from Digital Ocean Spaces', example: false })
  permanentDelete(@Request() req, @Param('profileId') profileId: string, @Param('id') id: string, @Query('force_delete') forceDelete: boolean = false) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.filesService.permanentDelete(user, profileId, id, forceDelete);
  }

  @Patch('all/delete')
  @ApiOperation({ summary: 'Bulk delete files' })
  @ApiResponse({ status: 204, description: 'Files deleted successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkDeleteDto })
  bulkDelete(@Request() req, @Param('profileId') profileId: string, @Body(ValidationPipe) dto: BulkDeleteDto) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.filesService.bulkDelete(user, profileId, dto);
  }

  @Patch('all/restore')
  @ApiOperation({ summary: 'Bulk restore files' })
  @ApiResponse({ status: 200, description: 'Files restored successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkRestoreDto })
  bulkRestore(@Request() req, @Param('profileId') profileId: string, @Body(ValidationPipe) dto: BulkRestoreDto) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.filesService.bulkRestore(user, profileId, dto);
  }

  @Patch('visibility/all')
  @ApiOperation({ summary: 'Bulk update visibility of files' })
  @ApiResponse({ status: 204, description: 'Files visibility updated successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkVisibilityDto })
  bulkVisibility(@Request() req, @Param('profileId') profileId: string, @Body(ValidationPipe) dto: BulkVisibilityDto) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.filesService.bulkVisibility(user, profileId, dto);
  }
}

