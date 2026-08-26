'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    router.replace('/panel');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^09\d{9}$/.test(phone.trim())) {
      setError('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد');
      return;
    }
    if (password.length < 8) {
      setError('رمز عبور حداقل ۸ کاراکتر باشد');
      return;
    }
    setLoading(true);
    try {
      await register(
        phone.trim(),
        password,
        displayName.trim() || undefined,
      );
      router.replace('/panel');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'ثبت‌نام ناموفق بود. دوباره تلاش کنید.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold">ثبت‌نام در Beautijoo</h1>
        <p className="mt-2 text-sm text-gray">ایجاد حساب مشتری</p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">نام نمایشی</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="مثلاً مریم رضایی"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">شماره موبایل</label>
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="09123456789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
              className="text-left"
              autoComplete="tel"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">رمز عبور</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="حداقل ۸ کاراکتر"
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={loading}>
            ثبت‌نام
          </Button>
        </form>

        <div className="mt-6 border-t border-border pt-4 text-center text-sm text-gray">
          قبلاً ثبت‌نام کرده‌اید؟{' '}
          <Link href="/login" className="font-medium text-coral hover:underline">
            ورود
          </Link>
        </div>
      </Card>
    </div>
  );
}
