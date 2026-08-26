'use client';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
/** Backend only exposes POST /reviews. No GET list — contract gap. */
export default function PanelReviewsPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">نظرات من</h1>
        <p className="mt-1 text-sm text-gray">ثبت نظر از رزروهای تکمیل‌شده</p></div>
      <Card className="space-y-3">
        <p className="text-sm text-gray">
          API فعلی فقط POST /reviews را دارد و فهرست نظرات کاربر را برنمی‌گرداند.
          برای ثبت نظر از صفحه رزروهای تکمیل‌شده استفاده کنید.
        </p>
        <Link href="/panel/bookings"><Button size="sm">رفتن به رزروها</Button></Link>
      </Card>
    </div>
  );
}
