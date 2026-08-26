'use client';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { PanelLoading } from '@/components/panel/state-blocks';

export default function PanelProfilePage() {
  const { user, loading } = useAuth();
  if (loading) return <PanelLoading />;
  if (!user) return null;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">پروفایل</h1>
        <p className="mt-1 text-sm text-gray">اطلاعات حساب از /auth/me</p></div>
      <Card className="space-y-3 text-sm">
        <Row label="نام نمایشی" value={user.profile?.displayName || '—'} />
        <Row label="شماره موبایل" value={user.phone || '—'} ltr />
        <Row label="ایمیل" value={user.email || '—'} ltr />
        <Row label="وضعیت" value={user.status} />
        <Row label="تأیید موبایل" value={user.phoneVerified ? 'بله' : 'خیر'} />
        <Row label="نقش‌ها" value={(user.roles || []).join('، ') || '—'} />
        {user.professional && (
          <>
            <Row label="شناسه زیباگر" value={user.professional.id} ltr />
            <Row label="اسلاگ" value={user.professional.slug} ltr />
            <Row label="وضعیت زیباگر" value={user.professional.status} />
          </>
        )}
      </Card>
      <p className="text-xs text-gray">به‌روزرسانی پروفایل مشتری در API فعلی پشتیبانی نمی‌شود (فقط خواندن از /auth/me).</p>
    </div>
  );
}
function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
      <span className="text-gray">{label}</span>
      <span className="font-medium" dir={ltr ? 'ltr' : undefined}>{value}</span>
    </div>
  );
}
