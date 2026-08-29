'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import { fetchMyPreview, type OwnProfessional } from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice } from '@/lib/utils';

const DAY_FA: Record<string, string> = {
  saturday: 'شنبه', sunday: 'یکشنبه', monday: 'دوشنبه', tuesday: 'سه‌شنبه',
  wednesday: 'چهارشنبه', thursday: 'پنجشنبه', friday: 'جمعه',
};

export default function ProfilePreviewPage() {
  const { user, loading: authLoading } = useAuth();
  const [pro, setPro] = useState<OwnProfessional | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (authLoading || !user) return;
    let c = false;
    (async () => {
      try {
        const data = await fetchMyPreview();
        if (!c) setPro(data);
      } catch (e) {
        if (!c) setError(friendlyApiError(e));
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => { c = true; };
  }, [authLoading, user]);
  if (authLoading || loading) return <PanelLoading />;
  if (error) return <PanelError message={error} />;
  if (!pro) return null;
  const name =
    pro.user?.profile?.displayName ||
    [pro.user?.profile?.firstName, pro.user?.profile?.lastName].filter(Boolean).join(' ') ||
    pro.title;
  const city = pro.locations?.[0]?.location?.city;
  const avatar = pro.user?.profile?.avatarUrl;
  const cover = pro.coverImageUrl;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">پیش‌نمایش پروفایل</h1>
          <p className="mt-1 text-sm text-gray">
            {pro.status !== 'approved' ? 'پیش‌نویس — فقط برای شما' : 'منتشر شده'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/zibagar/profile/complete">
            <Button variant="outline" size="sm">ادامه تکمیل</Button>
          </Link>
          {pro.status === 'approved' && (
            <Link href={`/professionals/${pro.slug}`}>
              <Button size="sm">صفحه عمومی</Button>
            </Link>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border">
        <div
          className="h-36 bg-gradient-to-l from-coral-soft to-blue-light sm:h-44"
          style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        />
        <div className="relative space-y-4 px-4 pb-6 sm:px-6">
          <div className="-mt-10 flex items-end gap-3">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-gray-light text-2xl font-bold text-blue">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                (name || 'ز')[0]
              )}
            </div>
            <div className="pb-1">
              <h2 className="text-xl font-bold">{name}</h2>
              <p className="text-sm text-gray">{pro.title}{city ? ` · ${city}` : ''}</p>
            </div>
          </div>
          {pro.bio && <p className="text-sm leading-7 text-gray-dark">{pro.bio}</p>}
          <Card className="space-y-2">
            <h3 className="font-semibold">خدمات</h3>
            <ul className="divide-y divide-border">
              {(pro.professionalServices || []).filter((s) => s.isActive !== false).map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{s.service?.name} <span className="text-gray">({s.durationMin} دقیقه)</span></span>
                  <span dir="ltr">{formatPrice(s.price)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="space-y-2">
            <h3 className="font-semibold">موقعیت</h3>
            {(pro.locations || []).map((l, i) => (
              <p key={i} className="text-sm">
                {l.location.name} — {l.location.city}
                <br />
                <span className="text-gray">{l.location.address}</span>
              </p>
            ))}
          </Card>
          <Card className="space-y-2">
            <h3 className="font-semibold">ساعات کاری</h3>
            <ul className="space-y-1 text-sm">
              {(pro.workingHours || []).map((h, i) => (
                <li key={i} className="flex justify-between">
                  <span>{DAY_FA[h.dayOfWeek] || h.dayOfWeek}</span>
                  <span dir="ltr">{h.startTime} – {h.endTime}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
