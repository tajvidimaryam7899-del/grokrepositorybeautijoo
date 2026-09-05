/**
 * Comprehensive in-memory fallback state and data for Super Admin operations.
 * Used when backend endpoints return 401/404 or when running in Super Admin dev mode.
 */
import type { AuthMeResponse } from '@/types/auth';
import type {
  AdminDashboard,
  AdminFinancialSummary,
  AdminFinancialTransactionsResponse,
  AdminFinancialTransactionDetail,
  AdminCommissionSetting,
  HourlyFailedAlert,
  AdminUser,
  AdminProfessional,
  BookingListItem,
  AuditLogItem,
  AdminFinancialPeriod,
} from './panel-api';

export const SUPER_ADMIN_USER: AuthMeResponse = {
  id: 'super-admin-001',
  phone: '09120000000',
  email: 'admin@beautijoo.ir',
  status: 'ACTIVE',
  phoneVerified: true,
  roles: ['SUPER_ADMIN', 'admin', 'customer', 'professional'],
  profile: {
    displayName: 'مدیر کل سیستم (سوپر ادمین)',
    avatarUrl: null,
  },
  professional: null,
};

// In-memory state for settings
let currentCommissionRate = 10;
let currentFailedThreshold = 3;
let currentPlatformSettingsUpdatedAt: string = new Date().toISOString();

export function getMockCommissionSetting(): AdminCommissionSetting {
  return {
    key: 'PLATFORM_COMMISSION_PERCENT',
    rate: currentCommissionRate,
    defaultRate: 10,
    updatedAt: currentPlatformSettingsUpdatedAt,
    notice: 'کارمزد جاری پلتفرم روی تمام رزروها و تراکنش‌های آنلاین اعمال می‌شود.',
  };
}

export function setMockCommissionRate(rate: number) {
  currentCommissionRate = rate;
  currentPlatformSettingsUpdatedAt = new Date().toISOString();
  return {
    success: true,
    rate: currentCommissionRate,
    updatedAt: currentPlatformSettingsUpdatedAt,
    notice: 'درصد کارمزد پلتفرم با موفقیت به‌روزرسانی شد.',
  };
}

export function getMockFailedAlert(): HourlyFailedAlert {
  return {
    isTriggered: true,
    failedCount: 4,
    threshold: currentFailedThreshold,
    timeWindowMinutes: 60,
    since: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    recentFailed: [
      {
        id: 'tx-fail-001',
        amount: 850000,
        provider: 'zibal',
        providerRef: 'ZBL-ERR-98214',
        createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        failedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
        customerName: 'مریم حسینی',
        customerPhone: '09124445566',
        professionalTitle: 'سالن زیبایی سارا محمدی',
      },
      {
        id: 'tx-fail-002',
        amount: 1400000,
        provider: 'zarinpal',
        providerRef: 'ZP-FAILED-10382',
        createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        failedAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
        customerName: 'الهام صادقی',
        customerPhone: '09127778899',
        professionalTitle: 'مرکز تخصصی پوست و مو نگین',
      },
      {
        id: 'tx-fail-003',
        amount: 620000,
        provider: 'zibal',
        providerRef: 'ZBL-TIMEOUT-44120',
        createdAt: new Date(Date.now() - 41 * 60 * 1000).toISOString(),
        failedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        customerName: 'فاطمه احمدی',
        customerPhone: '09193332211',
        professionalTitle: 'استودیو ناخن مهسا',
      },
      {
        id: 'tx-fail-004',
        amount: 2200000,
        provider: 'zarinpal',
        providerRef: 'ZP-CANCEL-88910',
        createdAt: new Date(Date.now() - 53 * 60 * 1000).toISOString(),
        failedAt: new Date(Date.now() - 52 * 60 * 1000).toISOString(),
        customerName: 'سپیده رضایی',
        customerPhone: '09351112233',
        professionalTitle: 'آکادمی عروس پریناز',
      },
    ],
  };
}

export function setMockFailedThreshold(threshold: number) {
  currentFailedThreshold = threshold;
  return {
    success: true,
    threshold: currentFailedThreshold,
    updatedAt: new Date().toISOString(),
  };
}

export function getMockFinancialSummary(period: AdminFinancialPeriod = 'all_time'): AdminFinancialSummary {
  const multipliers: Record<AdminFinancialPeriod, number> = {
    today: 0.08,
    this_month: 0.45,
    all_time: 1.0,
  };
  const mult = multipliers[period] || 1.0;

  const grossRevenue = Math.round(485000000 * mult);
  const platformCommission = Math.round(grossRevenue * (currentCommissionRate / 100));
  const paymentFee = Math.round(grossRevenue * 0.01);
  const professionalNet = grossRevenue - platformCommission - paymentFee;

  return {
    period,
    currency: 'TOMAN',
    providerType: 'zibal_zarinpal',
    refundImplemented: false,
    grossRevenue,
    platformCommission,
    professionalNet,
    paymentFee,
    transactions: {
      paid: Math.round(1480 * mult),
      pending: Math.round(28 * mult),
      failed: Math.round(52 * mult),
      cancelled: Math.round(19 * mult),
      refunded: 0,
    },
    recentPaidPayments: [
      {
        id: 'tx-paid-101',
        amount: 1850000,
        platformCommissionRate: currentCommissionRate,
        platformCommissionAmount: Math.round(1850000 * (currentCommissionRate / 100)),
        professionalNetAmount: Math.round(1850000 * (1 - currentCommissionRate / 100)),
        provider: 'zibal',
        providerRef: '10982347',
        paidAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        booking: {
          id: 'bk-901',
          customer: { phone: '09121112233', profile: { displayName: 'رویا کریمی' } },
          professional: { title: 'سالن تخصصی سارا محمدی', slug: 'sara-mohammadi' },
        },
      },
      {
        id: 'tx-paid-102',
        amount: 950000,
        platformCommissionRate: currentCommissionRate,
        platformCommissionAmount: Math.round(950000 * (currentCommissionRate / 100)),
        professionalNetAmount: Math.round(950000 * (1 - currentCommissionRate / 100)),
        provider: 'zarinpal',
        providerRef: '99283411',
        paidAt: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
        booking: {
          id: 'bk-902',
          customer: { phone: '09358889900', profile: { displayName: 'مهسا نوری' } },
          professional: { title: 'کلینیک پوست و مو پارسه', slug: 'parseh-clinic' },
        },
      },
      {
        id: 'tx-paid-103',
        amount: 3200000,
        platformCommissionRate: currentCommissionRate,
        platformCommissionAmount: Math.round(3200000 * (currentCommissionRate / 100)),
        professionalNetAmount: Math.round(3200000 * (1 - currentCommissionRate / 100)),
        provider: 'zibal',
        providerRef: '10982390',
        paidAt: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
        booking: {
          id: 'bk-903',
          customer: { phone: '09127774433', profile: { displayName: 'زهرا کاظمی' } },
          professional: { title: 'استودیو عروس شبنم', slug: 'shabnam-studio' },
        },
      },
    ],
    hourlyFailedAlert: getMockFailedAlert(),
  };
}

export function getMockTransactions(params: {
  page?: number;
  limit?: number;
  status?: string;
  provider?: string;
  search?: string;
}): AdminFinancialTransactionsResponse {
  const page = params.page || 1;
  const limit = params.limit || 10;

  const mockList = [
    {
      id: 'tx-001',
      bookingId: 'bk-801',
      amount: 1850000,
      status: 'paid' as const,
      provider: 'zibal',
      providerRef: '10982347',
      idempotencyKey: 'idemp-tx-001',
      platformCommissionRate: currentCommissionRate,
      platformCommissionAmount: Math.round(1850000 * (currentCommissionRate / 100)),
      professionalNetAmount: Math.round(1850000 * (1 - currentCommissionRate / 100)),
      paidAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      failedAt: null,
      createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      booking: {
        id: 'bk-801',
        totalPrice: 1850000,
        status: 'confirmed',
        scheduledDate: '۱۴۰۳/۰۶/۱۵',
        customer: { id: 'usr-1', phone: '09121112233', profile: { displayName: 'رویا کریمی' } },
        professional: { id: 'pro-1', title: 'سالن تخصصی سارا محمدی', slug: 'sara-mohammadi' },
      },
    },
    {
      id: 'tx-fail-001',
      bookingId: 'bk-802',
      amount: 850000,
      status: 'failed' as const,
      provider: 'zibal',
      providerRef: 'ZBL-ERR-98214',
      idempotencyKey: 'idemp-tx-fail-001',
      platformCommissionRate: null,
      platformCommissionAmount: null,
      professionalNetAmount: null,
      paidAt: null,
      failedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      booking: {
        id: 'bk-802',
        totalPrice: 850000,
        status: 'cancelled',
        scheduledDate: '۱۴۰۳/۰۶/۱۵',
        customer: { id: 'usr-2', phone: '09124445566', profile: { displayName: 'مریم حسینی' } },
        professional: { id: 'pro-1', title: 'سالن زیبایی سارا محمدی', slug: 'sara-mohammadi' },
      },
    },
    {
      id: 'tx-003',
      bookingId: 'bk-803',
      amount: 950000,
      status: 'paid' as const,
      provider: 'zarinpal',
      providerRef: '99283411',
      idempotencyKey: 'idemp-tx-003',
      platformCommissionRate: currentCommissionRate,
      platformCommissionAmount: Math.round(950000 * (currentCommissionRate / 100)),
      professionalNetAmount: Math.round(950000 * (1 - currentCommissionRate / 100)),
      paidAt: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
      failedAt: null,
      createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
      booking: {
        id: 'bk-803',
        totalPrice: 950000,
        status: 'confirmed',
        scheduledDate: '۱۴۰۳/۰۶/۱۵',
        customer: { id: 'usr-3', phone: '09358889900', profile: { displayName: 'مهسا نوری' } },
        professional: { id: 'pro-2', title: 'کلینیک پوست و مو پارسه', slug: 'parseh-clinic' },
      },
    },
    {
      id: 'tx-fail-002',
      bookingId: 'bk-804',
      amount: 1400000,
      status: 'failed' as const,
      provider: 'zarinpal',
      providerRef: 'ZP-FAILED-10382',
      idempotencyKey: 'idemp-tx-fail-002',
      platformCommissionRate: null,
      platformCommissionAmount: null,
      professionalNetAmount: null,
      paidAt: null,
      failedAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
      booking: {
        id: 'bk-804',
        totalPrice: 1400000,
        status: 'cancelled',
        scheduledDate: '۱۴۰۳/۰۶/۱۵',
        customer: { id: 'usr-4', phone: '09127778899', profile: { displayName: 'الهام صادقی' } },
        professional: { id: 'pro-3', title: 'مرکز تخصصی پوست و مو نگین', slug: 'negin-beauty' },
      },
    },
    {
      id: 'tx-005',
      bookingId: 'bk-805',
      amount: 450000,
      status: 'pending' as const,
      provider: 'zibal',
      providerRef: null,
      idempotencyKey: 'idemp-tx-005',
      platformCommissionRate: null,
      platformCommissionAmount: null,
      professionalNetAmount: null,
      paidAt: null,
      failedAt: null,
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      booking: {
        id: 'bk-805',
        totalPrice: 450000,
        status: 'pending',
        scheduledDate: '۱۴۰۳/۰۶/۱۶',
        customer: { id: 'usr-5', phone: '09123334455', profile: { displayName: 'پرستو مرادی' } },
        professional: { id: 'pro-4', title: 'سالن ناخن آیلار', slug: 'aylar-nails' },
      },
    },
    {
      id: 'tx-006',
      bookingId: 'bk-806',
      amount: 3200000,
      status: 'paid' as const,
      provider: 'zibal',
      providerRef: '10982390',
      idempotencyKey: 'idemp-tx-006',
      platformCommissionRate: currentCommissionRate,
      platformCommissionAmount: Math.round(3200000 * (currentCommissionRate / 100)),
      professionalNetAmount: Math.round(3200000 * (1 - currentCommissionRate / 100)),
      paidAt: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
      failedAt: null,
      createdAt: new Date(Date.now() - 98 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
      booking: {
        id: 'bk-806',
        totalPrice: 3200000,
        status: 'confirmed',
        scheduledDate: '۱۴۰۳/۰۶/۱۵',
        customer: { id: 'usr-6', phone: '09127774433', profile: { displayName: 'زهرا کاظمی' } },
        professional: { id: 'pro-5', title: 'استودیو عروس شبنم', slug: 'shabnam-studio' },
      },
    },
  ];

  let filtered = [...mockList];
  if (params.status) {
    filtered = filtered.filter((t) => t.status === params.status);
  }
  if (params.provider) {
    filtered = filtered.filter((t) => t.provider === params.provider);
  }
  if (params.search) {
    const s = params.search.trim().toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.providerRef?.toLowerCase().includes(s) ||
        t.booking?.customer?.profile?.displayName?.toLowerCase().includes(s) ||
        t.booking?.customer?.phone?.includes(s) ||
        t.booking?.professional?.title?.toLowerCase().includes(s),
    );
  }

  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);

  return {
    items: paginated,
    meta: {
      page,
      limit,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    },
  };
}

export function getMockTransactionDetail(id: string): AdminFinancialTransactionDetail {
  return {
    id,
    bookingId: 'bk-detail-1',
    amount: 1850000,
    status: 'paid',
    provider: 'zibal',
    providerRef: '10982347',
    idempotencyKey: `idemp-${id}`,
    platformCommissionRate: currentCommissionRate,
    platformCommissionAmount: Math.round(1850000 * (currentCommissionRate / 100)),
    professionalNetAmount: Math.round(1850000 * (1 - currentCommissionRate / 100)),
    paidAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    failedAt: null,
    createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    isCommissionSnapshotted: true,
    providerNote: 'تراکنش از طریق درگاه مستقیم زرین‌پال/زیبال با موفقیت تسویه شد.',
    refundStatus: 'none',
    booking: {
      id: 'bk-detail-1',
      totalPrice: 1850000,
      status: 'confirmed',
      scheduledDate: '۱۴۰۳/۰۶/۱۵',
      customer: {
        id: 'usr-1',
        phone: '09121112233',
        profile: { displayName: 'رویا کریمی' },
      },
      professional: {
        id: 'pro-1',
        title: 'سالن تخصصی سارا محمدی',
        slug: 'sara-mohammadi',
        address: 'تهران، سعادت‌آباد، میدان کاج',
        user: { phone: '09121111111' },
      },
      items: [
        {
          id: 'item-1',
          unitPrice: 1500000,
          durationMin: 90,
          service: { name: 'رنگ مو و لایت' },
        },
        {
          id: 'item-2',
          unitPrice: 350000,
          durationMin: 30,
          service: { name: 'براشینگ تخصصی' },
        },
      ],
    },
  };
}

export function getMockDashboard(): AdminDashboard {
  return {
    overview: {
      totalUsers: 2450,
      totalProfessionals: 184,
      pendingProfessionals: 6,
      totalBookings: 6720,
      completedBookings: 5910,
      cancelledBookings: 430,
      totalReviews: 890,
      revenue: { available: true, total: 485000000 },
    },
    timeStats: {
      today: {
        newUsers: 14,
        newProfessionals: 2,
        newBookings: 48,
        completedBookings: 39,
        cancelledBookings: 3,
      },
      last7Days: {
        newUsers: 112,
        newProfessionals: 15,
        newBookings: 384,
        completedBookings: 340,
        cancelledBookings: 22,
      },
      last30Days: {
        newUsers: 490,
        newProfessionals: 58,
        newBookings: 1650,
        completedBookings: 1490,
        cancelledBookings: 95,
      },
      thisMonth: {
        newUsers: 340,
        newProfessionals: 42,
        newBookings: 1180,
        completedBookings: 1050,
        cancelledBookings: 71,
      },
    },
    trends: {
      userGrowth: [
        { date: '2026-08-10', count: 12 },
        { date: '2026-08-15', count: 18 },
        { date: '2026-08-20', count: 24 },
        { date: '2026-08-25', count: 32 },
        { date: '2026-08-30', count: 28 },
        { date: '2026-09-04', count: 40 },
      ],
      professionalGrowth: [
        { date: '2026-08-10', count: 2 },
        { date: '2026-08-15', count: 3 },
        { date: '2026-08-20', count: 4 },
        { date: '2026-08-25', count: 6 },
        { date: '2026-08-30', count: 5 },
        { date: '2026-09-04', count: 8 },
      ],
      bookingActivity: [
        { date: '2026-08-10', total: 45, completed: 40, cancelled: 3 },
        { date: '2026-08-15', total: 52, completed: 48, cancelled: 2 },
        { date: '2026-08-20', total: 68, completed: 62, cancelled: 4 },
        { date: '2026-08-25', total: 74, completed: 69, cancelled: 3 },
        { date: '2026-08-30', total: 80, completed: 73, cancelled: 5 },
        { date: '2026-09-04', total: 95, completed: 88, cancelled: 4 },
      ],
      revenue: [
        { date: '2026-08-10', amount: 14500000 },
        { date: '2026-08-15', amount: 18200000 },
        { date: '2026-08-20', amount: 22800000 },
        { date: '2026-08-25', amount: 27100000 },
        { date: '2026-08-30', amount: 29400000 },
        { date: '2026-09-04', amount: 35600000 },
      ],
    },
    pending: {
      professionalsAwaitingReview: 4,
      pendingPayments: 7,
      failedPayments: 3,
    },
    recentActivity: [
      {
        id: 'act-1',
        actor: 'رویا کریمی',
        action: 'ثبت رزرو جدید رنگ مو',
        entityType: 'booking',
        entityId: 'bk-801',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: 'act-2',
        actor: 'سیستم مالی',
        action: 'پرداخت موفق سفارش آنلاین',
        entityType: 'payment',
        entityId: 'tx-001',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: 'act-3',
        actor: 'سارا محمدی',
        action: 'تایید رزرو مشتری',
        entityType: 'booking',
        entityId: 'bk-801',
        createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      },
      {
        id: 'act-4',
        actor: 'سوپر ادمین',
        action: 'به‌روزرسانی تنظیمات کارمزد به ۱۰٪',
        entityType: 'platform_settings',
        entityId: 'commission_rate',
        createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      },
    ],
    recent: {
      professionals: [
        {
          id: 'pro-1',
          title: 'سالن زیبایی سارا محمدی',
          slug: 'sara-mohammadi',
          status: 'approved',
          createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
          displayName: 'سارا محمدی',
        },
        {
          id: 'pro-2',
          title: 'کلینیک پوست و مو پارسه',
          slug: 'parseh-clinic',
          status: 'approved',
          createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
          displayName: 'دکتر علیرضا رستمی',
        },
        {
          id: 'pro-3',
          title: 'مرکز تخصصی ناخن مهسا',
          slug: 'mahsa-nails',
          status: 'pending_review',
          createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
          displayName: 'مهسا نوری',
        },
      ],
      users: [
        {
          id: 'usr-1',
          phone: '09121112233',
          displayName: 'رویا کریمی',
          createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        },
        {
          id: 'usr-2',
          phone: '09124445566',
          displayName: 'مریم حسینی',
          createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
        },
        {
          id: 'usr-3',
          phone: '09358889900',
          displayName: 'مهسا نوری',
          createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        },
      ],
      bookings: [
        {
          id: 'bk-801',
          status: 'confirmed',
          totalPrice: 1850000,
          createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          professionalTitle: 'سالن تخصصی سارا محمدی',
          customerName: 'رویا کریمی',
        },
        {
          id: 'bk-803',
          status: 'completed',
          totalPrice: 950000,
          createdAt: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
          professionalTitle: 'کلینیک پوست و مو پارسه',
          customerName: 'مهسا نوری',
        },
      ],
      reviews: [
        {
          id: 'rev-1',
          rating: 5,
          comment: 'کارشون فوق‌العاده بود و رفتار پرسنل بسیار محترمانه بود.',
          createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          professionalTitle: 'سالن تخصصی سارا محمدی',
          customerName: 'رویا کریمی',
        },
      ],
    },
  };
}

export function getMockUsers(): AdminUser[] {
  return [
    {
      id: 'usr-super-admin',
      phone: '09120000000',
      email: 'admin@beautijoo.ir',
      status: 'active',
      roles: ['SUPER_ADMIN', 'admin'],
      profile: { displayName: 'مدیر کل سیستم (سوپر ادمین)' },
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'usr-pro-1',
      phone: '09121111111',
      email: 'sara@beautijoo.ir',
      status: 'active',
      roles: ['professional'],
      profile: { displayName: 'سارا محمدی' },
      createdAt: '2026-02-15T10:00:00.000Z',
    },
    {
      id: 'usr-cust-1',
      phone: '09123333333',
      email: 'customer@beautijoo.ir',
      status: 'active',
      roles: ['customer'],
      profile: { displayName: 'رویا کریمی' },
      createdAt: '2026-03-01T14:30:00.000Z',
    },
    {
      id: 'usr-cust-2',
      phone: '09124445566',
      email: 'maryam@beautijoo.ir',
      status: 'active',
      roles: ['customer'],
      profile: { displayName: 'مریم حسینی' },
      createdAt: '2026-04-10T18:00:00.000Z',
    },
    {
      id: 'usr-cust-3',
      phone: '09358889900',
      email: 'mahsa@beautijoo.ir',
      status: 'active',
      roles: ['customer', 'professional'],
      profile: { displayName: 'مهسا نوری' },
      createdAt: '2026-05-20T09:15:00.000Z',
    },
  ];
}

export function getMockProfessionals(): AdminProfessional[] {
  return [
    {
      id: 'pro-1',
      slug: 'sara-mohammadi',
      title: 'سالن تخصصی زیبایی سارا محمدی',
      status: 'approved',
      user: { phone: '09121111111', profile: { displayName: 'سارا محمدی' } },
    },
    {
      id: 'pro-2',
      slug: 'parseh-clinic',
      title: 'کلینیک پوست و مو پارسه',
      status: 'approved',
      user: { phone: '09128887766', profile: { displayName: 'دکتر علیرضا رستمی' } },
    },
    {
      id: 'pro-3',
      slug: 'mahsa-nails',
      title: 'مرکز تخصصی ناخن مهسا',
      status: 'pending_review',
      user: { phone: '09358889900', profile: { displayName: 'مهسا نوری' } },
    },
    {
      id: 'pro-4',
      slug: 'shabnam-studio',
      title: 'استودیو عروس و گریم شبنم',
      status: 'approved',
      user: { phone: '09127774433', profile: { displayName: 'شبنم قریشی' } },
    },
    {
      id: 'pro-5',
      slug: 'niloufar-skincare',
      title: 'مرکز پاکسازی و مراقبت پوست نیلوفر',
      status: 'draft',
      user: { phone: '09192223344', profile: { displayName: 'نیلوفر امینی' } },
    },
  ];
}

export function getMockBookings(): BookingListItem[] {
  return [
    {
      id: 'bk-801',
      status: 'confirmed',
      startAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      endAt: new Date(Date.now() + 26 * 3600 * 1000).toISOString(),
      totalPrice: 1850000,
      notes: 'رنگ مو و لایت دودی',
      customer: { id: 'usr-1', phone: '09121112233', profile: { displayName: 'رویا کریمی' } },
      professional: { id: 'pro-1', title: 'سالن تخصصی زیبایی سارا محمدی', slug: 'sara-mohammadi' },
      services: [{ id: 'svc-1', name: 'رنگ مو و لایت', price: 1850000 }],
    },
    {
      id: 'bk-802',
      status: 'cancelled',
      startAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      totalPrice: 850000,
      notes: 'کنسل شده به دلیل عدم پرداخت',
      customer: { id: 'usr-2', phone: '09124445566', profile: { displayName: 'مریم حسینی' } },
      professional: { id: 'pro-1', title: 'سالن تخصصی زیبایی سارا محمدی', slug: 'sara-mohammadi' },
      services: [{ id: 'svc-2', name: 'کوپ ژورنالی', price: 850000 }],
    },
    {
      id: 'bk-803',
      status: 'completed',
      startAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      totalPrice: 950000,
      customer: { id: 'usr-3', phone: '09358889900', profile: { displayName: 'مهسا نوری' } },
      professional: { id: 'pro-2', title: 'کلینیک پوست و مو پارسه', slug: 'parseh-clinic' },
      services: [{ id: 'svc-3', name: 'فیشیال تخصصی پوست', price: 950000 }],
    },
  ];
}

export function getMockAuditLogs(): AuditLogItem[] {
  return [
    {
      id: 'log-1',
      action: 'UPDATE_COMMISSION_RATE',
      entity: 'PlatformSetting',
      entityId: 'commission_rate',
      actorId: 'super-admin-001',
      meta: { newRate: currentCommissionRate, oldRate: 10 },
      createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    },
    {
      id: 'log-2',
      action: 'UPDATE_FAILED_ALERT_THRESHOLD',
      entity: 'PlatformSetting',
      entityId: 'hourly_failed_alert_threshold',
      actorId: 'super-admin-001',
      meta: { threshold: currentFailedThreshold },
      createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    },
    {
      id: 'log-3',
      action: 'APPROVE_PROFESSIONAL',
      entity: 'Professional',
      entityId: 'pro-1',
      actorId: 'super-admin-001',
      meta: { slug: 'sara-mohammadi' },
      createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
  ];
}
