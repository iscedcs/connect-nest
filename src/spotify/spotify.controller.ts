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
import { SpotifyService } from './spotify.service';
import {
  CreateSpotifyDto,
  UpdateSpotifyDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
  SpotifyResponseDto,
} from './dto/spotify.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Spotify Items')
@ApiBearerAuth('access-token')
@Controller('profiles/:profileId/spotify')
export class SpotifyController {
  constructor(private readonly spotifyService: SpotifyService) {}

  @Post('add')
  @ApiOperation({ summary: 'Add a Spotify item to a profile' })
  @ApiResponse({
    status: 201,
    description: 'Spotify item created successfully',
    type: SpotifyResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: CreateSpotifyDto })
  createSpotifyItem(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: CreateSpotifyDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.spotifyService.createSpotifyItem(user, profileId, dto);
  }

  @Get('all')
  @ApiOperation({ summary: 'List all Spotify items for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Spotify items retrieved successfully',
    type: [SpotifyResponseDto],
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @ApiQuery({ name: 'include_deleted', required: false })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  getAllSpotifyItems(
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
    return this.spotifyService.getAllSpotifyItems(
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
  @ApiOperation({ summary: 'Get a specific Spotify item by ID' })
  @ApiResponse({
    status: 200,
    description: 'Spotify item retrieved successfully',
    type: SpotifyResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Spotify item ID' })
  getSpotifyItemById(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.spotifyService.getSpotifyItemById(user, profileId, id);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a specific Spotify item' })
  @ApiResponse({
    status: 200,
    description: 'Spotify item updated successfully',
    type: SpotifyResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Spotify item ID' })
  @ApiBody({ type: UpdateSpotifyDto })
  updateSpotifyItem(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateSpotifyDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.spotifyService.updateSpotifyItem(user, profileId, id, dto);
  }

  @Patch('delete/:id')
  @ApiOperation({ summary: 'Soft delete a specific Spotify item' })
  @ApiResponse({
    status: 204,
    description: 'Spotify item deleted successfully',
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Spotify item ID' })
  deleteSpotifyItem(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.spotifyService.deleteSpotifyItem(user, profileId, id);
  }

  @Patch('restore/:id')
  @ApiOperation({ summary: 'Restore a soft-deleted Spotify item' })
  @ApiResponse({
    status: 200,
    description: 'Spotify item restored successfully',
    type: SpotifyResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Spotify item ID' })
  restoreSpotifyItem(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.spotifyService.restoreSpotifyItem(user, profileId, id);
  }

  @Patch('visibility/:id')
  @ApiOperation({ summary: 'Toggle visibility of a Spotify item' })
  @ApiResponse({
    status: 200,
    description: 'Spotify item visibility updated successfully',
    type: SpotifyResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Spotify item ID' })
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
    return this.spotifyService.toggleVisibility(user, profileId, id, isVisible);
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Get Spotify items by type for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Spotify items retrieved successfully',
    type: [SpotifyResponseDto],
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({
    name: 'type',
    description: 'Item type (track, playlist, album, artist, other)',
  })
  getSpotifyItemsByType(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('type') type: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.spotifyService.getSpotifyItemsByType(user, profileId, type);
  }

  @Patch('all/delete')
  @ApiOperation({ summary: 'Bulk delete Spotify items' })
  @ApiResponse({
    status: 204,
    description: 'Spotify items deleted successfully',
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
    return this.spotifyService.bulkDelete(user, profileId, dto);
  }

  @Patch('all/restore')
  @ApiOperation({ summary: 'Bulk restore Spotify items' })
  @ApiResponse({
    status: 200,
    description: 'Spotify items restored successfully',
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
    return this.spotifyService.bulkRestore(user, profileId, dto);
  }

  @Patch('visibility/all')
  @ApiOperation({ summary: 'Bulk update visibility of Spotify items' })
  @ApiResponse({
    status: 204,
    description: 'Spotify items visibility updated successfully',
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
    return this.spotifyService.bulkVisibility(user, profileId, dto);
  }
}
