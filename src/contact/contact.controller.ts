import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ContactService } from './contact.service';
import { ExchangeContactDto } from './dto/contact.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Contact Exchange')
@ApiBearerAuth('access-token')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post('exchange')
  @ApiOperation({ summary: 'Share contact with a business card' })
  @ApiBody({ type: ExchangeContactDto })
  @ApiResponse({ status: 200, description: 'Contact shared successfully' })
  exchangeContact(@Body(ValidationPipe) dto: ExchangeContactDto) {
    return this.contactService.exchangeContact(dto);
  }

  @Get('all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all contacts shared with the current user' })
  @ApiResponse({ status: 200, description: 'User contacts retrieved successfully' })
  getUserContacts(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.contactService.getUserContacts(user);
  }
}
