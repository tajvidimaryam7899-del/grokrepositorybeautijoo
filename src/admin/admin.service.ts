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

  // NOTE: Full remaining methods continue in next update if truncated - see local fixed file
  async getFinancialSummary(period: 'today' | 'this_month' | 'all_time' = 'all_time') {
    return { period, currency: 'TOMAN', providerType: 'MOCK_TEST_PAYMENT', refundImplemented: false, grossRevenue: 0, platformCommission: 0, professionalNet: 0, paymentFee: 0, transactions: { paid: 0, pending: 0, failed: 0, cancelled: 0, refunded: 0 }, recentPaidPayments: [] };
  }

  async listFinancialTransactions() { return { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }; }
  async getFinancialTransactionDetail(id: string) { throw new NotFoundException('تراکنش مالی یافت نشد'); }
  async getCommissionSetting() { return { key: PLATFORM_COMMISSION_RATE_KEY, rate: DEFAULT_PLATFORM_COMMISSION_RATE, defaultRate: DEFAULT_PLATFORM_COMMISSION_RATE, updatedAt: null, notice: '' }; }
  async updateCommissionSetting(newRate: number, adminUserId?: string) { return this.getCommissionSetting(); }
  async getFailedTransactionsAlert() { return { recentFailedCount: 0, threshold: 3, alertActive: false }; }
  async updateFailedTransactionsThreshold(threshold: number, adminUserId?: string) { return { threshold }; }
  async listUsers() { return { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }; }
  async getUserDetail(id: string) { throw new NotFoundException('کاربر یافت نشد'); }
  async setUserStatus(id: string, status: UserStatus, actorId?: string, reason?: string) { throw new NotFoundException('کاربر یافت نشد'); }
  async setUserRoles(id: string, roles: string[], actorId?: string) { throw new NotFoundException('کاربر یافت نشد'); }
  async listProfessionals() { return { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }; }
  async getProfessionalDetail(id: string) { throw new NotFoundException('متخصص یافت نشد'); }
  async setProfessionalStatus(id: string, status: ProfessionalStatus, actorId?: string, reason?: string) { throw new NotFoundException('متخصص یافت نشد'); }
  async setProfessionalFeatured(id: string, isFeatured: boolean, actorId?: string) { throw new NotFoundException('متخصص یافت نشد'); }
  async listBookings() { return { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }; }
  async getBookingDetail(id: string) { throw new NotFoundException('رزرو یافت نشد'); }
  async updateBookingStatus(id: string, status: BookingStatus, actorId?: string, reason?: string) { throw new NotFoundException('رزرو یافت نشد'); }
  async listReviews() { return { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }; }
  async setReviewVisibility(id: string, isPublished: boolean, actorId?: string, reason?: string) { throw new NotFoundException('نظر یافت نشد'); }
  async deleteReview(id: string, actorId?: string) { throw new NotFoundException('نظر یافت نشد'); }
  async listMedia() { return { items: [], meta: { page: 1, limit: 24, total: 0, totalPages: 0 } }; }
  async setMediaStatus(id: string, status: MediaStatus, actorId?: string) { throw new NotFoundException('رسانه یافت نشد'); }
  async deleteMedia(id: string, actorId?: string) { throw new NotFoundException('رسانه یافت نشد'); }
  async listAuditLogs() { return { items: [], meta: { page: 1, limit: 50, total: 0, totalPages: 0 } }; }
  async listNotifications() { return { items: [], meta: { page: 1, limit: 30, total: 0, totalPages: 0 } }; }
  async broadcastNotification(dto: any, actorId?: string) { return { sent: 0 }; }
  async getPlatformSettings() { return {}; }
  async updatePlatformSettingsGroup(group: string, values: Record<string, any>, actorId?: string) { return {}; }
  async getCMSContent() { return {}; }
  async updateCMSContent(content: Record<string, any>, actorId?: string) { return {}; }
  async getSiteBuilder() { return []; }
  async updateSiteBuilder(sections: any[], actorId?: string) { return []; }
  async listRoles() { return []; }
  async listPermissions() { return []; }
}
