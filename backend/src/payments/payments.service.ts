import { Injectable, NotFoundException, ForbiddenException, Inject, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment.provider';
import { randomUUID } from 'crypto';
import {
  calculateCommission,
  DEFAULT_PLATFORM_COMMISSION_RATE,
  PLATFORM_COMMISSION_RATE_KEY,
} from './financial.util';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async initiate(userId: string, bookingId: string, callbackUrl: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking) throw new NotFoundException();
    if (booking.customerId !== userId) throw new ForbiddenException();
    if (booking.payment?.status === 'paid') throw new ConflictException('قبلاً پرداخت شده');

    const idempotencyKey = booking.payment?.idempotencyKey || randomUUID();

    if (!booking.payment) {
      await this.prisma.payment.create({
        data: {
          bookingId,
          amount: booking.totalPrice,
          status: 'pending',
          provider: 'mock',
          idempotencyKey,
        },
      });
    }

    const result = await this.provider.initiate({
      amount: booking.totalPrice,
      bookingId,
      idempotencyKey,
      callbackUrl,
    });

    await this.prisma.payment.update({
      where: { bookingId },
      data: { providerRef: result.providerRef, status: 'processing' },
    });

    return result;
  }

  async callback(providerRef: string) {
    const payment = await this.prisma.payment.findFirst({ where: { providerRef } });
    if (!payment) throw new NotFoundException();
    // Idempotency check: If already paid, return early without recomputing commission or modifying snapshot
    if (payment.status === 'paid') return { status: 'paid', bookingId: payment.bookingId };

    const verified = await this.provider.verify(providerRef);
    if (!verified.success) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed', failedAt: new Date() },
      });
      return { status: 'failed', bookingId: payment.bookingId };
    }

    // Retrieve active commission rate from PlatformSetting, or fallback to DEFAULT_PLATFORM_COMMISSION_RATE (10%)
    let rate = DEFAULT_PLATFORM_COMMISSION_RATE;
    try {
      const setting = await this.prisma.platformSetting.findUnique({
        where: { key: PLATFORM_COMMISSION_RATE_KEY },
      });
      if (setting && setting.value !== null && setting.value !== undefined) {
        const val = typeof setting.value === 'number' 
          ? setting.value 
          : (typeof setting.value === 'object' && 'rate' in (setting.value as any))
            ? Number((setting.value as any).rate)
            : Number(setting.value);
        if (!isNaN(val) && val >= 0 && val <= 100) {
          rate = val;
        }
      }
    } catch {
      rate = DEFAULT_PLATFORM_COMMISSION_RATE;
    }

    const { commissionRate, commissionAmount, professionalNetAmount } = calculateCommission(
      payment.amount,
      rate,
    );

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        platformCommissionRate: commissionRate,
        platformCommissionAmount: commissionAmount,
        professionalNetAmount: professionalNetAmount,
      },
    });
    return { status: 'paid', bookingId: payment.bookingId };
  }
}
