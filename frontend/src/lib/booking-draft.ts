import type { BookingDraft } from '@/types/booking';

const KEY = 'bj_booking_draft';

export function saveBookingDraft(draft: BookingDraft): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function loadBookingDraft(): BookingDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BookingDraft;
  } catch {
    return null;
  }
}

export function clearBookingDraft(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(KEY);
}

export function bookingLoginReturnPath(draft: BookingDraft): string {
  const sp = new URLSearchParams({
    serviceId: draft.serviceId,
    date: draft.date,
    slot: draft.slotStart,
  });
  if (draft.locationId) sp.set('locationId', draft.locationId);
  if (draft.addOnIds?.length) sp.set('addOnIds', draft.addOnIds.join(','));
  if (draft.priceRuleId) sp.set('priceRuleId', draft.priceRuleId);
  if (draft.durationRuleId) sp.set('durationRuleId', draft.durationRuleId);
  return `/booking/${encodeURIComponent(draft.professionalSlug)}?${sp.toString()}`;
}
