import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider, PaymentInitResult } from './payment.provider';
import { randomUUID } from 'crypto';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);

  async initiate(params: {
    amount: number;
    bookingId: string;
    idempotencyKey: string;
    callbackUrl: string;
  }): Promise<PaymentInitResult> {
    const providerRef = `mock_${randomUUID()}`;
    this.logger.log(`[MOCK PAY] amount=${params.amount} booking=${params.bookingId}`);
    return {
      paymentId: params.idempotencyKey,
      providerRef,
      redirectUrl: `${params.callbackUrl}?ref=${providerRef}&status=ok`,
    };
  }

  async verify(providerRef: string) {
    this.logger.log(`[MOCK PAY VERIFY] ref=${providerRef}`);
    return { success: true };
  }
}
