export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export interface PaymentInitResult {
  paymentId: string;
  redirectUrl?: string;
  providerRef?: string;
}

export interface PaymentProvider {
  initiate(params: {
    amount: number;
    bookingId: string;
    idempotencyKey: string;
    callbackUrl: string;
  }): Promise<PaymentInitResult>;
  verify(providerRef: string): Promise<{ success: boolean; amount?: number }>;
}
