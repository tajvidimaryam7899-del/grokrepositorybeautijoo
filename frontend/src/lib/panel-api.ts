export type AdminWindowStats = {
  newUsers: number;
  newProfessionals: number;
  newBookings: number;
  completedBookings: number;
  cancelledBookings: number;
};
export type AdminDayCount = { date: string; count: number };
export type AdminBookingDay = { date: string; total: number; completed: number; cancelled: number };
export type AdminRevenueDay = { date: string; amount: number };
export type AdminRecentActivityItem = {
  id: string;
  actor: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
};
export type AdminRecentProfessional = {
  id: string; title: string; slug: string; status: string; createdAt: string; displayName: string | null;
};
export type AdminRecentUser = { id: string; phone: string | null; displayName: string | null; createdAt: string };
export type AdminRecentBooking = {
  id: string; status: string; totalPrice: number; createdAt: string;
  professionalTitle: string | null; customerName: string | null;
};
export type AdminRecentReview = {
  id: string; rating: number; comment: string | null; createdAt: string;
  professionalTitle: string | null; customerName: string | null;
};
export type AdminDashboard = {
  overview: {
    totalUsers: number;
    totalProfessionals: number;
    pendingProfessionals: number;
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    totalReviews: number;
    revenue: { available: boolean; total?: number };
  };
  timeStats: {
    today: AdminWindowStats;
    last7Days: AdminWindowStats;
    last30Days: AdminWindowStats;
    thisMonth: AdminWindowStats;
  };
  trends: {
    userGrowth: AdminDayCount[];
    professionalGrowth: AdminDayCount[];
    bookingActivity: AdminBookingDay[];
    revenue: AdminRevenueDay[] | null;
  };
  pending: {
    professionalsAwaitingReview: number;
    pendingPayments: number;
    failedPayments: number;
  };
  recentActivity: AdminRecentActivityItem[];
  recent: {
    professionals: AdminRecentProfessional[];
    users: AdminRecentUser[];
    bookings: AdminRecentBooking[];
    reviews: AdminRecentReview[];
  };
};
export async function fetchAdminDashboard() {
  return apiClient.get<AdminDashboard>('/admin/dashboard');
}
