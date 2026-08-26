'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PanelSettingsPage() {
  const { logout, user } = useAuth();
  const router = useRouter();
  async function onLogout() { await logout(); router.replace('/login'); }
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">تنظیمات</h1>
        <p className="mt-1 text-sm text-gray">مدیریت نشست و دسترسی</p></div>
      <Card className="space-y-4">
        <p className="text-sm text-gray">وارد شده با: <span className="font-medium text-foreground" dir="ltr">{user?.phone || user?.id}</span></p>
        <Button variant="secondary" onClick={onLogout}>خروج از حساب</Button>
      </Card>
    </div>
  );
}
