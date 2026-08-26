'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { fetchMyWorkingHours, setMyWorkingHours, addTimeOff, type WorkingHourItem } from '@/lib/panel-api';
import { WEEKDAY_FA } from '@/lib/persian-status';
import { friendlyApiError } from '@/lib/api-errors';

const DAYS = ['SATURDAY','SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'];

export default function ZibagarHoursPage() {
  const [items, setItems] = useState<WorkingHourItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState('SATURDAY');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [offStart, setOffStart] = useState('');
  const [offEnd, setOffEnd] = useState('');
  const [offReason, setOffReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await fetchMyWorkingHours()); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function onSetHours() {
    setSubmitting(true); setError(null);
    try { await setMyWorkingHours({ dayOfWeek, startTime, endTime }); await load(); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setSubmitting(false); }
  }
  async function onTimeOff() {
    if (!offStart || !offEnd) return;
    setSubmitting(true); setError(null);
    try {
      await addTimeOff({ startAt: new Date(offStart).toISOString(), endAt: new Date(offEnd).toISOString(), reason: offReason.trim() || undefined });
      setOffReason('');
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setSubmitting(false); }
  }
  if (loading) return <PanelLoading />;
  if (error && items.length === 0) return <PanelError message={error} onRetry={load} />;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">ساعات کاری</h1>
        <p className="mt-1 text-sm text-gray">تعیین روز و بازه زمانی</p></div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Card className="space-y-3">
        <h2 className="font-semibold">ثبت / به‌روزرسانی روز</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm"><span className="text-gray">روز</span>
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className="mt-1 w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm">
              {DAYS.map((d) => <option key={d} value={d}>{WEEKDAY_FA[d] || d}</option>)}
            </select></label>
          <label className="block text-sm"><span className="text-gray">شروع</span>
            <Input className="mt-1" dir="ltr" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
          <label className="block text-sm"><span className="text-gray">پایان</span>
            <Input className="mt-1" dir="ltr" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
        </div>
        <Button loading={submitting} onClick={onSetHours}>ذخیره ساعات</Button>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">مرخصی / تعطیلی موقت</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm"><span className="text-gray">از</span>
            <Input className="mt-1" type="datetime-local" dir="ltr" value={offStart} onChange={(e) => setOffStart(e.target.value)} /></label>
          <label className="block text-sm"><span className="text-gray">تا</span>
            <Input className="mt-1" type="datetime-local" dir="ltr" value={offEnd} onChange={(e) => setOffEnd(e.target.value)} /></label>
        </div>
        <Input placeholder="دلیل (اختیاری)" value={offReason} onChange={(e) => setOffReason(e.target.value)} />
        <Button variant="secondary" loading={submitting} onClick={onTimeOff}>ثبت مرخصی</Button>
      </Card>
      {items.length === 0 ? <PanelEmpty title="ساعت کاری ثبت نشده" /> : (
        <ul className="space-y-2">{items.map((h, i) => (
          <li key={h.id || `${h.dayOfWeek}-${i}`}><Card className="flex justify-between text-sm">
            <span>{WEEKDAY_FA[h.dayOfWeek] || h.dayOfWeek}</span>
            <span dir="ltr">{h.startTime} – {h.endTime}</span>
          </Card></li>
        ))}</ul>
      )}
    </div>
  );
}
