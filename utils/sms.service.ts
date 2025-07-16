import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TermiService {
  constructor(private configService: ConfigService) {}
  private readonly apiKey = this.configService.get('TERMII_API_KEY');
  private readonly senderId = this.configService.get('TERMII_SENDER_ID');
  private readonly baseUrl = this.configService.get('TERMII_BASE_URL');

  async sendSms(phone: string, name: string, resetCode: string): Promise<any> {
    const newUrl = `${this.baseUrl}/api/sms/send`;

    try {
      const message = `Hi ${name}, here is your Pasword Reset Code: ${resetCode}. Anambra State IRS: +2347066727750 or +2349053234816`;

      function removeFirstDigit(phoneNumber: string) {
        return phoneNumber.toString().slice(1);
      }
      const phoneNumber = removeFirstDigit(phone);
      const formattedPhone = `+234${phoneNumber}`;

      const response = await axios.post(newUrl, {
        to: formattedPhone,
        from: this.senderId,
        sms: message,
        type: 'plain',
        channel: 'generic',
        api_key: this.apiKey,
      });

      if (response.data && response.data.message === 'Successfully Sent') {
        console.log(`SMS sent successfully to ${formattedPhone}`);
        return `SMS sent successfully to ${formattedPhone}`;
      } else {
        console.error(`Failed to send SMS: ${response.data.message}`);
        throw new Error(`Failed to send SMS: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Error sending SMS:', error.message, error.response.data);
      throw new Error('Failed to send SMS due to an internal error.');
    }
  }



  async sendOwingSms(phone: string, firstName: string, amount: number, modelName: string, plateNumber: string): Promise<any> {
    const newUrl = `${this.baseUrl}/api/sms/send`;

    try {
      const message = `Hi ${firstName}, You owe ₦${amount.toLocaleString()} on your ${modelName.toUpperCase()} vehicle (${plateNumber}). Kindly settle this debt before the end of today to avoid penalties. Anambra State IRS: +2347066727750 or +2349053234816 `;

      const response = await axios.post(newUrl, {
        to: phone,
        from: this.senderId,
        sms: message,
        type: 'plain',
        channel: 'generic',
        api_key: this.apiKey,
      });

      if (response.data && response.data.message === 'Successfully Sent') {
        console.log(`SMS sent successfully to ${phone}`);
        return `SMS sent successfully to ${phone}`;
      } else {
        console.error(`Failed to send SMS: ${response.data.message}`);
        throw new Error(`Failed to send SMS: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Error sending SMS:', error.message);
      throw new Error('Failed to send SMS due to an internal error.');
    }
  }


  async sendPlainSms(phone: string, message: string): Promise<any> {
    const newUrl = `${this.baseUrl}/api/sms/send`;

    try {
      const response = await axios.post(newUrl, {
        to: phone,
        from: this.senderId,
        sms: message,
        type: 'plain',
        channel: 'generic',
        api_key: this.apiKey,
      });

      if (response.data && response.data.message === 'Successfully Sent') {
        console.log(`SMS sent successfully to ${phone}`);
        return `SMS sent successfully to ${phone}`;
      } else {
        console.error(`Failed to send SMS: ${response.data.message}`);
        throw new Error(`Failed to send SMS: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Error sending SMS:', error.message);
      throw new Error('Failed to send SMS due to an internal error.');
    }
  }
}
