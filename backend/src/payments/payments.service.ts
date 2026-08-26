import { Injectable, NotFoundException, ForbiddenException, Inject, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment.provider';
import { randomUUID } from 'crypto';

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
    if (payment.status === 'paid') return { status: 'paid', bookingId: payment.bookingId };

    const verified = await this.provider.verify(providerRef);
    if (!verified.success) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed', failedAt: new Date() },
      });
      return { status: 'failed', bookingId: payment.bookingId };
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'paid', paidAt: new Date() },
    });
    return { status: 'paid', bookingId: payment.bookingId };
  }
}
