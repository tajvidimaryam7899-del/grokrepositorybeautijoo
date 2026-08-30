'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { fetchMyWorkingHours, setMyWorkingHours, addTimeOff, type WorkingHourItem } from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';

const DAYS = [
  { value: 'saturday', label: 'شنبه' },
  { value: 'sunday', label: 'یکشنبه' },
  { value: 'monday', label: 'دوشنبه' },
  { value: 'tuesday', label: 'سه‌شنبه' },
  { value: 'wednesday', label: 'چهارشنبه' },
  { value: 'thursday', label: 'پنج‌شنبه' },
  { value: 'friday', label: 'جمعه' },
];

function dayLabel(v: string) {
  const found = DAYS.find((d) => d.value === v.toLowerCase() || d.value === v);
  if (found) return found.label;
  const upper: Record<string, string> = {
    SATURDAY: 'شنبه', SUNDAY: 'یکشنبه', MONDAY: 'دوشنبه', TUESDAY: 'سه‌شنبه',
    WEDNESDAY: 'چهارشنبه', THURSDAY: 'پنج‌شنبه', FRIDAY: 'جمعه',
  };
  return upper[v] || v;
}

export default function ZibagarHoursPage() {
  const [items, setItems] = useState<WorkingHourItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>(['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday']);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('20:00');
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

  function toggleDay(day: string) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  async function onSetHours() {
    if (!selectedDays.length) {
      setError('حداقل یک روز انتخاب کنید');
      return;
    }
    setSubmitting(true); setError(null);
    try {
      for (const day of selectedDays) {
        await setMyWorkingHours({ dayOfWeek: day, startTime, endTime });
      }
      await load();
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setSubmitting(false); }
  }

  async function onTimeOff() {
    if (!offStart || !offEnd) return;
    setSubmitting(true); setError(null);
    try {
      await addTimeOff({
        startAt: new Date(offStart).toISOString(),
        endAt: new Date(offEnd).toISOString(),
        reason: offReason.trim() || undefined,
      });
      setOffReason('');
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setSubmitting(false); }
  }

  if (loading) return <PanelLoading />;
  if (error && items.length === 0) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ساعات کاری</h1>
        <p className="mt-1 text-sm text-gray">روزها و بازه زمانی حضور</p>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Card className="space-y-3">
        <h2 className="font-semibold">ثبت / به‌روزرسانی</h2>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                selectedDays.includes(d.value)
                  ? 'border-coral bg-coral text-white'
                  : 'border-border bg-white text-gray'
              }`}
            >{d.label}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray">شروع</span>
            <Input className="mt-1" type="time" dir="ltr" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-gray">پایان</span>
            <Input className="mt-1" type="time" dir="ltr" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>
        <Button loading={submitting} onClick={onSetHours}>ذخیره ساعات</Button>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">مرخصی / تعطیلی موقت</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray">از</span>
            <Input className="mt-1" type="datetime-local" dir="ltr" value={offStart} onChange={(e) => setOffStart(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-gray">تا</span>
            <Input className="mt-1" type="datetime-local" dir="ltr" value={offEnd} onChange={(e) => setOffEnd(e.target.value)} />
          </label>
        </div>
        <Input placeholder="دلیل (اختیاری)" value={offReason} onChange={(e) => setOffReason(e.target.value)} />
        <Button variant="secondary" loading={submitting} onClick={onTimeOff}>ثبت مرخصی</Button>
      </Card>
      {items.length === 0 ? <PanelEmpty title="ساعت کاری ثبت نشده" /> : (
        <ul className="space-y-2">{items.map((h, i) => (
          <li key={h.id || `${h.dayOfWeek}-${i}`}>
            <Card className="flex justify-between text-sm">
              <span>{dayLabel(h.dayOfWeek)}</span>
              <span dir="ltr">{h.startTime} – {h.endTime}</span>
            </Card>
          </li>
        ))}</ul>
      )}
    </div>
  );
}
