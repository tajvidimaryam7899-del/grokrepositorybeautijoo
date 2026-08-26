'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  createBooking,
  fetchAvailability,
  initiatePayment,
  slotToStartAt,
  persianBookingStatus,
} from '@/lib/booking-api';
import {
  saveBookingDraft,
  clearBookingDraft,
  bookingLoginReturnPath,
} from '@/lib/booking-draft';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AvailabilitySlot, BookingRecord } from '@/types/booking';
import { ApiError } from '@/lib/api';

type ServiceOption = {
  professionalServiceId: string;
  serviceId: string;
  name: string;
  durationMin: number;
  bufferMin: number;
  price: number;
  categoryName?: string;
};

type LocationOption = {
  id: string;
  name: string;
  city: string;
  address: string;
  isPrimary?: boolean;
};

type Props = {
  professional: { id: string; slug: string; name: string; title?: string };
  services: ServiceOption[];
  locations: LocationOption[];
  initialServiceId?: string;
  initialDate?: string;
  initialSlot?: string;
  initialLocationId?: string;
};

type Step = 'service' | 'datetime' | 'summary' | 'done';

const STEP_LABELS: Record<Step, string> = {
  service: 'خدمت',
  datetime: 'زمان',
  summary: 'خلاصه',
  done: 'پایان',
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BookingWizard({
  professional,
  services,
  locations,
  initialServiceId,
  initialDate,
  initialSlot,
  initialLocationId,
}: Props) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('service');
  const [serviceId, setServiceId] = useState(initialServiceId || '');
  const [date, setDate] = useState(initialDate || todayISO());
  const [slotStart, setSlotStart] = useState(initialSlot || '');
  const [locationId, setLocationId] = useState(
    initialLocationId ||
      locations.find((l) => l.isPrimary)?.id ||
      locations[0]?.id ||
      '',
  );
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<string | null>(null);

  const selected = useMemo(
    () => services.find((s) => s.serviceId === serviceId) || null,
    [services, serviceId],
  );
  const totalDuration = selected ? selected.durationMin + selected.bufferMin : 30;

  const loadSlots = useCallback(async () => {
    if (!selected || !date) return;
    setSlotsLoading(true);
    setSlotsError(null);
    setSlots([]);
    try {
      const res = await fetchAvailability(professional.id, date, totalDuration);
      setSlots(res.slots || []);
      if (slotStart && !res.slots.some((s) => s.start === slotStart)) setSlotStart('');
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 400) setSlotsError('تاریخ یا مدت نامعتبر است');
      else if (status === 404) setSlotsError('زیباگر یافت نشد');
      else setSlotsError('بارگذاری زمان‌های آزاد ممکن نشد');
    } finally {
      setSlotsLoading(false);
    }
  }, [selected, date, professional.id, totalDuration, slotStart]);

  useEffect(() => {
    if (step === 'datetime' && selected) loadSlots();
  }, [step, selected, date, loadSlots]);

  useEffect(() => {
    if (initialServiceId && initialDate && initialSlot) setStep('summary');
    else if (initialServiceId) setStep('datetime');
  }, [initialServiceId, initialDate, initialSlot]);

  function goDatetime() {
    if (selected) setStep('datetime');
  }
  function goSummary() {
    if (selected && date && slotStart) setStep('summary');
  }

  async function submitBooking() {
    if (!selected || !date || !slotStart) return;
    setSubmitError(null);
    if (!isAuthenticated) {
      const draft = {
        professionalId: professional.id,
        professionalSlug: professional.slug,
        professionalName: professional.name,
        serviceId: selected.serviceId,
        serviceName: selected.name,
        durationMin: totalDuration,
        price: selected.price,
        locationId: locationId || undefined,
        date,
        slotStart,
        notes: notes || undefined,
      };
      saveBookingDraft(draft);
      router.push(`/login?next=${encodeURIComponent(bookingLoginReturnPath(draft))}`);
      return;
    }
    setSubmitting(true);
    try {
      const startAt = slotToStartAt(date, slotStart);
      const created = await createBooking({
        professionalId: professional.id,
        serviceIds: [selected.serviceId],
        startAt,
        locationId: locationId || undefined,
        notes: notes.trim() || undefined,
      });
      clearBookingDraft();
      setBooking(created);
      setStep('done');
      try {
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          (typeof window !== 'undefined' ? window.location.origin : '');
        const callbackUrl = `${appUrl}/booking/confirmation/${created.id}`;
        const pay = await initiatePayment(created.id, callbackUrl);
        setPaymentInfo(
          pay.redirectUrl
            ? 'درخواست پرداخت ثبت شد. درگاه واقعی پس از اتصال فعال می‌شود.'
            : 'رزرو ذخیره شد. وضعیت پرداخت پس از پیکربندی درگاه از سرور به‌روز می‌شود.',
        );
      } catch {
        setPaymentInfo('رزرو ذخیره شد. شروع پرداخت در دسترس نیست یا نیاز به پیکربندی درگاه دارد.');
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const draft = {
          professionalId: professional.id,
          professionalSlug: professional.slug,
          professionalName: professional.name,
          serviceId: selected.serviceId,
          serviceName: selected.name,
          durationMin: totalDuration,
          price: selected.price,
          locationId: locationId || undefined,
          date,
          slotStart,
          notes: notes || undefined,
        };
        saveBookingDraft(draft);
        router.push(`/login?next=${encodeURIComponent(bookingLoginReturnPath(draft))}`);
        return;
      }
      setSubmitError(friendlyApiError(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (services.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-bold">خدماتی برای رزرو فعال نیست</p>
        <Link href={`/professionals/${professional.slug}`} className="mt-4 inline-block text-coral hover:underline">
          بازگشت به پروفایل
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10" dir="rtl">
      <nav className="mb-4 text-sm text-gray">
        <Link href={`/professionals/${professional.slug}`} className="hover:text-coral">
          {professional.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">رزرو</span>
      </nav>
      <h1 className="text-2xl font-bold">رزرو با {professional.name}</h1>
      <p className="mt-1 text-sm text-gray">زمان‌ها فقط از سرور — بدون داده ساختگی</p>

      <ol className="mt-6 flex flex-wrap gap-2 text-xs font-medium">
        {(['service', 'datetime', 'summary', 'done'] as const).map((key, i) => (
          <li
            key={key}
            className={`rounded-full px-3 py-1 ${
              step === key ? 'bg-coral text-white' : 'bg-gray-light text-gray'
            }`}
          >
            {i + 1}. {STEP_LABELS[key]}
          </li>
        ))}
      </ol>

      {step === 'service' && (
        <Card className="mt-6 space-y-3">
          <h2 className="font-bold">انتخاب خدمت</h2>
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.serviceId}>
                <button
                  type="button"
                  onClick={() => setServiceId(s.serviceId)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-right text-sm transition ${
                    serviceId === s.serviceId
                      ? 'border-coral bg-coral-soft'
                      : 'border-border hover:border-coral-light'
                  }`}
                >
                  <span>
                    <span className="font-medium">{s.name}</span>
                    <span className="mt-0.5 block text-xs text-gray">
                      {s.durationMin} دقیقه{s.categoryName ? ` · ${s.categoryName}` : ''}
                    </span>
                  </span>
                  <span className="font-bold text-coral">{formatPrice(s.price)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Button className="w-full" disabled={!serviceId} onClick={goDatetime}>
            ادامه
          </Button>
        </Card>
      )}

      {step === 'datetime' && selected && (
        <Card className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">تاریخ و ساعت</h2>
            <button type="button" className="text-sm text-coral hover:underline" onClick={() => setStep('service')}>
              تغییر خدمت
            </button>
          </div>
          <p className="text-sm text-gray">
            {selected.name} — {totalDuration} دقیقه — {formatPrice(selected.price)}
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium">تاریخ</label>
            <input
              type="date"
              value={date}
              min={todayISO()}
              onChange={(e) => {
                setDate(e.target.value);
                setSlotStart('');
              }}
              className="h-11 w-full rounded-2xl border border-border px-3 text-sm outline-none focus:border-coral"
              dir="ltr"
            />
          </div>
          {locations.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium">مکان</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} — {l.city}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">ساعات آزاد</label>
              <button type="button" className="text-xs text-coral hover:underline" onClick={loadSlots} disabled={slotsLoading}>
                بروزرسانی
              </button>
            </div>
            {slotsLoading && <p className="text-sm text-gray">در حال بارگذاری از سرور...</p>}
            {slotsError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{slotsError}</p>}
            {!slotsLoading && !slotsError && slots.length === 0 && (
              <p className="rounded-xl bg-gray-light px-3 py-4 text-center text-sm text-gray">ساعت آزادی در این تاریخ نیست.</p>
            )}
            {!slotsLoading && slots.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    dir="ltr"
                    onClick={() => setSlotStart(s.start)}
                    className={`rounded-xl border py-2 text-sm ${
                      slotStart === s.start
                        ? 'border-coral bg-coral text-white'
                        : 'border-border hover:border-coral-light'
                    }`}
                  >
                    {s.start}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button className="w-full" disabled={!slotStart} onClick={goSummary}>
            ادامه به خلاصه
          </Button>
        </Card>
      )}

      {step === 'summary' && selected && (
        <Card className="mt-6 space-y-4">
          <h2 className="font-bold">خلاصه</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-gray">زیباگر</dt><dd className="font-medium">{professional.name}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-gray">خدمت</dt><dd className="font-medium">{selected.name}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-gray">تاریخ</dt><dd dir="ltr">{date}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-gray">ساعت</dt><dd dir="ltr">{slotStart}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-gray">قیمت</dt><dd className="font-bold text-coral">{formatPrice(selected.price)}</dd></div>
          </dl>
          <div>
            <label className="mb-1 block text-sm font-medium">یادداشت (اختیاری)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-2xl border border-border px-3 py-2 text-sm outline-none focus:border-coral" />
          </div>
          {!authLoading && !isAuthenticated && (
            <p className="rounded-xl bg-blue-light px-3 py-2 text-sm text-blue">ورود لازم است. انتخاب شما حفظ می‌شود.</p>
          )}
          {submitError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={() => setStep('datetime')} disabled={submitting}>بازگشت</Button>
            <Button className="flex-1" loading={submitting} onClick={submitBooking}>
              {isAuthenticated ? 'ثبت رزرو' : 'ورود و رزرو'}
            </Button>
          </div>
        </Card>
      )}

      {step === 'done' && booking && (
        <Card className="mt-6 space-y-4 text-center">
          <h2 className="text-xl font-bold text-coral">رزرو ثبت شد</h2>
          <p className="text-sm text-gray">وضعیت سرور: <strong>{persianBookingStatus(booking.status)}</strong></p>
          <p className="text-xs text-gray" dir="ltr">ID: {booking.id}</p>
          {paymentInfo && <p className="rounded-xl bg-gray-light px-3 py-3 text-sm text-gray">{paymentInfo}</p>}
          <p className="text-xs text-gray">موفقیت پرداخت فقط پس از تأیید سرور/درگاه — هرگز توسط کلاینت ادعا نمی‌شود.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href={`/booking/confirmation/${booking.id}`} className="inline-flex h-11 items-center justify-center rounded-2xl bg-coral px-6 text-sm font-medium text-white">جزئیات رزرو</Link>
            <Link href={`/professionals/${professional.slug}`} className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-6 text-sm font-medium">پروفایل</Link>
          </div>
        </Card>
      )}
    </div>
  );
}
