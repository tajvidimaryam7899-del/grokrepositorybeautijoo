'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { fetchMyServices, fetchPublicServices, upsertMyService, deactivateMyService, type ProfessionalServiceItem } from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice } from '@/lib/utils';

export default function ZibagarServicesPage() {
  const [items, setItems] = useState<ProfessionalServiceItem[]>([]);
  const [catalog, setCatalog] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [price, setPrice] = useState(0);
  const [bufferMin, setBufferMin] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [mine, publicList] = await Promise.all([
        fetchMyServices(),
        fetchPublicServices().catch(() => []),
      ]);
      setItems(mine);
      const list = Array.isArray(publicList) ? publicList : [];
      setCatalog(list);
      if (!serviceId && list[0]) setServiceId(list[0].id);
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setLoading(false); }
  }, [serviceId]);
  useEffect(() => { load(); }, []); // eslint-disable-line
  async function onUpsert() {
    if (!serviceId) return;
    setSubmitting(true); setError(null);
    try { await upsertMyService({ serviceId, durationMin, price, bufferMin: bufferMin || undefined }); await load(); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setSubmitting(false); }
  }
  async function onDeactivate(id: string) {
    setBusyId(id);
    try { await deactivateMyService(id); await load(); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setBusyId(null); }
  }
  if (loading) return <PanelLoading />;
  if (error && items.length === 0) return <PanelError message={error} onRetry={load} />;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">تخصص‌ها</h1>
        <p className="mt-1 text-sm text-gray">مدیریت خدمات و قیمت‌ها</p></div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Card className="space-y-3">
        <h2 className="font-semibold">افزودن / به‌روزرسانی تخصص</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm"><span className="text-gray">خدمت کاتالوگ</span>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="mt-1 w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm">
              {catalog.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block text-sm"><span className="text-gray">مدت (دقیقه)</span>
            <Input type="number" min={5} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className="mt-1" /></label>
          <label className="block text-sm"><span className="text-gray">قیمت (تومان)</span>
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-1" /></label>
          <label className="block text-sm"><span className="text-gray">بافر (دقیقه)</span>
            <Input type="number" min={0} value={bufferMin} onChange={(e) => setBufferMin(Number(e.target.value))} className="mt-1" /></label>
        </div>
        <Button loading={submitting} onClick={onUpsert}>ذخیره تخصص</Button>
      </Card>
      {items.length === 0 ? <PanelEmpty title="تخصصی ثبت نشده" /> : (
        <ul className="space-y-3">{items.map((s) => (
          <li key={s.id}><Card className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-semibold">{s.service?.name || s.serviceId}</p>
              <p className="text-sm text-gray">{s.durationMin} دقیقه · {formatPrice(s.price)}{s.bufferMin ? ` · بافر ${s.bufferMin}` : ''}</p></div>
            <Button size="sm" variant="secondary" loading={busyId === s.id} onClick={() => onDeactivate(s.id)}>غیرفعال</Button>
          </Card></li>
        ))}</ul>
      )}
    </div>
  );
}
