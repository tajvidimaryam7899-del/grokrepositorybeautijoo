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

  // --- Financial Management ---
  async getFinancialSummary(
    period: 'today' | 'this_month' | 'all_time' = 'all_time',
  ) {
    const now = new Date();
    let startDate: Date | undefined;
    if (period === 'today')
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (period === 'this_month')
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateFilter = startDate ? { gte: startDate } : undefined;

    const [
      paidAggregate,
      paidCount,
      pendingCount,
      failedCount,
      cancelledCount,
      refundedCount,
      recentPaidPayments,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.paid,
          ...(dateFilter ? { paidAt: dateFilter } : {}),
        },
        _sum: {
          amount: true,
          platformCommissionAmount: true,
          professionalNetAmount: true,
        },
      }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.paid,
          ...(dateFilter ? { paidAt: dateFilter } : {}),
        },
      }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.pending,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.failed,
          ...(dateFilter ? { failedAt: dateFilter } : {}),
        },
      }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.cancelled,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.refunded,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.paid,
          ...(dateFilter ? { paidAt: dateFilter } : {}),
        },
        orderBy: { paidAt: 'desc' },
        take: 10,
        select: {
          id: true,
          amount: true,
          platformCommissionRate: true,
          platformCommissionAmount: true,
          professionalNetAmount: true,
          provider: true,
          providerRef: true,
          paidAt: true,
          booking: {
            select: {
              id: true,
              customer: {
                select: {
                  phone: true,
                  profile: { select: { displayName: true } },
                },
              },
              professional: { select: { title: true, slug: true } },
            },
          },
        },
      }),
    ]);

    return {
      period,
      currency: 'TOMAN',
      providerType: 'MOCK_TEST_PAYMENT',
      refundImplemented: false,
      grossRevenue: paidAggregate._sum.amount ?? 0,
      platformCommission: paidAggregate._sum.platformCommissionAmount ?? 0,
      professionalNet: paidAggregate._sum.professionalNetAmount ?? 0,
      paymentFee: 0,
      transactions: {
        paid: paidCount,
        pending: pendingCount,
        failed: failedCount,
        cancelled: cancelledCount,
        refunded: refundedCount,
      },
      recentPaidPayments,
    };
  }

  async listFinancialTransactions(query: {
    page?: number;
    limit?: number;
    status?: PaymentStatus;
    provider?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: 'createdAt' | 'paidAt' | 'amount';
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.PaymentWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.provider)
      where.provider = { equals: query.provider, mode: 'insensitive' };
    if (query.startDate || query.endDate) {
      const dateRange: Prisma.DateTimeFilter = {};
      if (query.startDate) dateRange.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        dateRange.lte = end;
      }
      where.createdAt = dateRange;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { providerRef: { contains: term, mode: 'insensitive' } },
        { idempotencyKey: { contains: term, mode: 'insensitive' } },
        { booking: { customer: { phone: { contains: term } } } },
        {
          booking: {
            customer: {
              profile: { displayName: { contains: term, mode: 'insensitive' } },
            },
          },
        },
        {
          booking: {
            professional: { title: { contains: term, mode: 'insensitive' } },
          },
        },
      ];
    }
    const sortField = query.sortBy || 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: sortDir },
        include: {
          booking: {
            select: {
              id: true,
              totalPrice: true,
              status: true,
              startAt: true,
              customer: {
                select: {
                  id: true,
                  phone: true,
                  profile: { select: { displayName: true } },
                },
              },
              professional: { select: { id: true, title: true, slug: true } },
              location: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                  city: true,
                  province: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getFinancialTransactionDetail(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            customer: {
              select: {
                id: true,
                phone: true,
                profile: { select: { displayName: true } },
              },
            },
            professional: {
              select: {
                id: true,
                title: true,
                slug: true,
                user: { select: { phone: true } },
              },
            },
            location: {
              select: {
                id: true,
                name: true,
                address: true,
                city: true,
                province: true,
              },
            },
            items: { include: { service: { select: { name: true } } } },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('تراکنش مالی یافت نشد');
    return {
      ...payment,
      isCommissionSnapshotted: payment.platformCommissionRate !== null,
      providerNote: 'Mock / Test Payment Provider',
      refundStatus: 'Not Implemented',
    };
  }

  async getCommissionSetting() {
    let rate = DEFAULT_PLATFORM_COMMISSION_RATE;
    let updatedAt: Date | null = null;
    try {
      const setting = await this.prisma.platformSetting.findUnique({
        where: { key: PLATFORM_COMMISSION_RATE_KEY },
      });
      if (setting?.value !== null && setting?.value !== undefined) {
        const val =
          typeof setting.value === 'number'
            ? setting.value
            : typeof setting.value === 'object' && 'rate' in (setting.value as any)
            ? Number((setting.value as any).rate)
            : Number(setting.value);
        if (!isNaN(val) && val >= 0 && val <= 100) {
          rate = val;
          updatedAt = setting.updatedAt;
        }
      }
    } catch {
      rate = DEFAULT_PLATFORM_COMMISSION_RATE;
    }
    return {
      key: PLATFORM_COMMISSION_RATE_KEY,
      rate,
      defaultRate: DEFAULT_PLATFORM_COMMISSION_RATE,
      updatedAt,
      notice:
        'تغییر نرخ کارمزد فقط بر تراکنش‌های آینده اعمال شده و Snapshot تراکنش‌های گذشته بدون تغییر باقی می‌ماند.',
    };
  }

  async updateCommissionSetting(newRate: number, adminUserId?: string) {
    if (
      typeof newRate !== 'number' ||
      isNaN(newRate) ||
      newRate < 0 ||
      newRate > 100
    )
      throw new BadRequestException('نرخ کارمزد باید عددی بین ۰ تا ۱۰۰ باشد.');
    const roundedRate = Math.round(newRate * 100) / 100;
    const oldSetting = await this.getCommissionSetting();
    const updated = await this.prisma.platformSetting.upsert({
      where: { key: PLATFORM_COMMISSION_RATE_KEY },
      update: { value: { rate: roundedRate } },
      create: {
        key: PLATFORM_COMMISSION_RATE_KEY,
        value: { rate: roundedRate },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: adminUserId || null,
        action: 'UPDATE_COMMISSION_RATE',
        entityType: 'platform_setting',
        entityId: updated.id,
        after: {
          key: PLATFORM_COMMISSION_RATE_KEY,
          previousRate: oldSetting.rate,
          newRate: roundedRate,
          actorRole: 'SUPER_ADMIN',
        },
      },
    });
    return {
      success: true,
      key: PLATFORM_COMMISSION_RATE_KEY,
      rate: roundedRate,
      updatedAt: updated.updatedAt,
      notice: 'تغییر نرخ کارمزد با موفقیت ذخیره و در لاگ سیستم ثبت شد.',
    };
  }

  async getFailedTransactionsAlert() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const failedCount = await this.prisma.payment.count({
      where: {
        status: PaymentStatus.failed,
        failedAt: { gte: oneHourAgo },
      },
    });
    let threshold = 3;
    try {
      const setting = await this.prisma.platformSetting.findUnique({
        where: { key: 'FAILED_TRANSACTIONS_THRESHOLD' },
      });
      if (setting?.value) {
        const val =
          typeof setting.value === 'number'
            ? setting.value
            : (setting.value as any)?.threshold;
        if (val && !isNaN(Number(val))) threshold = Number(val);
      }
    } catch {}
    return {
      isAlert: failedCount >= threshold,
      failedCount,
      threshold,
      timeWindowMinutes: 60,
      message:
        failedCount >= threshold
          ? `هشدار: ${failedCount} تراکنش ناموفق در ۶۰ دقیقه اخیر ثبت شده است (حد آستانه: ${threshold})`
          : 'وضعیت تراکنش‌های اخیر پایدار است.',
    };
  }

  async updateFailedTransactionsThreshold(
    threshold: number,
    adminUserId?: string,
  ) {
    if (
      typeof threshold !== 'number' ||
      isNaN(threshold) ||
      threshold < 1 ||
      threshold > 1000
    ) {
      throw new BadRequestException('حد آستانه باید عددی بین ۱ تا ۱۰۰۰ باشد.');
    }
    const updated = await this.prisma.platformSetting.upsert({
      where: { key: 'FAILED_TRANSACTIONS_THRESHOLD' },
      update: { value: { threshold } },
      create: {
        key: 'FAILED_TRANSACTIONS_THRESHOLD',
        value: { threshold },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: adminUserId || null,
        action: 'UPDATE_FAILED_TRANSACTIONS_THRESHOLD',
        entityType: 'platform_setting',
        entityId: updated.id,
        after: {
          key: 'FAILED_TRANSACTIONS_THRESHOLD',
          threshold,
          actorRole: 'SUPER_ADMIN',
        },
      },
    });
    return {
      success: true,
      threshold,
      updatedAt: updated.updatedAt,
      notice: 'حد آستانه هشدار تراکنش‌های ناموفق با موفقیت ذخیره شد.',
    };
  }

  // --- User Management ---
  async listUsers(
    queryOrPage:
      | {
          page?: number;
          limit?: number;
          search?: string;
          status?: UserStatus;
          role?: string;
        }
      | number = 1,
    maybeLimit = 20,
  ) {
    const query =
      typeof queryOrPage === 'number'
        ? { page: queryOrPage, limit: maybeLimit }
        : queryOrPage;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.role) {
      where.userRoles = { some: { role: { name: query.role } } };
    }
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { phone: { contains: s } },
        { email: { contains: s, mode: 'insensitive' } },
        { profile: { displayName: { contains: s, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
          userRoles: { include: { role: true } },
          professional: {
            select: { id: true, status: true, slug: true, title: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        userRoles: { include: { role: true } },
        professional: true,
        bookingsAsCustomer: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { professional: { select: { title: true } } },
        },
        reviews: { take: 10, orderBy: { createdAt: 'desc' } },
        auditLogs: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!user) throw new NotFoundException('کاربر یافت نشد');
    return user;
  }

  async setUserStatus(
    id: string,
    status: UserStatus,
    actorId?: string,
    reason?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('کاربر یافت نشد');
    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action: 'SET_USER_STATUS',
        entityType: 'user',
        entityId: id,
        before: { status: user.status },
        after: { status, reason },
      },
    });
    return updated;
  }

  async setUserRoles(id: string, roleNames: string[], actorId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('کاربر یافت نشد');

    const beforeRoles = user.userRoles.map((ur) => ur.role.name);

    const rolesInDb = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
    });

    await this.prisma.userRole.deleteMany({ where: { userId: id } });

    if (rolesInDb.length > 0) {
      await this.prisma.userRole.createMany({
        data: rolesInDb.map((r) => ({
          userId: id,
          roleId: r.id,
          assignedBy: actorId || null,
        })),
      });
    }

    const updatedUser = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action: 'SET_USER_ROLES',
        entityType: 'user',
        entityId: id,
        before: { roles: beforeRoles },
        after: { roles: roleNames },
      },
    });

    return updatedUser;
  }

  // --- Professional Management ---
  async listProfessionals(
    queryOrPage:
      | {
          page?: number;
          limit?: number;
          search?: string;
          status?: ProfessionalStatus;
          isFeatured?: boolean;
        }
      | number = 1,
    maybeLimit = 20,
    maybeStatus?: ProfessionalStatus,
  ) {
    const query =
      typeof queryOrPage === 'number'
        ? { page: queryOrPage, limit: maybeLimit, status: maybeStatus }
        : queryOrPage;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.ProfessionalWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.isFeatured !== undefined) where.isFeatured = query.isFeatured;
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { slug: { contains: s, mode: 'insensitive' } },
        { user: { phone: { contains: s } } },
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

  async setProfessionalStatus(
    id: string,
    status: ProfessionalStatus,
    actorId?: string,
    reason?: string,
  ) {
    const pro = await this.prisma.professional.findUnique({ where: { id } });
    if (!pro) throw new NotFoundException('متخصص یافت نشد');
    const updated = await this.prisma.professional.update({
      where: { id },
      data: {
        status,
        verifiedAt:
          status === ProfessionalStatus.approved ? new Date() : pro.verifiedAt,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action: 'SET_PROFESSIONAL_STATUS',
        entityType: 'professional',
        entityId: id,
        before: { status: pro.status },
        after: { status, reason },
      },
    });
    return updated;
  }

  async setProfessionalFeatured(
    id: string,
    isFeatured: boolean,
    actorId?: string,
  ) {
    const pro = await this.prisma.professional.findUnique({ where: { id } });
    if (!pro) throw new NotFoundException('متخصص یافت نشد');
    const updated = await this.prisma.professional.update({
      where: { id },
      data: { isFeatured },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action: 'SET_PROFESSIONAL_FEATURED',
        entityType: 'professional',
        entityId: id,
        before: { isFeatured: pro.isFeatured },
        after: { isFeatured },
      },
    });
    return updated;
  }

  // --- Booking Management ---
  async listBookings(
    queryOrPage:
      | {
          page?: number;
          limit?: number;
          search?: string;
          status?: BookingStatus;
          startDate?: string;
          endDate?: string;
        }
      | number = 1,
    maybeLimit = 20,
  ) {
    const query =
      typeof queryOrPage === 'number'
        ? { page: queryOrPage, limit: maybeLimit }
        : queryOrPage;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.BookingWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.startDate || query.endDate) {
      const range: Prisma.DateTimeFilter = {};
      if (query.startDate) range.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        range.lte = end;
      }
      where.createdAt = range;
    }
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { customer: { phone: { contains: s } } },
        {
          customer: {
            profile: { displayName: { contains: s, mode: 'insensitive' } },
          },
        },
        { professional: { title: { contains: s, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              phone: true,
              profile: { select: { displayName: true } },
            },
          },
          professional: { select: { id: true, title: true, slug: true } },
          payment: { select: { id: true, status: true, amount: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
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

  async updateBookingStatus(
    id: string,
    status: BookingStatus,
    actorId?: string,
    reason?: string,
  ) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('رزرو یافت نشد');
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action: 'UPDATE_BOOKING_STATUS',
        entityType: 'booking',
        entityId: id,
        before: { status: booking.status },
        after: { status, reason },
      },
    });
    return updated;
  }

  // --- Review Moderation ---
  async listReviews(query: {
    page?: number;
    limit?: number;
    search?: string;
    rating?: number;
    isPublished?: boolean;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.ReviewWhereInput = {};
    if (query.rating) where.rating = query.rating;
    if (query.isPublished !== undefined) where.isPublished = query.isPublished;
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { comment: { contains: s, mode: 'insensitive' } },
        { professional: { title: { contains: s, mode: 'insensitive' } } },
        {
          customer: {
            profile: { displayName: { contains: s, mode: 'insensitive' } },
          },
        },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              phone: true,
              profile: { select: { displayName: true } },
            },
          },
          professional: { select: { id: true, title: true, slug: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async setReviewVisibility(
    id: string,
    isPublished: boolean,
    actorId?: string,
    reason?: string,
  ) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('نظر یافت نشد');
    const updated = await this.prisma.review.update({
      where: { id },
      data: { isPublished },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action: 'SET_REVIEW_VISIBILITY',
        entityType: 'review',
        entityId: id,
        before: { isPublished: review.isPublished },
        after: { isPublished, reason },
      },
    });
    return updated;
  }

  async deleteReview(id: string, actorId?: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('نظر یافت نشد');
    await this.prisma.review.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action: 'DELETE_REVIEW',
        entityType: 'review',
        entityId: id,
        before: { comment: review.comment, rating: review.rating },
      },
    });
    return { success: true, message: 'نظر با موفقیت حذف شد' };
  }

  // --- Media Moderation ---
  async listMedia(query: {
    page?: number;
    limit?: number;
    search?: string;
    kind?: MediaKind;
    status?: MediaStatus;
    professionalId?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 24));
    const skip = (page - 1) * limit;
    const where: Prisma.MediaAssetWhereInput = {};
    if (query.kind) where.kind = query.kind;
    if (query.status) where.status = query.status;
    if (query.professionalId) where.professionalId = query.professionalId;
    if (query.search?.trim()) {
      where.title = { contains: query.search.trim(), mode: 'insensitive' };
    }
    const [items, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: { select: { id: true, title: true, slug: true } },
        },
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async setMediaStatus(id: string, status: MediaStatus, actorId?: string) {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('رسانه یافت نشد');
    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: { status },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action: 'SET_MEDIA_STATUS',
        entityType: 'media_asset',
        entityId: id,
        before: { status: media.status },
        after: { status },
      },
    });
    return updated;
  }

  async deleteMedia(id: string, actorId?: string) {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('رسانه یافت نشد');
    await this.prisma.mediaAsset.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action: 'DELETE_MEDIA',
        entityType: 'media_asset',
        entityId: id,
        before: { storageKey: media.storageKey, publicUrl: media.publicUrl },
      },
    });
    return { success: true, message: 'رسانه با موفقیت حذف شد' };
  }

  // --- Audit Logs ---
  async listAuditLogs(
    queryOrPage:
      | {
          page?: number;
          limit?: number;
          action?: string;
          actorId?: string;
          entityType?: string;
          entityId?: string;
          startDate?: string;
          endDate?: string;
        }
      | number = 1,
    maybeLimit = 50,
  ) {
    const query =
      typeof queryOrPage === 'number'
        ? { page: queryOrPage, limit: maybeLimit }
        : queryOrPage;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action)
      where.action = { contains: query.action, mode: 'insensitive' };
    if (query.actorId) where.actorId = query.actorId;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.startDate || query.endDate) {
      const range: Prisma.DateTimeFilter = {};
      if (query.startDate) range.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        range.lte = end;
      }
      where.createdAt = range;
    }
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              phone: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // --- Notifications ---
  async listNotifications(query: {
    page?: number;
    limit?: number;
    type?: NotificationType;
    search?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
    const skip = (page - 1) * limit;
    const where: Prisma.NotificationWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { body: { contains: s, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async broadcastNotification(
    dto: {
      title: string;
      body: string;
      target: 'all' | 'professionals' | 'customers';
    },
    actorId?: string,
  ) {
    let userIds: string[] = [];
    if (dto.target === 'all') {
      const users = await this.prisma.user.findMany({
        where: { status: 'active' },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    } else if (dto.target === 'professionals') {
      const pros = await this.prisma.professional.findMany({
        select: { userId: true },
      });
      userIds = pros.map((p) => p.userId);
    } else if (dto.target === 'customers') {
      const customers = await this.prisma.user.findMany({
        where: {
          status: 'active',
          professional: null,
        },
        select: { id: true },
      });
      userIds = customers.map((c) => c.id);
    }

    if (userIds.length > 0) {
      await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          type: NotificationType.system,
          title: dto.title,
          body: dto.body,
        })),
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action: 'BROADCAST_NOTIFICATION',
        entityType: 'notification',
        after: {
          title: dto.title,
          target: dto.target,
          recipientCount: userIds.length,
        },
      },
    });

    return { success: true, sentCount: userIds.length, target: dto.target };
  }

  // --- Settings ---
  async getPlatformSettings() {
    const settings = await this.prisma.platformSetting.findMany();
    const result: Record<string, any> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  async updatePlatformSettingsGroup(
    group: string,
    values: Record<string, any>,
    actorId?: string,
  ) {
    const key = `group_${group}`;
    const updated = await this.prisma.platformSetting.upsert({
      where: { key },
      update: { value: values },
      create: { key, value: values },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action: `UPDATE_SETTINGS_${group.toUpperCase()}`,
        entityType: 'platform_setting',
        entityId: updated.id,
        after: values,
      },
    });
    return { success: true, group, values, updatedAt: updated.updatedAt };
  }

  // --- Content / CMS ---
  async getCMSContent() {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key: 'CMS_CONTENT' },
    });
    return setting?.value || { pages: [], faqs: [], banners: [] };
  }

  async updateCMSContent(content: Record<string, any>, actorId?: string) {
    const updated = await this.prisma.platformSetting.upsert({
      where: { key: 'CMS_CONTENT' },
      update: { value: content },
      create: { key: 'CMS_CONTENT', value: content },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action: 'UPDATE_CMS_CONTENT',
        entityType: 'platform_setting',
        entityId: updated.id,
        after: content,
      },
    });
    return { success: true, content, updatedAt: updated.updatedAt };
  }

  // --- Site Builder ---
  async getSiteBuilder() {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key: 'SITE_BUILDER_SECTIONS' },
    });
    return setting?.value || [];
  }

  async updateSiteBuilder(sections: any[], actorId?: string) {
    const updated = await this.prisma.platformSetting.upsert({
      where: { key: 'SITE_BUILDER_SECTIONS' },
      update: { value: sections },
      create: { key: 'SITE_BUILDER_SECTIONS', value: sections },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action: 'UPDATE_SITE_BUILDER',
        entityType: 'platform_setting',
        entityId: updated.id,
        after: { sectionCount: sections.length },
      },
    });
    return { success: true, sections, updatedAt: updated.updatedAt };
  }

  // --- Roles & Permissions (Role-Based Permissions & Auth Security) ---
  async listRoles() {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { userRoles: true } },
      },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { code: 'asc' },
      include: {
        _count: { select: { rolePermissions: true } },
      },
    });
  }
}
