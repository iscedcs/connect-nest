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
import { LinksService } from './links.service';
import {
  CreateLinkDto,
  UpdateLinkDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
  ReorderLinksDto,
  LinkResponseDto,
} from './dto/link.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Links')
@ApiBearerAuth('access-token')
@Controller('profiles/:profileId/links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post('add')
  @ApiOperation({ summary: 'Add a link to a profile' })
  @ApiResponse({
    status: 201,
    description: 'Link created successfully',
    type: LinkResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: CreateLinkDto })
  createLink(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: CreateLinkDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.linksService.createLink(user, profileId, dto);
  }

  @Get('all')
  @ApiOperation({ summary: 'List all links for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Links retrieved successfully',
    type: [LinkResponseDto],
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'per_page',
    required: false,
    description: 'Items per page',
    example: 25,
  })
  @ApiQuery({
    name: 'include_deleted',
    required: false,
    description: 'Include deleted links',
    example: false,
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'Field to sort by',
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    description: 'Sort order',
    enum: ['asc', 'desc'],
  })
  getAllLinks(
    @Request() req,
    @Param('profileId') profileId: string,
    @Query('page') page: number = 1,
    @Query('per_page') perPage: number = 25,
    @Query('include_deleted') includeDeleted: boolean = false,
    @Query('sort') sort?: string,
    @Query('order') order: 'asc' | 'desc' = 'asc',
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.linksService.getAllLinks(
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
  @ApiOperation({ summary: 'Get a specific link by ID' })
  @ApiResponse({
    status: 200,
    description: 'Link retrieved successfully',
    type: LinkResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Link not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Link ID' })
  getLinkById(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.linksService.getLinkById(user, profileId, id);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a specific link' })
  @ApiResponse({
    status: 200,
    description: 'Link updated successfully',
    type: LinkResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Link not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Link ID' })
  @ApiBody({ type: UpdateLinkDto })
  updateLink(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateLinkDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.linksService.updateLink(user, profileId, id, dto);
  }

  @Patch('delete/:id')
  @ApiOperation({ summary: 'Soft delete a specific link' })
  @ApiResponse({ status: 204, description: 'Link deleted successfully' })
  @ApiResponse({ status: 404, description: 'Link not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Link ID' })
  deleteLink(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.linksService.deleteLink(user, profileId, id);
  }

  @Patch('restore/:id')
  @ApiOperation({ summary: 'Restore a soft-deleted link' })
  @ApiResponse({
    status: 200,
    description: 'Link restored successfully',
    type: LinkResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Link not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Link ID' })
  restoreLink(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.linksService.restoreLink(user, profileId, id);
  }

  @Patch('visibility/:id')
  @ApiOperation({ summary: 'Toggle visibility of a link' })
  @ApiResponse({
    status: 200,
    description: 'Link visibility updated successfully',
    type: LinkResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Link not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Link ID' })
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
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.linksService.toggleVisibility(user, profileId, id, isVisible);
  }

  @Patch('all/delete')
  @ApiOperation({ summary: 'Bulk delete links' })
  @ApiResponse({ status: 204, description: 'Links deleted successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkDeleteDto })
  bulkDelete(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkDeleteDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.linksService.bulkDelete(user, profileId, dto);
  }

  @Patch('all/restore')
  @ApiOperation({ summary: 'Bulk restore links' })
  @ApiResponse({ status: 200, description: 'Links restored successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkRestoreDto })
  bulkRestore(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkRestoreDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.linksService.bulkRestore(user, profileId, dto);
  }

  @Patch('visibility/all')
  @ApiOperation({ summary: 'Bulk update visibility of links' })
  @ApiResponse({
    status: 204,
    description: 'Links visibility updated successfully',
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkVisibilityDto })
  bulkVisibility(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkVisibilityDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.linksService.bulkVisibility(user, profileId, dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder links after drag-and-drop in the UI' })
  @ApiResponse({ status: 204, description: 'Links reordered successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: ReorderLinksDto })
  reorderLinks(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: ReorderLinksDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.linksService.reorderLinks(user, profileId, dto);
  }
}
