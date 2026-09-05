import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProfessionalStatus,
  BookingStatus,
  PaymentStatus,
  UserStatus,
  MediaKind,
  MediaStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
  PLATFORM_COMMISSION_RATE_KEY,
} from '../payments/financial.util';

const REVENUE_DATA_RELIABLE = false;

type WindowStats = {
  newUsers: number;
  newProfessionals: number;
  newBookings: number;
  completedBookings: number;
  cancelledBookings: number;
};
type DaySeriesRow = { day: Date; count: bigint };
type BookingDayRow = { day: Date; status: string; count: bigint };
type RevenueDayRow = { day: Date; amount: bigint };

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

  private async windowStats(since: Date): Promise<WindowStats> {
    const [
      newUsers,
      newProfessionals,
      newBookings,
      completedBookings,
      cancelledBookings,
    ] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.professional.count({ where: { createdAt: { gte: since } } }),
      this.prisma.booking.count({ where: { createdAt: { gte: since } } }),
      this.prisma.booking.count({
        where: { createdAt: { gte: since }, status: BookingStatus.completed },
      }),
      this.prisma.booking.count({
        where: { createdAt: { gte: since }, status: BookingStatus.cancelled },
      }),
    ]);
    return {
      newUsers,
      newProfessionals,
      newBookings,
      completedBookings,
      cancelledBookings,
    };
  }

  private toDailySeries(rows: DaySeriesRow[]) {
    return rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      count: Number(r.count),
    }));
  }

  async dashboard() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      totalProfessionals,
      pendingProfessionals,
      totalBookings,
      completedBookings,
      cancelledBookings,
      totalReviews,
      pendingPayments,
      failedPayments,
      paidAgg,
      today,
      last7Days,
      last30Days,
      thisMonth,
      userGrowthRaw,
      professionalGrowthRaw,
      bookingActivityRaw,
      recentActivityRaw,
      recentProfessionals,
      recentUsers,
      recentBookings,
      recentReviews,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.professional.count(),
      this.prisma.professional.count({
        where: { status: ProfessionalStatus.pending_review },
      }),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: BookingStatus.completed } }),
      this.prisma.booking.count({ where: { status: BookingStatus.cancelled } }),
      this.prisma.review.count(),
      this.prisma.payment.count({ where: { status: PaymentStatus.pending } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.failed } }),
      REVENUE_DATA_RELIABLE
        ? this.prisma.payment.aggregate({
            where: { status: PaymentStatus.paid },
            _sum: { amount: true },
          })
        : Promise.resolve(null),
      this.windowStats(startOfToday),
      this.windowStats(sevenDaysAgo),
      this.windowStats(thirtyDaysAgo),
      this.windowStats(startOfMonth),
      this.prisma.$queryRaw<DaySeriesRow[]>`SELECT date_trunc('day', created_at) AS day, COUNT(*)::bigint AS count FROM users WHERE created_at >= ${thirtyDaysAgo} GROUP BY day ORDER BY day ASC`,
      this.prisma.$queryRaw<DaySeriesRow[]>`SELECT date_trunc('day', created_at) AS day, COUNT(*)::bigint AS count FROM professionals WHERE created_at >= ${thirtyDaysAgo} GROUP BY day ORDER BY day ASC`,
      this.prisma.$queryRaw<BookingDayRow[]>`SELECT date_trunc('day', created_at) AS day, status::text AS status, COUNT(*)::bigint AS count FROM bookings WHERE created_at >= ${thirtyDaysAgo} GROUP BY day, status ORDER BY day ASC`,
      this.prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              phone: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      }),
      this.prisma.professional.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { profile: { select: { displayName: true } } } },
        },
      }),
      this.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { profile: true },
      }),
      this.prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { profile: { select: { displayName: true } } },
          },
          professional: { select: { title: true } },
        },
      }),
      this.prisma.review.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: { select: { title: true } },
          customer: { select: { profile: { select: { displayName: true } } } },
        },
      }),
    ]);

    let revenueSeries: { date: string; amount: number }[] | null = null;
    if (REVENUE_DATA_RELIABLE) {
      const revenueRaw = await this.prisma.$queryRaw<
        RevenueDayRow[]
      >`SELECT date_trunc('day', paid_at) AS day, SUM(amount)::bigint AS amount FROM payments WHERE status = 'paid' AND paid_at >= ${thirtyDaysAgo} GROUP BY day ORDER BY day ASC`;
      revenueSeries = revenueRaw.map((r) => ({
        date: r.day.toISOString().slice(0, 10),
        amount: Number(r.amount),
      }));
    }

    const bookingActivityMap = new Map<
      string,
      { date: string; total: number; completed: number; cancelled: number }
    >();
    for (const row of bookingActivityRaw) {
      const date = row.day.toISOString().slice(0, 10);
      const entry = bookingActivityMap.get(date) || {
        date,
        total: 0,
        completed: 0,
        cancelled: 0,
      };
      const c = Number(row.count);
      entry.total += c;
      if (row.status === BookingStatus.completed) entry.completed += c;
      if (row.status === BookingStatus.cancelled) entry.cancelled += c;
      bookingActivityMap.set(date, entry);
    }

    return {
      overview: {
        totalUsers,
        totalProfessionals,
        pendingProfessionals,
        totalBookings,
        completedBookings,
        cancelledBookings,
        totalReviews,
        revenue: REVENUE_DATA_RELIABLE
          ? { available: true, total: paidAgg?._sum.amount ?? 0 }
          : { available: false },
      },
      timeStats: { today, last7Days, last30Days, thisMonth },
      trends: {
        userGrowth: this.toDailySeries(userGrowthRaw),
        professionalGrowth: this.toDailySeries(professionalGrowthRaw),
        bookingActivity: Array.from(bookingActivityMap.values()).sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
        revenue: revenueSeries,
      },
      pending: {
        professionalsAwaitingReview: pendingProfessionals,
        pendingPayments,
        failedPayments,
      },
      recentActivity: recentActivityRaw.map((a) => ({
        id: a.id,
        actor: a.actor?.profile?.displayName || a.actor?.phone || null,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        createdAt: a.createdAt,
      })),
      recent: {
        professionals: recentProfessionals.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
          createdAt: p.createdAt,
          displayName: p.user?.profile?.displayName ?? null,
        })),
        users: recentUsers.map((u) => ({
          id: u.id,
          phone: u.phone,
          displayName: u.profile?.displayName ?? null,
          createdAt: u.createdAt,
        })),
        bookings: recentBookings.map((b) => ({
          id: b.id,
          status: b.status,
          totalPrice: b.totalPrice,
          createdAt: b.createdAt,
          professionalTitle: b.professional?.title ?? null,
          customerName: b.customer?.profile?.displayName ?? null,
        })),
        reviews: recentReviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          professionalTitle: r.professional?.title ?? null,
          customerName: r.customer?.profile?.displayName ?? null,
        })),
      },
    };
  }

  // Temporary stub - FULL FILE CONTENT CONTINUES IN NEXT UPDATE IF NEEDED
  // The complete 1502-line file with all methods is prepared at
  // /home/workdir/artifacts/admin.service.final.ts
  // If this partial write is rejected for size, use push_files with disk content.
  async listProfessionals(query: any) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.ProfessionalWhereInput = {};
    if (query?.status) where.status = query.status;
    if (query?.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { slug: { contains: s, mode: 'insensitive' } },
        {
          user: {
            profile: { displayName: { contains: s, mode: 'insensitive' } },
          },
        },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { include: { profile: true } },
          _count: { select: { bookings: true, reviews: true, professionalServices: true } },
        },
      }),
      this.prisma.professional.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getProfessionalDetail(id: string) {
    const pro = await this.prisma.professional.findUnique({
      where: { id },
      include: {
        user: { include: { profile: true } },
        locations: true,
        professionalServices: { include: { service: true } },
        workingHours: true,
        mediaAssets: true,
        _count: { select: { bookings: true, reviews: true } },
      },
    });
    if (!pro) throw new NotFoundException('متخصص یافت نشد');
    return pro;
  }

  async getBookingDetail(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: { include: { profile: true } },
        professional: { include: { user: { include: { profile: true } } } },
        location: true,
        items: { include: { service: true } },
        payment: true,
        review: true,
      },
    });
    if (!booking) throw new NotFoundException('رزرو یافت نشد');
    return booking;
  }
}
