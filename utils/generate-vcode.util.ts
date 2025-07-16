import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class CodeGenerator {
  constructor(private readonly prisma: DatabaseService) {}

  async generateUniqueVCode(): Promise<string> {
    const PREFIX = 'EDO';
    const CODE_LENGTH = 6;

    const generateRandomDigits = (): string => {
      let digits = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        digits += Math.floor(Math.random() * 10); // random 0-9
      }
      return digits;
    };

    let isUnique = false;
    let finalCode = '';

    while (!isUnique) {
      const randomDigits = generateRandomDigits();
      finalCode = `${PREFIX}${randomDigits}`;

      // // Check if code already exists
      // const existingRecord = await this.prisma.property.findUnique({
      //   where: { vcode: finalCode }, // Replace 'vcode' with your actual unique field name
      // });

      // if (!existingRecord) {
      //   isUnique = true;
      // }
    }

    return finalCode;
  }
}
