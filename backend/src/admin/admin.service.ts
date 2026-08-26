import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalStatus, Prisma } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const [users, professionals, bookings, reviews] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.professional.count(),
      this.prisma.booking.count(),
      this.prisma.review.count(),
    ]);
    const byStatus = await this.prisma.booking.groupBy({
      by: ['status'],
      _count: true,
    });
    return { users, professionals, bookings, reviews, bookingsByStatus: byStatus };
  }

  async listUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
          userRoles: { include: { role: true } },
          professional: { select: { id: true, status: true, slug: true } },
        },
      }),
      this.prisma.user.count(),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async listProfessionals(page = 1, limit = 20, status?: ProfessionalStatus) {
    const skip = (page - 1) * limit;
    const where: Prisma.ProfessionalWhereInput = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { include: { profile: true } },
        },
      }),
      this.prisma.professional.count({ where }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async setProfessionalStatus(id: string, status: ProfessionalStatus) {
    const pro = await this.prisma.professional.findUnique({ where: { id } });
    if (!pro) throw new NotFoundException();
    return this.prisma.professional.update({
      where: { id },
      data: {
        status,
        verifiedAt: status === ProfessionalStatus.approved ? new Date() : pro.verifiedAt,
      },
    });
  }

  async listBookings(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { phone: true, profile: { select: { displayName: true } } } },
          professional: { select: { title: true, slug: true } },
        },
      }),
      this.prisma.booking.count(),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async listAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { items, meta: { page, limit, total } };
  }
}
