import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: { bookingId: string; rating: number; comment?: string }) {
    if (data.rating < 1 || data.rating > 5) throw new BadRequestException('امتیاز باید ۱ تا ۵ باشد');
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: { review: true },
    });
    if (!booking) throw new NotFoundException();
    if (booking.customerId !== userId) throw new ForbiddenException();
    if (booking.status !== 'completed') throw new BadRequestException('فقط پس از تکمیل نوبت می‌توانید نظر دهید');
    if (booking.review) throw new ConflictException('قبلاً نظر ثبت شده است');

    const review = await this.prisma.$transaction(async (tx) => {
      const r = await tx.review.create({
        data: {
          bookingId: data.bookingId,
          customerId: userId,
          professionalId: booking.professionalId,
          rating: data.rating,
          comment: data.comment,
        },
      });
      const agg = await tx.review.aggregate({
        where: { professionalId: booking.professionalId, isPublished: true },
        _avg: { rating: true },
        _count: true,
      });
      await tx.professional.update({
        where: { id: booking.professionalId },
        data: {
          ratingAvg: agg._avg.rating || 0,
          ratingCount: agg._count,
        },
      });
      return r;
    });
    return review;
  }
}
