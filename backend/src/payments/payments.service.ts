import { Injectable, NotFoundException, ForbiddenException, Inject, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment.provider';
import { randomUUID } from 'crypto';
import {
  calculateCommissionSplit,
  DEFAULT_COMMISSION_RATE_PERCENT,
  PLATFORM_COMMISSION_RATE_KEY,
} from './commission.util';

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

  /**
   * Current platform commission rate (percent), read from PlatformSetting.
   * Falls back to DEFAULT_COMMISSION_RATE_PERCENT if no admin has set one
   * yet — that fallback is never written back to the database on its own;
   * it only takes effect the moment a real Payment is snapshotted.
   */
  async getCommissionRatePercent(): Promise<number> {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key: PLATFORM_COMMISSION_RATE_KEY },
    });
    if (!setting) return DEFAULT_COMMISSION_RATE_PERCENT;
    const value = setting.value as unknown as { rate?: number };
    const rate = Number(value?.rate);
    return Number.isFinite(rate) ? rate : DEFAULT_COMMISSION_RATE_PERCENT;
  }

  async callback(providerRef: string) {
    const payment = await this.prisma.payment.findFirst({ where: { providerRef } });
    if (!payment) throw new NotFoundException();

    // Idempotency: once a Payment is `paid`, this is a no-op — no matter how
    // many times the gateway (or an attacker) replays the callback. The
    // commission snapshot below only ever runs on the first transition into
    // `paid`, precisely because this check returns before reaching it.
    if (payment.status === 'paid') return { status: 'paid', bookingId: payment.bookingId };

    const verified = await this.provider.verify(providerRef);
    if (!verified.success) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed', failedAt: new Date() },
      });
      return { status: 'failed', bookingId: payment.bookingId };
    }

    // Commission snapshot — computed exactly once, right here, at the only
    // point in the codebase where a Payment first becomes `paid`. The rate
    // used is whatever is configured *right now*; once written, it is never
    // recomputed even if the platform rate changes later.
    const ratePercent = await this.getCommissionRatePercent();
    const { commissionAmount, professionalNetAmount } = calculateCommissionSplit(
      payment.amount,
      ratePercent,
    );

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        platformCommissionRate: ratePercent,
        platformCommissionAmount: commissionAmount,
        professionalNetAmount,
      },
    });
    return { status: 'paid', bookingId: payment.bookingId };
  }
}
