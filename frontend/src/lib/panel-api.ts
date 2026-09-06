/**
 * Typed helpers for customer / professional / admin panel endpoints.
 */
import { apiClient } from './api';
import {
  getMockCommissionSetting,
  setMockCommissionRate,
  getMockFailedAlert,
  setMockFailedThreshold,
  getMockFinancialSummary,
  getMockTransactions,
  getMockTransactionDetail,
  getMockDashboard,
  getMockUsers,
  getMockProfessionals,
  getMockBookings,
  getMockAuditLogs,
} from './admin-mock-data';


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
export type ServiceAddOnItem = {
  id: string; name: string; description?: string | null; price: number;
  extraDurationMin?: number; sortOrder?: number; isActive?: boolean;
};
export type ProfessionalServiceItem = {
  id: string; serviceId: string; durationMin: number; price: number; bufferMin?: number; description?: string | null; isActive?: boolean;
  service?: { id: string; name: string; slug?: string; category?: { name?: string; id?: string; slug?: string; parentId?: string | null } | null };
  priceRules?: PriceRuleItem[];
  durationRules?: DurationRuleItem[];
  addOns?: ServiceAddOnItem[];
  mediaAssets?: MediaAssetItem[];
};
export type PriceRuleItem = { id: string; label: string; price: number; attributes?: Record<string, unknown> | null; sortOrder?: number; isActive?: boolean };
export type DurationRuleItem = { id: string; label: string; durationMin: number; durationMaxMin?: number | null; attributes?: Record<string, unknown> | null; sortOrder?: number; isActive?: boolean };
export type MediaAssetItem = { id: string; kind: string; publicUrl: string; mimeType: string; status: string; title?: string | null; sortOrder?: number };
export type CatalogCategory = {
  id: string; name: string; slug: string; parentId?: string | null; description?: string | null;
  sortOrder?: number; isActive?: boolean;
  services?: { id: string; name: string; slug?: string; description?: string | null }[];
  children?: CatalogCategory[];
};
export type LocationItem = { id: string; name: string; address: string; city: string; province?: string | null; latitude?: number | null; longitude?: number | null; isPrimary?: boolean };
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
export type AdminStats = { users?: number; professionals?: number; bookings?: number; [key: string]: unknown };
