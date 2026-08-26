import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms.provider';

@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(`[MOCK SMS OTP] to=${phone} code=${code}`);
  }

  async sendNotification(phone: string, message: string): Promise<void> {
    this.logger.log(`[MOCK SMS] to=${phone} msg=${message}`);
  }
}
