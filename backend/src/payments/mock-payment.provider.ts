import { Injectable } from '@nestjs/common';
import { PaymentProvider, CreatePaymentInput, PaymentResult } from './payment.provider';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const ref = `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      success: true,
      providerRef: ref,
      redirectUrl: input.callbackUrl
        ? `${input.callbackUrl}?status=ok&ref=${ref}`
        : undefined,
      raw: { mock: true, amount: input.amount, currency: input.currency },
    };
  }

  async verifyPayment(providerRef: string): Promise<PaymentResult> {
    return {
      success: true,
      providerRef,
      raw: { mock: true, verified: true },
    };
  }

  async refund(providerRef: string, amount?: number): Promise<PaymentResult> {
    return {
      success: true,
      providerRef,
      raw: { mock: true, refunded: true, amount },
    };
  }
}
