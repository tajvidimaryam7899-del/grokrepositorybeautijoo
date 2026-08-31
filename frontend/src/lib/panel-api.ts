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
  service?: { id: string; name: string; category?: { name?: string; id?: string } | null };
  priceRules?: PriceRuleItem[];
  durationRules?: DurationRuleItem[];
};
export type PriceRuleItem = { id: string; label: string; price: number; attributes?: Record<string, unknown> | null; sortOrder?: number; isActive?: boolean };
export type DurationRuleItem = { id: string; label: string; durationMin: number; durationMaxMin?: number | null; attributes?: Record<string, unknown> | null; sortOrder?: number; isActive?: boolean };
export type MediaAssetItem = { id: string; kind: string; publicUrl: string; mimeType: string; status: string; title?: string | null; sortOrder?: number };
export type CatalogCategory = {
  id: string; name: string; slug: string;
  services?: { id: string; name: string }[];
  children?: CatalogCategory[];
};
export type LocationItem = { id: string; name: string; address: string; city: string; province?: string | null; latitude?: number | null; longitude?: number | null; isPrimary?: boolean };
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
  locations?: Array<{ isPrimary?: boolean; location: { id: string; name: string; address: string; city: string; province?: string | null; latitude?: number | null; longitude?: number | null } }>;
  logoUrl?: string | null;
  professionalServices?: ProfessionalServiceItem[];
  workingHours?: WorkingHourItem[];
  completion?: ProfileCompletion;
};

function unwrapList<T>(res: Paginated<T> | T[]): T[] {
  if (Array.isArray(res)) return res;
  return res.items ?? res.data ?? [];
}

/**
 * Normalize media URLs for <img src>.
 * Absolute http(s) → as-is (Object Storage). Relative /uploads → API origin.
 * Optional NEXT_PUBLIC_MEDIA_URL for bare storage keys.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  const mediaBase = (process.env.NEXT_PUBLIC_MEDIA_URL || '').trim().replace(/\/$/, '');
  if (mediaBase && !trimmed.startsWith('/')) {
    return `${mediaBase}/${trimmed.replace(/^\/+/, '')}`;
  }
  const api = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
  const origin = api.replace(/\/api\/v1$/i, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${origin}${path}`;
}

/** Apply resolveMediaUrl to avatar / cover / logo on a professional payload. */
export function withResolvedMediaUrls<T extends OwnProfessional>(pro: T): T {
  if (!pro) return pro;
  const profile = pro.user?.profile
    ? {
        ...pro.user.profile,
        avatarUrl: resolveMediaUrl(pro.user.profile.avatarUrl) || pro.user.profile.avatarUrl || null,
      }
    : pro.user?.profile;
  return {
    ...pro,
    coverImageUrl: resolveMediaUrl(pro.coverImageUrl) || pro.coverImageUrl || null,
    logoUrl: resolveMediaUrl(pro.logoUrl) || pro.logoUrl || null,
    user: pro.user ? { ...pro.user, profile: profile ?? pro.user.profile } : pro.user,
  };
}

export async function fetchMyBookings(page = 1, limit = 20) {
  const res = await apiClient.get<Paginated<BookingListItem> | BookingListItem[]>(`/bookings/mine?page=${page}&limit=${limit}`);
  return { items: unwrapList(res), raw: res };
}

export async function fetchProBookings(page = 1, limit = 20) {
  const res = await apiClient.get<Paginated<BookingListItem> | BookingListItem[]>(`/bookings/professional?page=${page}&limit=${limit}`);
  return { items: unwrapList(res), raw: res };
}

export async function transitionBooking(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete', reason?: string) {
  return apiClient.patch(`/bookings/${id}/${action}`, reason ? { reason } : undefined);
}

export async function fetchFavorites() {
  const res = await apiClient.get<FavoriteItem[] | Paginated<FavoriteItem>>('/favorites');
  return unwrapList(res as Paginated<FavoriteItem>);
}
export async function removeFavorite(professionalId: string) {
  return apiClient.delete(`/favorites/${professionalId}`);
}

export async function fetchNotifications() {
  const res = await apiClient.get<NotificationItem[] | Paginated<NotificationItem>>('/notifications');
  return unwrapList(res as Paginated<NotificationItem>);
}
export async function markNotificationRead(id: string) {
  return apiClient.patch(`/notifications/${id}/read`);
}
export async function respondBooking(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete', reason?: string) {
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
  const pro = await apiClient.get<OwnProfessional>('/professionals/me');
  return withResolvedMediaUrls(pro);
}
export async function fetchMyCompletion() {
  return apiClient.get<ProfileCompletion>('/professionals/me/completion');
}
export async function fetchMyPreview() {
  const pro = await apiClient.get<OwnProfessional>('/professionals/me/preview');
  return withResolvedMediaUrls(pro);
}
export async function updateMyProfessional(payload: Record<string, unknown>) {
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
export async function addMyLocation(payload: {
  name?: string;
  address?: string;
  city: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  isPrimary?: boolean;
}) {
  return apiClient.post('/professionals/me/locations', payload);
}
export async function removeMyLocation(locationId: string) {
  return apiClient.delete(`/professionals/me/locations/${locationId}`);
}
export async function fetchMyWorkingHours() {
  const res = await apiClient.get<WorkingHourItem[] | Paginated<WorkingHourItem>>('/professionals/me/working-hours');
  return unwrapList(res as Paginated<WorkingHourItem>);
}
export async function setMyWorkingHours(hours: WorkingHourItem[]) {
  return apiClient.put('/professionals/me/working-hours', { hours });
}
export async function fetchCategories() {
  const res = await apiClient.get<CatalogCategory[] | Paginated<CatalogCategory>>('/services/categories');
  return unwrapList(res as Paginated<CatalogCategory>);
}

export async function uploadMyMedia(file: File, kind: string, professionalServiceId?: string) {
  const { getAccessToken } = await import('./auth-storage');
  const { ApiError } = await import('./api');
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
  const token = getAccessToken();

  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  if (!allowed.has(file.type)) {
    throw new ApiError(400, 'فرمت این تصویر پشتیبانی نمی‌شود. فقط JPG، PNG، WEBP و GIF مجاز است.');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new ApiError(400, 'حجم تصویر بیش از حد مجاز است (حداکثر ۸ مگابایت).');
  }
  if (!token) {
    throw new ApiError(401, 'برای آپلود باید وارد حساب کاربری شوید.');
  }

  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  if (professionalServiceId) form.append('professionalServiceId', professionalServiceId);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/professionals/me/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body: form,
    });
  } catch {
    throw new ApiError(0, 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.');
  }

  if (!res.ok) {
    let msg = 'آپلود ناموفق';
    let body: unknown;
    try {
      body = await res.json();
      const m = (body as { message?: string | string[] })?.message;
      msg = Array.isArray(m) ? m.join(', ') : (m || msg);
    } catch { /* ignore */ }
    throw new ApiError(res.status, String(msg), body);
  }
  const asset = (await res.json()) as MediaAssetItem;
  return { ...asset, publicUrl: resolveMediaUrl(asset.publicUrl) };
}

export async function fetchMyMedia(kind?: string) {
  const q = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  const list = await apiClient.get<MediaAssetItem[]>(`/professionals/me/media${q}`);
  return (list || []).map((a) => ({ ...a, publicUrl: resolveMediaUrl(a.publicUrl) }));
}

export async function deleteMyMedia(id: string) {
  return apiClient.delete(`/professionals/me/media/${id}`);
}

export async function publishMyMedia(ids: string[]) {
  return apiClient.post('/professionals/me/media/publish', { ids });
}

export async function fetchMyPriceRules(psId: string) {
  const res = await apiClient.get<PriceRuleItem[] | Paginated<PriceRuleItem>>(`/professionals/me/services/${psId}/price-rules`);
  return unwrapList(res as Paginated<PriceRuleItem>);
}
export async function upsertMyPriceRule(psId: string, payload: Partial<PriceRuleItem> & { label: string; price: number }) {
  return apiClient.post(`/professionals/me/services/${psId}/price-rules`, payload);
}
export async function deleteMyPriceRule(psId: string, ruleId: string) {
  return apiClient.delete(`/professionals/me/services/${psId}/price-rules/${ruleId}`);
}
export async function fetchMyDurationRules(psId: string) {
  const res = await apiClient.get<DurationRuleItem[] | Paginated<DurationRuleItem>>(`/professionals/me/services/${psId}/duration-rules`);
  return unwrapList(res as Paginated<DurationRuleItem>);
}
export async function upsertMyDurationRule(psId: string, payload: Partial<DurationRuleItem> & { label: string; durationMin: number }) {
  return apiClient.post(`/professionals/me/services/${psId}/duration-rules`, payload);
}
export async function deleteMyDurationRule(psId: string, ruleId: string) {
  return apiClient.delete(`/professionals/me/services/${psId}/duration-rules/${ruleId}`);
}

export async function fetchAdminStats() {
  return apiClient.get<AdminStats>('/admin/stats');
}
export async function fetchAdminUsers() {
  const res = await apiClient.get<AdminUser[] | Paginated<AdminUser>>('/admin/users');
  return unwrapList(res as Paginated<AdminUser>);
}
export async function fetchAdminProfessionals() {
  const res = await apiClient.get<AdminProfessional[] | Paginated<AdminProfessional>>('/admin/professionals');
  return unwrapList(res as Paginated<AdminProfessional>);
}
export async function setProfessionalStatus(id: string, status: string) {
  return apiClient.patch(`/admin/professionals/${id}/status`, { status });
}
export async function fetchAuditLogs() {
  const res = await apiClient.get<AuditLogItem[] | Paginated<AuditLogItem>>('/admin/audit');
  return unwrapList(res as Paginated<AuditLogItem>);
}
