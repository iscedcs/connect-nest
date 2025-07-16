import { Injectable, NotFoundException } from '@nestjs/common';
import { ExchangeContactDto } from './dto/contact.dto';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ContactService {
  constructor(private readonly databaseService: DatabaseService) {}

  async exchangeContact(dto: ExchangeContactDto) {
    try {
      const deviceUrl = await this.databaseService.cardUrl.findFirst({
        where: {
          card_id: dto.card_id,
          device_type: dto.device_type,
        },
      });

      if (!deviceUrl || !deviceUrl.user_id) {
        throw new NotFoundException('Cannot save contact to empty card');
      }

      const card = await this.databaseService.businessCard.findFirst({
        where: {
          id: deviceUrl.profile_id,
          user_id: deviceUrl.user_id,
        },
      });

      if (!card) {
        throw new NotFoundException('Associated card not found');
      }

      const newContact = await this.databaseService.sharedContact.create({
        data: {
          owner_id: deviceUrl.user_id,
          full_name: dto.full_name,
          phone: dto.phone,
          email: dto.email ?? null,
        },
      });

      const socials = dto.socials || {};
      const contactLinks = Object.entries(socials).map(([type, link]) => ({
        contact_id: newContact.id,
        type,
        link,
      }));

      if (contactLinks.length > 0) {
        await this.databaseService.contactLink.createMany({ data: contactLinks });
      }

      return {
        success: true,
        message: 'Contact shared successfully',
        data: {
          contact: newContact,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getUserContacts(user: any) {
    try {
      const contacts = await this.databaseService.sharedContact.findMany({
        where: { owner_id: user.id },
        include: {
          contact_links: true,
        },
      });

      if (!contacts || contacts.length === 0) {
        throw new NotFoundException('No contacts found for the user');
      }


      return {
        success: true,
        message: 'Retrieved user contacts successfully',
        data: {
          contacts,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
