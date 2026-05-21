import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CpChatService } from './chat.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/workspaces/:wsId/conversations')
export class CpChatController {
  constructor(private readonly service: CpChatService) {}

  @Get()
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF, CpRole.CLIENT)
  @ApiOperation({ summary: 'List my conversations' })
  list(@CpContext() ctx: CpRequestContext) {
    return this.service.listConversations(ctx);
  }

  @Post('direct')
  @CpRoles(CpRole.STAFF, CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Start a direct conversation' })
  createDirect(
    @CpContext() ctx: CpRequestContext,
    @Body() dto: CreateDirectConversationDto,
  ) {
    return this.service.createDirect(ctx, dto);
  }

  @Post(':convId/messages')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF, CpRole.CLIENT)
  @ApiOperation({ summary: 'Send a message (HTTP)' })
  sendMessage(
    @CpContext() ctx: CpRequestContext,
    @Param('convId') convId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.sendMessage(ctx, convId, dto);
  }

  @Get(':convId/messages')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF, CpRole.CLIENT)
  @ApiOperation({ summary: 'Get messages (cursor pagination)' })
  getMessages(
    @CpContext() ctx: CpRequestContext,
    @Param('convId') convId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.service.getMessages(ctx, convId, query);
  }

  @Patch(':convId/messages/read')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF, CpRole.CLIENT)
  @ApiOperation({ summary: 'Mark conversation as read' })
  markRead(
    @CpContext() ctx: CpRequestContext,
    @Param('convId') convId: string,
  ) {
    return this.service.markRead(ctx, convId);
  }
}

