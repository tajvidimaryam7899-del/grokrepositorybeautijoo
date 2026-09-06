'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import {
  fetchMyWorkingHours, setMyWorkingHours, fetchMyTimeOffs, addTimeOff, removeTimeOff,
  fetchProBookings, type WorkingHourItem, type TimeOffItem, type BookingListItem,
} from '@/lib/schedule-api';
import { friendlyApiError } from '@/lib/api-errors';
import {
  addJalaliMonths, buildJalaliMonthGrid, dayOfWeekFromIso, isoToJalaliLabel,
  jalaliMonthName, pad2, PERSIAN_WEEKDAYS, toJalali, todayIsoTehran, type DayOfWeekValue,
} from '@/lib/jalali';

const DAYS: { value: DayOfWeekValue; label: string }[] = [
  { value: 'saturday', label: 'شنبه' }, { value: 'sunday', label: 'یکشنبه' },
  { value: 'monday', label: 'دوشنبه' }, { value: 'tuesday', label: 'سه‌شنبه' },
  { value: 'wednesday', label: 'چهارشنبه' }, { value: 'thursday', label: 'پنج‌شنبه' },
  { value: 'friday', label: 'جمعه' },
];
const INTERVALS = [15, 30, 45, 60, 90, 120] as const;

const pm = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const fm = (mins: number) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
const tehranRange = (iso: string, a: string, b: string) => {
  const [y, mo, d] = iso.split('-').map(Number);
  const [sh, sm] = a.split(':').map(Number);
  const [eh, em] = b.split(':').map(Number);
  const off = 3.5 * 3600000;
  return {
    startAt: new Date(Date.UTC(y, mo - 1, d, sh, sm) - off).toISOString(),
    endAt: new Date(Date.UTC(y, mo - 1, d, eh, em) - off).toISOString(),
  };
};

export default function ZibagarHoursPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [workingHours, setWorkingHours] = useState<WorkingHourItem[]>([]);
  const [timeOffs, setTimeOffs] = useState<TimeOffItem[]>([]);
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const todayIso = todayIsoTehran();
  const todayJ = useMemo(() => { const [gy, gm, gd] = todayIso.split('-').map(Number); return toJalali(gy, gm, gd); }, [todayIso]);
  const [viewJy, setViewJy] = useState(todayJ.jy);
  const [viewJm, setViewJm] = useState(todayJ.jm);
  const [selectedIso, setSelectedIso] = useState(todayIso);
  const [dayDrafts, setDayDrafts] = useState<Record<string, { active: boolean; startTime: string; endTime: string }>>(() => {
    const o: Record<string, { active: boolean; startTime: string; endTime: string }> = {};
    DAYS.forEach((d) => { o[d.value] = { active: false, startTime: '09:00', endTime: '20:00' }; });
    return o;
  });
  const [intervalMin, setIntervalMin] = useState(30);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockDate, setBlockDate] = useState(todayIso);
  const [blockFrom, setBlockFrom] = useState('14:00');
  const [blockTo, setBlockTo] = useState('17:00');
  const [blockReason, setBlockReason] = useState('');

  const applyHours = useCallback((items: WorkingHourItem[]) => {
    const next: Record<string, { active: boolean; startTime: string; endTime: string }> = {};
    DAYS.forEach((d) => {
      const rows = items.filter((h) => String(h.dayOfWeek).toLowerCase() === d.value && h.isActive !== false);
      if (rows.length) {
        const s = [...rows].sort((a, b) => pm(a.startTime) - pm(b.startTime));
        next[d.value] = { active: true, startTime: s[0].startTime.slice(0, 5), endTime: s[s.length - 1].endTime.slice(0, 5) };
      } else next[d.value] = { active: false, startTime: '09:00', endTime: '20:00' };
    });
    setDayDrafts(next);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [h, o, b] = await Promise.all([
        fetchMyWorkingHours(),
        fetchMyTimeOffs().catch(() => [] as TimeOffItem[]),
        fetchProBookings(1, 100).then((r) => r.items).catch(() => [] as BookingListItem[]),
      ]);
      setWorkingHours(h); setTimeOffs(o); setBookings(b); applyHours(h);
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setLoading(false); }
  }, [applyHours]);
  useEffect(() => { load(); }, [load]);

  const monthGrid = useMemo(() => buildJalaliMonthGrid(viewJy, viewJm), [viewJy, viewJm]);
  const activeDays = useMemo(() => {
    const s = new Set<string>();
    workingHours.forEach((h) => { if (h.isActive !== false) s.add(String(h.dayOfWeek).toLowerCase()); });
    return s;
  }, [workingHours]);

  const daySlots = useMemo(() => {
    const dow = dayOfWeekFromIso(selectedIso);
    const draft = dayDrafts[dow];
    if (!draft?.active) return [] as { start: string; end: string; status: string; id?: string; name?: string }[];
    const startM = pm(draft.startTime), endM = pm(draft.endTime);
    if (endM <= startM) return [];
    const off = 3.5 * 3600000;
    const dayBooks = bookings.filter((b) => {
      if (!b.startAt) return false;
      const st = (b.status || '').toLowerCase();
      if (st === 'cancelled' || st === 'rejected') return false;
      const t = new Date(new Date(b.startAt).getTime() + off);
      return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}` === selectedIso;
    });
    const dayOffs = timeOffs.filter((t) => {
      const [y, m, d] = selectedIso.split('-').map(Number);
      const ds = Date.UTC(y, m - 1, d) - off;
      return new Date(t.startAt).getTime() < ds + 86400000 && new Date(t.endAt).getTime() > ds;
    });
    const out: { start: string; end: string; status: string; id?: string; name?: string }[] = [];
    for (let t = startM; t + intervalMin <= endM; t += intervalMin) {
      const se = t + intervalMin;
      const start = fm(t), end = fm(se);
      const booked = dayBooks.find((b) => {
        const s = new Date(b.startAt);
        const e = b.endAt ? new Date(b.endAt) : new Date(s.getTime() + 1800000);
        const th = new Date(s.getTime() + off);
        const ds = Date.UTC(th.getUTCFullYear(), th.getUTCMonth(), th.getUTCDate()) - off;
        const bs = Math.max(0, Math.round((s.getTime() - ds) / 60000));
        const be = Math.max(0, Math.round((e.getTime() - ds) / 60000));
        return t < be && se > bs;
      });
      if (booked) { out.push({ start, end, status: 'booked', name: booked.customer?.profile?.displayName || 'مشتری' }); continue; }
      const blk = dayOffs.find((item) => {
        const [y, m, d] = selectedIso.split('-').map(Number);
        const ds = Date.UTC(y, m - 1, d) - off;
        const bs = Math.max(0, Math.round((new Date(item.startAt).getTime() - ds) / 60000));
        const be = Math.min(1440, Math.round((new Date(item.endAt).getTime() - ds) / 60000));
        return t < be && se > bs;
      });
      if (blk) { out.push({ start, end, status: 'blocked', id: blk.id }); continue; }
      if (selectedIso < todayIso) { out.push({ start, end, status: 'closed' }); continue; }
      out.push({ start, end, status: 'free' });
    }
    return out;
  }, [selectedIso, dayDrafts, intervalMin, bookings, timeOffs, todayIso]);

  if (loading) return <PanelLoading label="در حال بارگذاری زمان‌بندی..." />;
  if (error && !workingHours.length) return <PanelError message={error} onRetry={load} />;
  const dow = dayOfWeekFromIso(selectedIso);
  const dowLabel = DAYS.find((d) => d.value === dow)?.label || '';

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">مدیریت زمان کاری</h1>
          <p className="mt-1 text-sm text-gray">روزها، ساعات، فاصله نوبت و وضعیت اسلات‌ها</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => { setBlockDate(selectedIso); setBlockOpen(true); }}>مسدود کردن بازه</Button>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <button type="button" className="rounded-xl border px-3 py-1.5 text-sm" onClick={() => { const n = addJalaliMonths(viewJy, viewJm, -1); setViewJy(n.jy); setViewJm(n.jm); }}>‹</button>
          <p className="font-semibold">{jalaliMonthName(viewJm)} {viewJy}</p>
          <button type="button" className="rounded-xl border px-3 py-1.5 text-sm" onClick={() => { const n = addJalaliMonths(viewJy, viewJm, 1); setViewJy(n.jy); setViewJm(n.jm); }}>›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray">{PERSIAN_WEEKDAYS.map((w) => <div key={w}>{w}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {monthGrid.map((cell) => {
            const isSel = cell.iso === selectedIso;
            return (
              <button key={cell.iso + String(cell.inMonth)} type="button" disabled={!cell.inMonth}
                onClick={() => { if (cell.inMonth) { setSelectedIso(cell.iso); setSelectedSlots([]); } }}
                className={`flex min-h-11 flex-col items-center justify-center rounded-xl text-sm ${!cell.inMonth ? 'text-gray/30' : 'hover:bg-coral-soft'} ${isSel ? 'bg-coral text-white' : ''} ${!isSel && cell.iso === todayIso ? 'ring-1 ring-coral/40' : ''}`}>
                <span className="font-medium">{cell.jd}</span>
                {cell.inMonth && activeDays.has(dayOfWeekFromIso(cell.iso)) && <span className={`mt-0.5 h-1 w-1 rounded-full ${isSel ? 'bg-white' : 'bg-coral'}`} />}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">ساعات کاری هفتگی</h2>
        {DAYS.map((d) => {
          const draft = dayDrafts[d.value];
          return (
            <div key={d.value} className="flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setDayDrafts((p) => ({ ...p, [d.value]: { ...p[d.value], active: !draft.active } }))}
                  className={`relative h-7 w-12 rounded-full ${draft.active ? 'bg-coral' : 'bg-gray-light'}`}>
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow ${draft.active ? 'right-0.5' : 'left-0.5'}`} />
                </button>
                <span className="text-sm font-medium">{d.label}</span>
              </div>
              <div className={`flex gap-2 ${draft.active ? '' : 'opacity-40 pointer-events-none'}`}>
                <Input className="w-[7.5rem]" type="time" dir="ltr" value={draft.startTime} onChange={(e) => setDayDrafts((p) => ({ ...p, [d.value]: { ...p[d.value], startTime: e.target.value } }))} />
                <Input className="w-[7.5rem]" type="time" dir="ltr" value={draft.endTime} onChange={(e) => setDayDrafts((p) => ({ ...p, [d.value]: { ...p[d.value], endTime: e.target.value } }))} />
              </div>
            </div>
          );
        })}
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">فاصله نوبت</h2>
        <div className="flex flex-wrap gap-2">
          {INTERVALS.map((n) => (
            <button key={n} type="button" onClick={() => { setIntervalMin(n); setSelectedSlots([]); }}
              className={`rounded-full border px-3 py-1.5 text-sm ${intervalMin === n ? 'border-coral bg-coral text-white' : 'border-border'}`}>{n} دقیقه</button>
          ))}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">روز انتخاب‌شده</h2>
            <p className="text-sm text-gray">{dowLabel} — {isoToJalaliLabel(selectedIso)}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={submitting || !selectedSlots.length} onClick={async () => {
              setSubmitting(true); setError(null);
              try {
                for (const s of daySlots.filter((x) => selectedSlots.includes(x.start) && x.status === 'free')) {
                  await addTimeOff({ ...tehranRange(selectedIso, s.start, s.end), reason: 'بسته توسط زیباگر' });
                }
                setSelectedSlots([]); setSuccess('زمان‌ها بسته شد'); await load();
              } catch (e) { setError(friendlyApiError(e)); }
              finally { setSubmitting(false); }
            }}>بستن</Button>
            <Button type="button" size="sm" variant="secondary" disabled={submitting || !selectedSlots.length} onClick={async () => {
              setSubmitting(true); setError(null);
              try {
                const ids = Array.from(new Set(daySlots.filter((s) => selectedSlots.includes(s.start) && s.id).map((s) => s.id!)));
                for (const id of ids) await removeTimeOff(id);
                setSelectedSlots([]); setSuccess('زمان‌ها باز شد'); await load();
              } catch (e) { setError(friendlyApiError(e)); }
              finally { setSubmitting(false); }
            }}>باز کردن</Button>
          </div>
        </div>
        {!dayDrafts[dow]?.active ? (
          <p className="rounded-xl bg-gray-light/60 px-3 py-6 text-center text-sm text-gray">این روز غیرفعال است.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {daySlots.map((slot) => {
              const selected = selectedSlots.includes(slot.start);
              const cls = slot.status === 'free' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : slot.status === 'booked' ? 'border-red-200 bg-red-50 text-red-800 cursor-not-allowed'
                : slot.status === 'blocked' ? 'border-orange-200 bg-orange-50 text-orange-800'
                : 'border-border bg-gray-light text-gray cursor-not-allowed';
              return (
                <button key={slot.start} type="button" disabled={slot.status === 'booked' || slot.status === 'closed'}
                  onClick={() => { if (slot.status === 'booked' || slot.status === 'closed') return; setSelectedSlots((p) => p.includes(slot.start) ? p.filter((x) => x !== slot.start) : [...p, slot.start]); }}
                  className={`min-h-[3.25rem] rounded-2xl border px-2 py-2 text-start text-sm ${cls} ${selected ? 'ring-2 ring-coral' : ''}`}>
                  <div className="flex justify-between" dir="ltr"><span className="font-medium">{slot.start}</span>
                    <span className="text-[10px]">{slot.status === 'free' ? 'آزاد' : slot.status === 'booked' ? 'رزرو' : slot.status === 'blocked' ? 'مسدود' : 'بسته'}</span>
                  </div>
                  {slot.name && <p className="mt-1 line-clamp-1 text-[11px]">{slot.name}</p>}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <div className="sticky bottom-3 z-10">
        <Button className="w-full shadow-md" size="lg" loading={submitting} onClick={async () => {
          setSubmitting(true); setError(null); setSuccess(null);
          try {
            for (const d of DAYS) {
              const draft = dayDrafts[d.value];
              const existing = workingHours.filter((h) => String(h.dayOfWeek).toLowerCase() === d.value);
              if (draft.active) {
                if (pm(draft.endTime) <= pm(draft.startTime)) throw new Error('ساعت نامعتبر');
                await setMyWorkingHours({ dayOfWeek: d.value, startTime: draft.startTime, endTime: draft.endTime, isActive: true });
              } else {
                for (const row of existing) {
                  await setMyWorkingHours({ dayOfWeek: d.value, startTime: row.startTime.slice(0, 5), endTime: row.endTime.slice(0, 5), isActive: false });
                }
              }
            }
            setSuccess('ساعات کاری ذخیره شد'); await load();
          } catch (e) { setError(friendlyApiError(e)); }
          finally { setSubmitting(false); }
        }}>ذخیره تغییرات</Button>
      </div>

      {blockOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl space-y-3">
            <h3 className="text-lg font-semibold">مسدود کردن بازه</h3>
            <Input type="date" dir="ltr" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} />
            <p className="text-xs text-gray">شمسی: {isoToJalaliLabel(blockDate)}</p>
            <div className="grid grid-cols-2 gap-3">
              <Input type="time" dir="ltr" value={blockFrom} onChange={(e) => setBlockFrom(e.target.value)} />
              <Input type="time" dir="ltr" value={blockTo} onChange={(e) => setBlockTo(e.target.value)} />
            </div>
            <Input placeholder="دلیل (اختیاری)" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setBlockOpen(false)}>انصراف</Button>
              <Button type="button" className="flex-1" loading={submitting} onClick={async () => {
                if (pm(blockTo) <= pm(blockFrom)) { setError('ساعت نامعتبر'); return; }
                setSubmitting(true); setError(null);
                try {
                  await addTimeOff({ ...tehranRange(blockDate, blockFrom, blockTo), reason: blockReason.trim() || undefined });
                  setBlockOpen(false); setSuccess('بازه مسدود شد'); await load();
                } catch (e) { setError(friendlyApiError(e)); }
                finally { setSubmitting(false); }
              }}>ذخیره</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
