'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { fetchAdminBookings, type BookingListItem } from '@/lib/panel-api';
import { persianBookingStatus } from '@/lib/persian-status';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice } from '@/lib/utils';

export default function AdminBookingsPage() {
  const [items, setItems] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await fetchAdminBookings(1, 50)).items); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">رزروها (ادمین)</h1>
        <p className="mt-1 text-sm text-gray">لیست از /admin/bookings</p></div>
      {items.length === 0 ? <PanelEmpty title="رزروی یافت نشد" /> : (
        <ul className="space-y-2">{items.map((b) => (
          <li key={b.id}><Card className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <p className="font-semibold" dir="ltr">{b.id.slice(0, 8)}…</p>
              <p className="text-xs text-gray" dir="ltr">{new Date(b.startAt).toLocaleString('fa-IR')}</p>
              {b.totalPrice != null && <p className="text-xs text-gray">{formatPrice(b.totalPrice)}</p>}
            </div>
            <span className="rounded-full bg-coral-soft px-3 py-1 text-xs text-coral">{persianBookingStatus(b.status)}</span>
          </Card></li>
        ))}</ul>
      )}
    </div>
  );
}
