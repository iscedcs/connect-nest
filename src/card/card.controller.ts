import { Controller, Get, Post, Body, Patch, Request, ValidationPipe, Query, Res, HttpStatus } from '@nestjs/common';
import { CardService } from './card.service';
import { AddDeviceDto, ConfirmCardIdDto, ConfirmTokenDto, CreateCardDto, SaveCardDto } from './dto/card.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';


@ApiTags('Cards')
@ApiBearerAuth('access-token') // Use the same key from addBearerAuth()
@Controller('card')
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a new digital business card' })
  @ApiResponse({ status: 201, description: 'Card created successfully' })
  @ApiResponse({ status: 400, description: 'Failed to create card' })
  @ApiBody({ type: CreateCardDto })
  createCard(@Request() req, @Body(ValidationPipe) dto: CreateCardDto) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.cardService.createCard(user, dto);
  }

  @Get('user')
  @ApiOperation({ summary: 'Get current user\'s business card and its fields' })
  @ApiResponse({ status: 200, description: 'Card retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  getCard(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.cardService.getCardForUser(user);
  }

  @Patch('save')
  @ApiOperation({ summary: 'Update card title, subtitle, description and fields' })
  @ApiResponse({ status: 200, description: 'Card updated successfully' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  @ApiBody({ type: SaveCardDto })
  saveCard(@Request() req, @Body(ValidationPipe) dto: SaveCardDto) {
    const user = req.isce_auth;

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    return this.cardService.updateCardDetails(user, dto);
  }

  @Post('add-device')
  @ApiOperation({ summary: 'Link a device to the user’s card' })
  @ApiResponse({ status: 200, description: 'Device added successfully' })
  @ApiBody({ type: AddDeviceDto })
  addDeviceToUser(@Request() req, @Body(ValidationPipe) dto: AddDeviceDto) {
    const user = req.isce_auth;

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    return this.cardService.linkDeviceToUser(user, dto);
  }


  @Post('confirm-token')
  @ApiOperation({ summary: 'Confirm if a token is valid and unused' })
  @ApiBody({ type: ConfirmTokenDto })
  @ApiResponse({ status: 200, description: 'Token confirmed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid device or token' })
  confirmToken(@Body(ValidationPipe) dto: ConfirmTokenDto) {
    return this.cardService.confirmToken(dto);
  }

  @Post('confirm-card-id')
  @ApiOperation({ summary: 'Confirm if a card ID is valid and not already used' })
  @ApiBody({ type: ConfirmCardIdDto })
  @ApiResponse({ status: 200, description: 'Card ID confirmed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid card ID' })
  confirmCardId(@Body(ValidationPipe) dto: ConfirmCardIdDto) {
    return this.cardService.confirmCardId(dto);
  }



  @Get('card-route')
  @ApiOperation({ summary: 'Determine redirect route based on card state' })
  @ApiQuery({ name: 'card_id', required: true })
  @ApiQuery({ name: 'type', required: true })
  getCardRoute(@Query('card_id') cardId: string, @Query('type') type: string) {
    return this.cardService.getCardRoute(cardId, type);
  }


  @Get('card-profile')
  @ApiOperation({ summary: 'Get card profile' })
  @ApiResponse({ status: 200, description: 'Card profile response' })
  getCardProfile(
    @Query('id') id: string,
    @Query('type') type: string,
  ) {
    return this.cardService.getCardProfile(id, type);
  }


  @Get('vcard-download')
  @ApiOperation({ summary: 'Generate downloadable vCard (.vcf) for profile' })
  @ApiQuery({ name: 'id', required: true, description: 'Card ID (unique identifier)' })
  @ApiQuery({ name: 'type', required: true, description: 'Device type (identifier string)' })
  @ApiResponse({
    status: 200,
    description: 'vCard file generated successfully',
    content: {
      'text/vcard': {
        schema: {
          type: 'string',
          example: `BEGIN:VCARD\nVERSION:3.0\nN:Doe;John;;;\nFN:John Doe\nEMAIL:john@example.com\nTEL;TYPE=WORK,VOICE:(123) 456-7890\nEND:VCARD`,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid card or business card not set' })
  async generateVcardProfile(
    @Query('id') id: string,
    @Query('type') type: string,
    @Res() res: Response,
  ) {
    const result = await this.cardService.generateVcardProfile(id, type);

    if (!result.success) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: result.message,
      });
    }

    res.setHeader('Content-Type', 'text/vcard; name="contact.vcf"');
    res.setHeader('Content-Disposition', 'inline; filename="contact.vcf"');
    return res.send(result);
  }
}
