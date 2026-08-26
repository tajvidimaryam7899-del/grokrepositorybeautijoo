import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PAYMENT_PROVIDER } from './payment.provider';
import { MockPaymentProvider } from './mock-payment.provider';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider },
    MockPaymentProvider,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
