import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AddDeviceDto, ConfirmCardIdDto, ConfirmTokenDto, CreateCardDto, SaveCardDto } from './dto/card.dto';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import { DatabaseService } from 'src/database/database.service';
import * as vCardsJS from 'vcards-js';


@Injectable()
export class CardService {

  constructor(private readonly databaseService: DatabaseService) {}

  async createCard(user: any, dto: CreateCardDto) {
    try {
      const cardId = uuidv4();
      const cardUrl = slugify(cardId, { lower: true });

      const theme = await this.databaseService.theme.findFirst({
        where: { theme_description: 'vCard' },
        orderBy: { id: 'asc' }, // or random logic on frontend
      });

      if (!theme) {
        throw new NotFoundException('Unable to find theme');
      }

      const businessCard = await this.databaseService.businessCard.create({
        data: {
          id: cardId,
          user_id: user.id,
          theme_id: theme.id,
          theme_color: 'blue',
          card_lang: 'en',
          cover: '/backend/img/vCards/default-1080x1200-thumbnail.jpg',
          profile: dto.image.image,
          card_url: cardUrl,
          card_type: 'vcard',
          title: user.name,
          sub_title: dto.card.subTitle,
          description: dto.card.description,
        },
      });

      await this.databaseService.cardUrl.updateMany({
        where: { card_id: dto.card_id },
        data: {
          user_id: user.id,
          firstuse: true,
          state: 'profile',
          profile_id: businessCard.id,
        },
      });

      if (dto.fields && dto.fields.length > 0) {
        const fieldsToCreate = dto.fields.map((field) => ({
          card_id: businessCard.id,
          type: field.type,
          icon: field.icon,
          label: field.label,
          content: field.content,
          position: field.position,
          status: field.status,
        }));

        await this.databaseService.businessField.createMany({
          data: fieldsToCreate,
        });
      }

      return {
        success: true,
        message: 'Card created successfully',
        data: {
          card_id: businessCard.id,
          card_url: businessCard.card_url,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }


  async getCardForUser(user: any) {
  try {
    const card = await this.databaseService.businessCard.findFirst({
      where: { user_id: user.id },
    });

    if (!card) {
      return { success: false, message: 'Card not found' };
    }

    const fields = await this.databaseService.businessField.findMany({
      where: { card_id: card.id },
    });

    return {
      success: true,
      message: "Card retrieved successfully",
      data: {
        card,
        fields,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}


async updateCardDetails(user: any, dto: SaveCardDto) {
  try {
    const card = await this.databaseService.businessCard.findFirst({
      where: { user_id: user.id },
    });

    if (!card) {
      return { success: false, message: 'Card not found' };
    }

    const updatedCard = await this.databaseService.businessCard.update({
      where: { id: card.id },
      data: {
        title: dto.title,
        sub_title: dto.subTitle,
        description: dto.description,
      },
    });

    await this.databaseService.businessField.deleteMany({
      where: { card_id: card.id },
    });

    const newFields = dto.fields.map((field, index) => ({
      card_id: card.id,
      type: field.type,
      icon: field.icon,
      label: field.label,
      content: field.content,
      position: index,
      status: field.status,
    }));

    await this.databaseService.businessField.createMany({ data: newFields });

    return {
      success: true,
      message: 'Card updated successfully',
      data: {
        card: updatedCard,
        fields: newFields,
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}


async linkDeviceToUser(user: any, dto: AddDeviceDto) {
  try {
    const deviceUrl = await this.databaseService.cardUrl.findFirst({
      where: {
        card_id: dto.card_id,
        device_type: dto.type,
      },
    });

    const card = await this.databaseService.businessCard.findFirst({
      where: { user_id: user.id },
    });

    if (!card) {
      return { success: false, message: 'Card not found' };
    }

    const device = await this.databaseService.cardUrl.updateMany({
      where: { card_id: dto.card_id },
      data: {
        user_id: user.id,
        firstuse: true,
        state: 'profile',
        profile_id: card.id,
      },
    });

    return {
      success: true,
      message: 'Device Added Successfully',
      data: {
        device,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}


  async confirmToken(dto: ConfirmTokenDto) {
    try {
      const deviceUrl = await this.databaseService.cardUrl.findUnique({
        where: { card_id: dto.card_id },
      });

      if (!deviceUrl) {
        throw new NotFoundException('Invalid device');
      }

      if (deviceUrl.user_id) {
        throw new BadRequestException('Card already in use');
      }

      const authToken = await this.databaseService.authToken.findFirst({
        where: {
          token: dto.token,
          used: false,
        },
      });

      if (!authToken) {
        throw new BadRequestException('Invalid token');
      }

      await this.databaseService.authToken.updateMany({
        where: { token: dto.token },
        data: { used: true },
      });

      return {
        success: true,
        message: 'Valid token',
        data: { token: dto.token },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async confirmCardId(dto: ConfirmCardIdDto) {
    try {
      const deviceUrl = await this.databaseService.cardUrl.findUnique({
        where: { card_id: dto.card_id },
      });

      if (!deviceUrl || deviceUrl.state === 'profile') {
        throw new BadRequestException('Invalid device');
      }

      return {
        success: true,
        message: 'Valid device',
        data: {
          info: deviceUrl,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }



  async getCardRoute(cardId: string, type: string) {
    try {
      if (!cardId) {
        return {
          success: false,
          message: 'No card ID set',
        };
      }

      const card = await this.databaseService.cardUrl.findFirst({
        where: {
          card_id: cardId,
          device_type: '6214bdef7dbcb',
        },
      });

      if (!card) {
        return {
          success: false,
          message: 'Card does not exist',
        };
      }

      if (card.state === 'blank') {
        return {
          success: true,
          message: "Card is blank and hasn't been used",
          data: {
            redirect_url: `/login?id=${cardId}&type=${type}`,
          },
        };
      }

      if (card.state === 'register') {
        return {
          success: true,
          message: 'Get started',
          data: {
            redirect_url: `/enter-token?id=${cardId}&type=${type}`,
          },
        };
      }

      if (card.state === 'login') {
        return {
          success: true,
          message: 'Welcome back',
          data: {
            redirect_url: `/login?id=${cardId}&type=${type}`,
          },
        };
      }

      if (card.state !== 'profile') {
        return {
          success: false,
          message: 'Unable to display page',
        };
      }

      return {
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          redirect_url: `/vcard/connect?id=${cardId}&type=${type}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }



  async getCardProfile(id: string, type: string) {
    try {
      if (!id) {
        return {
          success: false,
          message: 'No card ID set',
        };
      }

      const cardUrl = await this.databaseService.cardUrl.findFirst({
        where: {
          card_id: id,
          device_type: type,
        },
      });

      if (!cardUrl || cardUrl.state !== 'profile') {
        return {
          success: false,
          message: 'Unable to display page',
        };
      }

      const businessCard = await this.databaseService.businessCard.findFirst({
        where: {
          id: cardUrl.profile_id,
        },
      });

      // const user = await this.databaseService.user.findFirst({
      //   where: {
      //     user_id: cardUrl.user_id,
      //     status: 1,
      //     plan_validity: {
      //       gte: new Date(),
      //     },
      //   },
      // });

      if (!businessCard) {
        return {
          success: false,
          message: 'Invalid',
        };
      }

      const businessCardDetails = await this.databaseService.businessCard.findFirst({
        where: { id: businessCard.id },
      });

      if (!businessCardDetails) {
        return {
          success: false,
          message: 'Sorry, Please fill basic business details.',
        };
      }

      const fields = await this.databaseService.businessField.findMany({
        where: { card_id: businessCard.id },
      });

      return {
        success: true,
        message: 'Data retrieved successfully',
        data: {
          card: businessCardDetails,
          fields,
          download_url: `${process.env.BASE_URL || 'https://yourdomain.com'}/api/vcard-download?id=${id}&type=${type}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }


  async generateVcardProfile(id: string, type: string) {
    try {
      const card = await this.databaseService.cardUrl.findFirst({
        where: { card_id: id, device_type: type },
      });

      if (!card) {
        return {
          success: false,
          message: 'Card does not exist',
        };
      }

      const businessCard = await this.databaseService.businessCard.findFirst({
        where: { id: card.profile_id },
      });

      if (!businessCard) {
        return {
          success: false,
          message: 'No business card set',
        };
      }

      const fields = await this.databaseService.businessField.findMany({
        where: { card_id: businessCard.id },
      });

      const vcardUrl = `https://isce.app/vcard/connect?id=${id}&type=${type}`;
      const vcard = new vCardsJS();
      vcard.firstName = businessCard.title;
      vcard.jobTitle = businessCard.sub_title;
      vcard.url = vcardUrl;

      for (const field of fields) {
        switch (field.type) {
          case 'email':
            vcard.email = field.content;
            break;
          case 'tel':
            vcard.workPhone = field.content;
            break;
          case 'wa':
            vcard.cellPhone = field.content;
            break;
          case 'url':
            vcard.url = field.content;
            break;
          case 'address':
            vcard.homeAddress.label = field.content;
            break;
        }
      }

      return {
        headers: vcard.getHeaders(),
        content: vcard.getFormattedString(),
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
