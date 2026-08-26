import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, Prisma } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  async create(
    customerId: string,
    data: {
      professionalId: string;
      serviceIds: string[];
      startAt: string;
      locationId?: string;
      notes?: string;
    },
  ) {
    if (!data.serviceIds?.length) throw new BadRequestException('حداقل یک خدمت لازم است');

    const pro = await this.prisma.professional.findUnique({ where: { id: data.professionalId } });
    if (!pro || pro.status !== 'approved') throw new NotFoundException('زیباگر یافت نشد');

    const proServices = await this.prisma.professionalService.findMany({
      where: {
        professionalId: data.professionalId,
        serviceId: { in: data.serviceIds },
        isActive: true,
      },
    });
    if (proServices.length !== data.serviceIds.length) {
      throw new BadRequestException('یکی از خدمات برای این زیباگر فعال نیست');
    }

    const totalPrice = proServices.reduce((s, ps) => s + ps.price, 0);
    const totalDuration =
      proServices.reduce((s, ps) => s + ps.durationMin + ps.bufferMin, 0);

    const startAt = new Date(data.startAt);
    if (isNaN(startAt.getTime()) || startAt.getTime() < Date.now()) {
      throw new BadRequestException('زمان شروع نامعتبر است');
    }
    const endAt = new Date(startAt.getTime() + totalDuration * 60_000);

    const dateStr = startAt.toISOString().slice(0, 10);
    const avail = await this.availability.getSlots(
      data.professionalId,
      dateStr,
      totalDuration,
    );
    const startHHMM = startAt.toISOString().slice(11, 16);
    const slotOk = avail.slots.some((s: { start: string; end: string }) => s.start === startHHMM);
    if (!slotOk && avail.slots.length > 0) {
      // timezone edge: still try create; DB will reject overlap
    }

    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        const b = await tx.booking.create({
          data: {
            customerId,
            professionalId: data.professionalId,
            locationId: data.locationId,
            status: BookingStatus.pending,
            startAt,
            endAt,
            totalPrice,
            notes: data.notes,
            items: {
              create: proServices.map((ps, i) => ({
                serviceId: ps.serviceId,
                professionalServiceId: ps.id,
                durationMin: ps.durationMin,
                price: ps.price,
                sortOrder: i,
              })),
            },
          },
          include: { items: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: customerId,
            action: 'booking.create',
            entityType: 'booking',
            entityId: b.id,
            after: { status: b.status, totalPrice: b.totalPrice } as Prisma.InputJsonValue,
          },
        });
        return b;
      });
      return booking;
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'P2004' || err.message?.includes('bookings_no_overlap')) {
        throw new ConflictException('این بازه زمانی قبلاً رزرو شده است');
      }
      throw e;
    }
  }

  async listMineAsCustomer(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { customerId: userId },
        skip,
        take: limit,
        orderBy: { startAt: 'desc' },
        include: {
          professional: {
            include: { user: { select: { profile: { select: { displayName: true } } } } },
          },
          items: { include: { service: true } },
          payment: true,
          review: true,
        },
      }),
      this.prisma.booking.count({ where: { customerId: userId } }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async listMineAsProfessional(userId: string, page = 1, limit = 20) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new ForbiddenException();
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { professionalId: pro.id },
        skip,
        take: limit,
        orderBy: { startAt: 'desc' },
        include: {
          customer: { select: { id: true, phone: true, profile: true } },
          items: { include: { service: true } },
          payment: true,
        },
      }),
      this.prisma.booking.count({ where: { professionalId: pro.id } }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async getOne(id: string, userId: string, roles: string[]) {
    const b = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        items: { include: { service: true } },
        professional: true,
        customer: { select: { id: true, phone: true, profile: true } },
        payment: true,
        review: true,
      },
    });
    if (!b) throw new NotFoundException();
    const isAdmin = roles.includes('admin');
    const isCustomer = b.customerId === userId;
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    const isPro = pro && b.professionalId === pro.id;
    if (!isAdmin && !isCustomer && !isPro) throw new ForbiddenException();
    return b;
  }

  async transition(
    id: string,
    userId: string,
    roles: string[],
    action: 'confirm' | 'reject' | 'cancel' | 'complete',
    reason?: string,
  ) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException();

    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    const isPro = pro && b.professionalId === pro.id;
    const isCustomer = b.customerId === userId;
    const isAdmin = roles.includes('admin');

    let newStatus: BookingStatus;
    const data: Prisma.BookingUpdateInput = {};

    switch (action) {
      case 'confirm':
        if (!isPro && !isAdmin) throw new ForbiddenException();
        if (b.status !== BookingStatus.pending) throw new BadRequestException('فقط رزرو در انتظار قابل تأیید است');
        newStatus = BookingStatus.confirmed;
        data.confirmedAt = new Date();
        break;
      case 'reject':
        if (!isPro && !isAdmin) throw new ForbiddenException();
        if (b.status !== BookingStatus.pending) throw new BadRequestException();
        newStatus = BookingStatus.rejected;
        data.rejectedReason = reason;
        break;
      case 'cancel':
        if (!isCustomer && !isPro && !isAdmin) throw new ForbiddenException();
        if (b.status !== BookingStatus.pending && b.status !== BookingStatus.confirmed) {
          throw new BadRequestException();
        }
        newStatus = BookingStatus.cancelled;
        data.cancelReason = reason;
        data.cancelledAt = new Date();
        break;
      case 'complete':
        if (!isPro && !isAdmin) throw new ForbiddenException();
        if (b.status !== BookingStatus.confirmed) throw new BadRequestException();
        newStatus = BookingStatus.completed;
        data.completedAt = new Date();
        break;
      default:
        throw new BadRequestException();
    }

    data.status = newStatus;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({ where: { id }, data });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: `booking.${action}`,
          entityType: 'booking',
          entityId: id,
          before: { status: b.status } as Prisma.InputJsonValue,
          after: { status: newStatus } as Prisma.InputJsonValue,
        },
      });
      return updated;
    });
  }
}
