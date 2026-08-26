'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { fetchMyLocations, addMyLocation, type LocationItem } from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';

export default function ZibagarLocationsPage() {
  const [items, setItems] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await fetchMyLocations()); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function onAdd() {
    if (!name.trim() || !address.trim() || !city.trim()) return;
    setSubmitting(true); setError(null);
    try {
      await addMyLocation({ name: name.trim(), address: address.trim(), city: city.trim(), province: province.trim() || undefined, isPrimary });
      setName(''); setAddress(''); setCity(''); setProvince(''); setIsPrimary(false);
      await load();
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setSubmitting(false); }
  }
  if (loading) return <PanelLoading />;
  if (error && items.length === 0) return <PanelError message={error} onRetry={load} />;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">مکان‌ها</h1>
        <p className="mt-1 text-sm text-gray">آدرس‌های ارائه خدمت</p></div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Card className="space-y-3">
        <h2 className="font-semibold">افزودن مکان</h2>
        <Input placeholder="نام (مثلاً شعبه اصلی)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="آدرس کامل" value={address} onChange={(e) => setAddress(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="شهر" value={city} onChange={(e) => setCity(e.target.value)} />
          <Input placeholder="استان (اختیاری)" value={province} onChange={(e) => setProvince(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} /> مکان اصلی
        </label>
        <Button loading={submitting} onClick={onAdd}>افزودن</Button>
      </Card>
      {items.length === 0 ? <PanelEmpty title="مکانی ثبت نشده" /> : (
        <ul className="space-y-3">{items.map((loc) => (
          <li key={loc.id}><Card>
            <p className="font-semibold">{loc.name}{loc.isPrimary ? <span className="mr-2 text-xs text-coral"> (اصلی)</span> : null}</p>
            <p className="mt-1 text-sm text-gray">{loc.city}{loc.province ? ` · ${loc.province}` : ''}</p>
            <p className="text-sm text-gray">{loc.address}</p>
          </Card></li>
        ))}</ul>
      )}
    </div>
  );
}
