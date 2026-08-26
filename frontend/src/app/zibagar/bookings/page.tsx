'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { fetchProBookings, transitionBooking, type BookingListItem } from '@/lib/panel-api';
import { persianBookingStatus } from '@/lib/persian-status';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice } from '@/lib/utils';

export default function ZibagarBookingsPage() {
  const [items, setItems] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await fetchProBookings(1, 50)).items); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function act(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete') {
    setBusy(`${id}:${action}`); setError(null);
    try { await transitionBooking(id, action); await load(); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setBusy(null); }
  }
  if (loading) return <PanelLoading />;
  if (error && items.length === 0) return <PanelError message={error} onRetry={load} />;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">رزروهای زیباگر</h1>
        <p className="mt-1 text-sm text-gray">تأیید، رد، لغو یا تکمیل نوبت</p></div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {items.length === 0 ? <PanelEmpty title="رزروی یافت نشد" /> : (
        <ul className="space-y-3">{items.map((b) => {
          const customer = b.customer?.profile?.displayName || b.customer?.phone || 'مشتری';
          return (
            <li key={b.id}><Card className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-semibold">{customer}</p>
                  <p className="text-xs text-gray" dir="ltr">{new Date(b.startAt).toLocaleString('fa-IR')}</p></div>
                <span className="rounded-full bg-coral-soft px-3 py-1 text-xs font-medium text-coral">{persianBookingStatus(b.status)}</span>
              </div>
              {b.totalPrice != null && <p className="text-sm text-gray">{formatPrice(b.totalPrice)}</p>}
              <div className="flex flex-wrap gap-2">
                {b.status === 'PENDING' && (
                  <>
                    <Button size="sm" loading={busy === `${b.id}:confirm`} onClick={() => act(b.id, 'confirm')}>تأیید</Button>
                    <Button size="sm" variant="secondary" loading={busy === `${b.id}:reject`} onClick={() => act(b.id, 'reject')}>رد</Button>
                  </>
                )}
                {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                  <Button size="sm" variant="outline" loading={busy === `${b.id}:cancel`} onClick={() => act(b.id, 'cancel')}>لغو</Button>
                )}
                {b.status === 'CONFIRMED' && (
                  <Button size="sm" loading={busy === `${b.id}:complete`} onClick={() => act(b.id, 'complete')}>تکمیل</Button>
                )}
              </div>
            </Card></li>
          );
        })}</ul>
      )}
    </div>
  );
}
