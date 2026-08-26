import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMS_PROVIDER } from './sms.provider';
import { MockSmsProvider } from './mock-sms.provider';

@Global()
@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      useFactory: (config: ConfigService) => {
        return new MockSmsProvider();
      },
      inject: [ConfigService],
    },
    MockSmsProvider,
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
