'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchMyServices, fetchPublicServices, fetchCategories,
  upsertMyService, deactivateMyService, type ProfessionalServiceItem,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice } from '@/lib/utils';

type CatalogOption = { id: string; name: string };

export default function ZibagarServicesPage() {
  const [items, setItems] = useState<ProfessionalServiceItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [durationMin, setDurationMin] = useState(60);
  const [price, setPrice] = useState(300000);
  const [bufferMin, setBufferMin] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [mine, cats] = await Promise.all([
        fetchMyServices(),
        fetchCategories().catch(() => null),
      ]);
      setItems(mine);
      const out: CatalogOption[] = [];
      if (cats?.length) {
        for (const c of cats) {
          for (const s of c.services || []) out.push({ id: s.id, name: `${c.name} — ${s.name}` });
          for (const ch of c.children || []) {
            for (const s of ch.services || []) out.push({ id: s.id, name: `${c.name} / ${ch.name} — ${s.name}` });
          }
        }
      }
      if (!out.length) {
        const publicList = await fetchPublicServices().catch(() => []);
        const list = Array.isArray(publicList) ? publicList : [];
        for (const s of list) out.push({ id: s.id, name: s.name });
      }
      setCatalog(out);
      if (!serviceId && out[0]) setServiceId(out[0].id);
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setLoading(false); }
  }, [serviceId]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function onUpsert() {
    if (!serviceId) return;
    setSubmitting(true); setError(null);
    try {
      await upsertMyService({ serviceId, durationMin, price, bufferMin: bufferMin || undefined });
      await load();
    } catch (e) { setError(friendlyApiError(e)); }
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
      <div>
        <h1 className="text-2xl font-bold">تخصص‌ها</h1>
        <p className="mt-1 text-sm text-gray">کاتالوگ خدمات، زیرمجموعه‌ها، قیمت و مدت</p>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Card className="space-y-3">
        <h2 className="font-semibold">افزودن / به‌روزرسانی تخصص</h2>
        {!catalog.length && (
          <p className="text-xs text-coral">کاتالوگ خالی است — سرویس‌ها باید در دیتابیس seed شوند.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-gray">خدمت از کاتالوگ</span>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="">انتخاب کنید</option>
              {catalog.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray">مدت (دقیقه)</span>
            <Input type="number" min={5} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className="mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-gray">قیمت (تومان)</span>
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-gray">بافر بین نوبت‌ها (دقیقه)</span>
            <Input type="number" min={0} value={bufferMin} onChange={(e) => setBufferMin(Number(e.target.value))} className="mt-1" />
          </label>
        </div>
        <Button loading={submitting} onClick={onUpsert} disabled={!serviceId}>ذخیره تخصص</Button>
      </Card>
      {items.length === 0 ? <PanelEmpty title="تخصصی ثبت نشده" /> : (
        <ul className="space-y-3">{items.map((s) => (
          <li key={s.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{s.service?.name || s.serviceId}</p>
                <p className="text-sm text-gray">
                  {s.durationMin} دقیقه · {formatPrice(s.price)}
                  {s.bufferMin ? ` · بافر ${s.bufferMin}` : ''}
                  {s.service?.category?.name ? ` · ${s.service.category.name}` : ''}
                </p>
              </div>
              <Button size="sm" variant="secondary" loading={busyId === s.id} onClick={() => onDeactivate(s.id)}>غیرفعال</Button>
            </Card>
          </li>
        ))}</ul>
      )}
    </div>
  );
}
