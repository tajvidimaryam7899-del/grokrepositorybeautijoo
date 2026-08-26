import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment.provider';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async initiate(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking) throw new NotFoundException('رزرو یافت نشد');
    if (booking.customerId !== userId) throw new ForbiddenException();
    if (booking.payment) throw new BadRequestException('پرداخت قبلاً ثبت شده');

    const amount = Number(booking.totalAmount);
    const result = await this.provider.createPayment({
      amount,
      currency: 'IRR',
      description: `Booking ${bookingId}`,
      metadata: { bookingId, userId },
    });

    const payment = await this.prisma.payment.create({
      data: {
        bookingId,
        amount: booking.totalAmount,
        currency: 'IRR',
        status: result.success ? 'pending' : 'failed',
        provider: 'mock',
        providerRef: result.providerRef,
        rawResponse: result.raw as object,
      },
    });

    return {
      paymentId: payment.id,
      status: payment.status,
      redirectUrl: result.redirectUrl,
      providerRef: result.providerRef,
    };
  }

  async verify(userId: string, paymentId: string, providerRef?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException();
    if (payment.booking.customerId !== userId) throw new ForbiddenException();

    const ref = providerRef || payment.providerRef;
    if (!ref) throw new BadRequestException('providerRef required');

    const result = await this.provider.verifyPayment(ref);
    const status = result.success ? 'paid' : 'failed';

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status,
          providerRef: ref,
          paidAt: result.success ? new Date() : null,
          rawResponse: result.raw as object,
        },
      });
      if (result.success) {
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { status: 'confirmed' },
        });
      }
      return p;
    });

    return { paymentId: updated.id, status: updated.status };
  }

  async findOne(userId: string, id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException();
    if (payment.booking.customerId !== userId) throw new ForbiddenException();
    return payment;
  }

  async refund(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException();
    if (payment.status !== 'paid') throw new BadRequestException('only paid payments can be refunded');

    const result = await this.provider.refund(payment.providerRef!);
    if (!result.success) throw new BadRequestException('refund failed');

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'refunded', refundedAt: new Date() },
    });
  }
}
