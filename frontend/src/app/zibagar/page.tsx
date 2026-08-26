'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import { fetchProBookings, fetchMyServices } from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';

export default function ZibagarDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingCount, setBookingCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      try {
        const [bookings, services] = await Promise.all([
          fetchProBookings(1, 5),
          fetchMyServices().catch(() => []),
        ]);
        if (c) return;
        setBookingCount(bookings.items.length);
        setServiceCount(services.length);
      } catch (e) { if (!c) setError(friendlyApiError(e)); }
      finally { if (!c) setLoading(false); }
    })();
    return () => { c = true; };
  }, []);
  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} />;
  const title = user?.professional?.title || user?.profile?.displayName || 'زیباگر';
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">پنل زیباگر</h1>
        <p className="mt-1 text-sm text-gray">{title}</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-semibold">رزروهای ورودی</h2>
          <p className="text-sm text-gray">{bookingCount > 0 ? `${bookingCount} مورد در صفحه اول` : 'رزرو جدیدی نیست'}</p>
          <Link href="/zibagar/bookings"><Button size="sm">مدیریت رزروها</Button></Link>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-semibold">تخصص‌ها</h2>
          <p className="text-sm text-gray">{serviceCount > 0 ? `${serviceCount} تخصص فعال` : 'هنوز تخصصی تعریف نشده'}</p>
          <Link href="/zibagar/services"><Button size="sm" variant="secondary">مدیریت تخصص‌ها</Button></Link>
        </Card>
      </div>
    </div>
  );
}
