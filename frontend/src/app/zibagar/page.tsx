'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import { CompletionBar } from '@/components/profile/completion-bar';
import { fetchProBookings, fetchMyServices, fetchMyProfessional } from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';

export default function ZibagarDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingCount, setBookingCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [percent, setPercent] = useState(0);
  const [complete, setComplete] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      try {
        const [bookings, services, pro] = await Promise.all([
          fetchProBookings(1, 5).catch(() => ({ items: [] as unknown[] })),
          fetchMyServices().catch(() => []),
          fetchMyProfessional().catch(() => null),
        ]);
        if (c) return;
        setBookingCount(bookings.items.length);
        setServiceCount(services.length);
        if (pro) {
          setPercent(pro.completion?.percent ?? 0);
          setComplete(!!pro.completion?.complete);
          setStatus(pro.status);
          setSlug(pro.slug);
        }
      } catch (e) {
        if (!c) setError(friendlyApiError(e));
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => { c = true; };
  }, []);

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} />;
  const title = user?.professional?.title || user?.profile?.displayName || 'زیباگر';
  const published = status === 'approved';
  const showOps = published || complete;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">پنل زیباگر</h1>
        <p className="mt-1 text-sm text-gray">{title}</p>
      </div>

      <Card className="space-y-3">
        {published ? (
          <>
            <h2 className="font-semibold text-blue">پروفایل منتشر شده ✓</h2>
            <CompletionBar percent={100} />
            <div className="flex flex-wrap gap-2">
              {slug && (
                <Link href={`/professionals/${slug}`}>
                  <Button size="sm">مشاهده صفحه عمومی</Button>
                </Link>
              )}
              <Link href="/zibagar/profile">
                <Button variant="outline" size="sm">مدیریت پروفایل</Button>
              </Link>
            </div>
          </>
        ) : complete ? (
          <>
            <h2 className="font-semibold text-blue">اطلاعات پروفایل کامل است ✓</h2>
            <CompletionBar percent={percent} />
            <div className="flex flex-wrap gap-2">
              <Link href="/zibagar/profile/preview">
                <Button variant="secondary" size="sm">مشاهده پیش‌نمایش</Button>
              </Link>
              <Link href="/zibagar/profile/complete">
                <Button size="sm">انتشار پروفایل</Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-semibold">تکمیل پروفایل — {percent}%</h2>
            <CompletionBar percent={percent} />
            <p className="text-sm text-gray">
              برای نمایش در سایت و دریافت رزرو، ابتدا پروفایل را کامل کنید.
            </p>
            <Link href="/zibagar/profile/complete">
              <Button size="sm">ادامه تکمیل پروفایل</Button>
            </Link>
          </>
        )}
      </Card>

      {showOps && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="space-y-3">
            <h2 className="font-semibold">رزروهای ورودی</h2>
            <p className="text-sm text-gray">
              {bookingCount > 0 ? `${bookingCount} مورد در صفحه اول` : 'رزرو جدیدی نیست'}
            </p>
            <Link href="/zibagar/bookings"><Button size="sm">مدیریت رزروها</Button></Link>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold">تخصص‌ها</h2>
            <p className="text-sm text-gray">
              {serviceCount > 0 ? `${serviceCount} تخصص فعال` : 'هنوز تخصصی تعریف نشده'}
            </p>
            <Link href="/zibagar/services">
              <Button size="sm" variant="secondary">مدیریت تخصص‌ها</Button>
            </Link>
          </Card>
        </div>
      )}
    </div>
  );
}
