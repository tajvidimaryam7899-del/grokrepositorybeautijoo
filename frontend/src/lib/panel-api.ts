/**
 * Typed helpers for customer / professional / admin panel endpoints.
 */
import { apiClient } from './api';

export type Paginated<T> = { items?: T[]; data?: T[]; total?: number; page?: number; limit?: number };
export type BookingListItem = {
  id: string; status: string; startAt: string; endAt?: string; notes?: string | null; totalPrice?: number | null;
  professional?: { id: string; slug?: string; title?: string | null; user?: { profile?: { displayName?: string | null } | null } | null } | null;
  customer?: { id: string; phone?: string | null; profile?: { displayName?: string | null } | null } | null;
  services?: { id: string; name?: string; price?: number }[];
  location?: { id: string; name?: string; city?: string } | null;
};
export type FavoriteItem = {
  id?: string; professionalId?: string;
  professional?: { id: string; slug: string; title?: string | null; status?: string; user?: { profile?: { displayName?: string | null; avatarUrl?: string | null } | null } | null };
};
export type NotificationItem = { id: string; title?: string; body?: string; message?: string; readAt?: string | null; createdAt: string; type?: string };
export type ProfessionalServiceItem = {
  id: string; serviceId: string; durationMin: number; price: number; bufferMin?: number; description?: string | null; isActive?: boolean;
  service?: { id: string; name: string; category?: { name?: string } | null };
};
export type LocationItem = { id: string; name: string; address: string; city: string; province?: string | null; isPrimary?: boolean };
export type WorkingHourItem = { id?: string; dayOfWeek: string; startTime: string; endTime: string; breaks?: { startTime: string; endTime: string }[] };
export type AdminStats = { users?: number; professionals?: number; bookings?: number; [key: string]: unknown };
export type AdminUser = { id: string; phone?: string | null; email?: string | null; status?: string; roles?: string[]; profile?: { displayName?: string | null } | null; createdAt?: string };
export type AdminProfessional = { id: string; slug: string; title?: string | null; status: string; user?: { phone?: string | null; profile?: { displayName?: string | null } | null } | null };
export type AuditLogItem = { id: string; action?: string; entity?: string; entityId?: string; actorId?: string; meta?: unknown; createdAt: string };

export type CompletionField = { key: string; label: string; done: boolean };
export type ProfileCompletion = { percent: number; complete: boolean; fields: CompletionField[] };
export type OwnProfessional = {
  id: string; userId: string; slug: string; title: string; bio?: string | null; status: string;
  coverImageUrl?: string | null; publishedAt?: string | null; verifiedAt?: string | null;
  user?: { phone?: string | null; profile?: {
    displayName?: string | null; firstName?: string | null; lastName?: string | null;
    avatarUrl?: string | null; bio?: string | null;
  } | null } | null;
  locations?: Array<{ isPrimary?: boolean; location: { id: string; name: string; address: string; city: string; province?: string | null } }>;
  professionalServices?: ProfessionalServiceItem[];
  workingHours?: WorkingHourItem[];
  completion?: ProfileCompletion;
};

function unwrapList<T>(res: Paginated<T> | T[]): T[] {
  if (Array.isArray(res)) return res;
  return res.items ?? res.data ?? [];
}

export async function fetchMyBookings(page = 1, limit = 20) {
  const res = await apiClient.get<Paginated<BookingListItem> | BookingListItem[]>(`/bookings/mine?page=${page}&limit=${limit}`);
  return { items: unwrapList(res), raw: res };
}
export async function fetchFavorites() {
  const res = await apiClient.get<FavoriteItem[] | Paginated<FavoriteItem>>('/favorites');
  return unwrapList(res as Paginated<FavoriteItem>);
}
export async function removeFavorite(professionalId: string) {
  return apiClient.delete(`/favorites/${professionalId}`);
}
export async function createReview(payload: { bookingId: string; rating: number; comment?: string }) {
  return apiClient.post('/reviews', payload);
}
export async function fetchNotifications(page = 1) {
  const res = await apiClient.get<NotificationItem[] | Paginated<NotificationItem>>(`/notifications?page=${page}`);
  return { items: unwrapList(res as Paginated<NotificationItem>), raw: res };
}
export async function fetchUnreadCount() {
  return apiClient.get<{ count: number }>('/notifications/unread-count');
}
export async function markNotificationRead(id: string) {
  return apiClient.patch(`/notifications/${id}/read`);
}
export async function fetchProBookings(page = 1, limit = 20) {
  const res = await apiClient.get<Paginated<BookingListItem> | BookingListItem[]>(`/bookings/professional?page=${page}&limit=${limit}`);
  return { items: unwrapList(res), raw: res };
}
export async function transitionBooking(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete', reason?: string) {
  return apiClient.patch(`/bookings/${id}/${action}`, reason ? { reason } : undefined);
}
export async function fetchMyServices() {
  const res = await apiClient.get<ProfessionalServiceItem[] | Paginated<ProfessionalServiceItem>>('/professionals/me/services');
  return unwrapList(res as Paginated<ProfessionalServiceItem>);
}
export async function upsertMyService(payload: { serviceId: string; durationMin: number; price: number; bufferMin?: number; description?: string }) {
  return apiClient.post('/professionals/me/services', payload);
}
export async function deactivateMyService(id: string) {
  return apiClient.delete(`/professionals/me/services/${id}`);
}
export async function fetchMyProfessional() {
  return apiClient.get<OwnProfessional>('/professionals/me');
}
export async function fetchMyCompletion() {
  return apiClient.get<ProfileCompletion>('/professionals/me/completion');
}
export async function fetchMyPreview() {
  return apiClient.get<OwnProfessional>('/professionals/me/preview');
}
export async function updateMyProfessional(payload: {
  title?: string; bio?: string; coverImageUrl?: string;
  firstName?: string; lastName?: string; displayName?: string;
  avatarUrl?: string; profileBio?: string;
}) {
  return apiClient.patch<OwnProfessional>('/professionals/me', payload);
}
export async function publishMyProfessional() {
  return apiClient.post<OwnProfessional>('/professionals/me/publish');
}
export async function unpublishMyProfessional() {
  return apiClient.post<OwnProfessional>('/professionals/me/unpublish');
}
export async function fetchMyLocations() {
  const res = await apiClient.get<LocationItem[] | Paginated<LocationItem>>('/professionals/me/locations');
  return unwrapList(res as Paginated<LocationItem>);
}
export async function addMyLocation(payload: { name: string; address: string; city: string; province?: string; isPrimary?: boolean }) {
  return apiClient.post('/professionals/me/locations', payload);
}
export async function fetchMyWorkingHours() {
  const res = await apiClient.get<WorkingHourItem[] | Paginated<WorkingHourItem>>('/professionals/me/working-hours');
  return unwrapList(res as Paginated<WorkingHourItem>);
}
export async function setMyWorkingHours(payload: { dayOfWeek: string; startTime: string; endTime: string; breaks?: { startTime: string; endTime: string }[] }) {
  return apiClient.post('/professionals/me/working-hours', payload);
}
export async function addTimeOff(payload: { startAt: string; endAt: string; reason?: string }) {
  return apiClient.post('/professionals/me/time-off', payload);
}
export async function fetchPublicServices(category?: string) {
  const q = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiClient.get<{ id: string; name: string; categoryId?: string }[]>(`/services${q}`);
}
export async function fetchAdminStats() {
  return apiClient.get<AdminStats>('/admin/stats');
}
export async function fetchAdminUsers(page = 1, limit = 20) {
  const res = await apiClient.get<Paginated<AdminUser> | AdminUser[]>(`/admin/users?page=${page}&limit=${limit}`);
  return { items: unwrapList(res), raw: res };
}
export async function fetchAdminProfessionals(page = 1, limit = 20, status?: string) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) qs.set('status', status);
  const res = await apiClient.get<Paginated<AdminProfessional> | AdminProfessional[]>(`/admin/professionals?${qs}`);
  return { items: unwrapList(res), raw: res };
}
export async function setProfessionalStatus(id: string, status: string) {
  return apiClient.patch(`/admin/professionals/${id}/status`, { status });
}
export async function fetchAdminBookings(page = 1, limit = 20) {
  const res = await apiClient.get<Paginated<BookingListItem> | BookingListItem[]>(`/admin/bookings?page=${page}&limit=${limit}`);
  return { items: unwrapList(res), raw: res };
}
export async function fetchAuditLogs(page = 1, limit = 50) {
  const res = await apiClient.get<Paginated<AuditLogItem> | AuditLogItem[]>(`/admin/audit-logs?page=${page}&limit=${limit}`);
  return { items: unwrapList(res), raw: res };
}
