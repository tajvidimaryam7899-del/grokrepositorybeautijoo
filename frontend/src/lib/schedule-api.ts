/**
 * Schedule / working-hours / time-off helpers for zibagar panel.
 */
import { apiClient } from './api';

export type Paginated<T> = { items?: T[]; data?: T[]; total?: number; page?: number; limit?: number };
export type WorkingHourItem = {
  id?: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isActive?: boolean;
  breaks?: { startTime: string; endTime: string }[];
};
export type TimeOffItem = {
  id: string;
  startAt: string;
  endAt: string;
  reason?: string | null;
  createdAt?: string;
};
export type BookingListItem = {
  id: string; status: string; startAt: string; endAt?: string; notes?: string | null; totalPrice?: number | null;
  customer?: { id: string; phone?: string | null; profile?: { displayName?: string | null } | null } | null;
  services?: { id: string; name?: string; price?: number }[];
};

function unwrapList<T>(res: Paginated<T> | T[]): T[] {
  if (Array.isArray(res)) return res;
  return res.items ?? res.data ?? [];
}

export async function fetchMyWorkingHours() {
  const res = await apiClient.get<WorkingHourItem[] | Paginated<WorkingHourItem>>('/professionals/me/working-hours');
  return unwrapList(res as Paginated<WorkingHourItem>);
}

export async function setMyWorkingHours(hour: WorkingHourItem) {
  return apiClient.post('/professionals/me/working-hours', {
    dayOfWeek: hour.dayOfWeek,
    startTime: hour.startTime,
    endTime: hour.endTime,
    ...(hour.breaks ? { breaks: hour.breaks } : {}),
    ...(typeof hour.isActive === 'boolean' ? { isActive: hour.isActive } : {}),
  });
}

export async function fetchMyTimeOffs() {
  const res = await apiClient.get<TimeOffItem[] | Paginated<TimeOffItem>>('/professionals/me/time-off');
  return unwrapList(res as Paginated<TimeOffItem>);
}

export async function addTimeOff(payload: { startAt: string; endAt: string; reason?: string }) {
  return apiClient.post<TimeOffItem>('/professionals/me/time-off', payload);
}

export async function removeTimeOff(id: string) {
  return apiClient.delete<{ ok: boolean }>(`/professionals/me/time-off/${id}`);
}

export async function fetchProBookings(page = 1, limit = 20) {
  const res = await apiClient.get<Paginated<BookingListItem> | BookingListItem[]>(`/bookings/professional?page=${page}&limit=${limit}`);
  return { items: unwrapList(res as Paginated<BookingListItem>), raw: res };
}
