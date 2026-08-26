export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface CreatePaymentInput {
  amount: number;
  currency: string;
  description?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  success: boolean;
  providerRef: string;
  redirectUrl?: string;
  raw?: unknown;
}

export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  verifyPayment(providerRef: string): Promise<PaymentResult>;
  refund(providerRef: string, amount?: number): Promise<PaymentResult>;
}
