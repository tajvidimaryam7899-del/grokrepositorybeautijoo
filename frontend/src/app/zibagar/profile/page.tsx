'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading } from '@/components/panel/state-blocks';
import { updateMyProfessional } from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { persianProfessionalStatus } from '@/lib/persian-status';

export default function ZibagarProfilePage() {
  const { user, loading, reload } = useAuth();
  const [title, setTitle] = useState(user?.professional?.title || '');
  const [bio, setBio] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  if (loading) return <PanelLoading />;
  if (!user) return null;
  async function onSave() {
    setSubmitting(true); setError(null); setMsg(null);
    try {
      await updateMyProfessional({ title: title.trim() || undefined, bio: bio.trim() || undefined });
      setMsg('پروفایل زیباگر به‌روزرسانی شد.');
      await reload();
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setSubmitting(false); }
  }
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">پروفایل زیباگر</h1>
        <p className="mt-1 text-sm text-gray">ویرایش عنوان و بیو</p></div>
      <Card className="space-y-3 text-sm">
        <Row label="وضعیت" value={user.professional ? persianProfessionalStatus(user.professional.status) : 'بدون پروفایل زیباگر'} />
        <Row label="اسلاگ" value={user.professional?.slug || '—'} ltr />
        <Row label="شناسه" value={user.professional?.id || '—'} ltr />
      </Card>
      <Card className="space-y-3">
        <label className="block text-sm"><span className="text-gray">عنوان</span>
          <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً متخصص پوست و مو" /></label>
        <label className="block text-sm"><span className="text-gray">بیو</span>
          <textarea className="mt-1 w-full rounded-2xl border border-border px-3 py-2 text-sm outline-none focus:border-coral" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="معرفی کوتاه" /></label>
        {msg && <p className="rounded-xl bg-blue-light px-3 py-2 text-sm text-blue">{msg}</p>}
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button loading={submitting} onClick={onSave}>ذخیره</Button>
      </Card>
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
