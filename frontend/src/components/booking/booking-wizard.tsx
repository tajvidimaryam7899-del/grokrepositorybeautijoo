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
  professional: {
    id: string;
    slug: string;
    name: string;
    title?: string;
  };
  services: ServiceOption[];
  locations: LocationOption[];
  initialServiceId?: string;
  initialDate?: string;
  initialSlot?: string;
  initialLocationId?: string;
};

type Step = 'service' | 'datetime' | 'summary' | 'done';

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
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

  const totalDuration = selected
    ? selected.durationMin + selected.bufferMin
    : 30;

  const loadSlots = useCallback(async () => {
    if (!selected || !date) return;
    setSlotsLoading(true);
    setSlotsError(null);
    setSlots([]);
    try {
      const res = await fetchAvailability(
        professional.id,
        date,
        totalDuration,
      );
      setSlots(res.slots || []);
      if (slotStart && !res.slots.some((s) => s.start === slotStart)) {
        setSlotStart('');
      }
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 400) {
        setSlotsError('\u062a\u0627\u0631\u06cc\u062e \u06cc\u0627 \u0645\u062f\u062a \u0646\u0627\u0645\u0639\u062a\u0628\u0631 \u0627\u0633\u062a.');
      } else if (status === 404) {
        setSlotsError('\u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f.');
      } else {
        setSlotsError('\u062f\u0631\u06cc\u0627\u0641\u062a \u0632\u0645\u0627\u0646\u200c\u0647\u0627\u06cc \u0622\u0632\u0627\u062f \u0645\u0645\u06a9\u0646 \u0646\u0634\u062f.');
      }
    } finally {
      setSlotsLoading(false);
    }
  }, [selected, date, professional.id, totalDuration, slotStart]);

  useEffect(() => {
    if (step === 'datetime' && selected) {
      loadSlots();
    }
  }, [step, selected, date, loadSlots]);

  useEffect(() => {
    if (initialServiceId && initialDate && initialSlot) {
      setStep('summary');
    } else if (initialServiceId) {
      setStep('datetime');
    }
  }, [initialServiceId, initialDate, initialSlot]);

  function goDatetime() {
    if (!selected) return;
    setStep('datetime');
  }

  function goSummary() {
    if (!selected || !date || !slotStart) return;
    setStep('summary');
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
      const next = encodeURIComponent(bookingLoginReturnPath(draft));
      router.push(`/login?next=${next}`);
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
        if (pay.redirectUrl) {
          setPaymentInfo(
            '\u062f\u0631\u062e\u0648\u0627\u0633\u062a \u067e\u0631\u062f\u0627\u062e\u062a \u062b\u0628\u062a \u0634\u062f. \u062f\u0631 \u0635\u0648\u0631\u062a \u0627\u062a\u0635\u0627\u0644 \u062f\u0631\u06af\u0627\u0647 \u0648\u0627\u0642\u0639\u06cc\u060c \u0628\u0647 \u0635\u0641\u062d\u0647 \u067e\u0631\u062f\u0627\u062e\u062a \u0647\u062f\u0627\u06cc\u062a \u0645\u06cc\u200c\u0634\u0648\u06cc\u062f.',
          );
        } else {
          setPaymentInfo(
            '\u0631\u0632\u0631\u0648 \u062b\u0628\u062a \u0634\u062f. \u0648\u0636\u0639\u06cc\u062a \u067e\u0631\u062f\u0627\u062e\u062a \u067e\u0633 \u0627\u0632 \u0627\u062a\u0635\u0627\u0644 \u062f\u0631\u06af\u0627\u0647 \u0628\u0627\u0646\u06a9\u06cc \u0627\u0632 \u0637\u0631\u06cc\u0642 \u0628\u06a9\u200c\u0627\u0646\u062f \u0628\u0647\u200c\u0631\u0648\u0632 \u0645\u06cc\u200c\u0634\u0648\u062f.',
          );
        }
      } catch {
        setPaymentInfo(
          '\u0631\u0632\u0631\u0648 \u062b\u0628\u062a \u0634\u062f. \u0634\u0631\u0648\u0639 \u067e\u0631\u062f\u0627\u062e\u062a \u0641\u0639\u0644\u0627\u064b \u062f\u0631 \u062f\u0633\u062a\u0631\u0633 \u0646\u06cc\u0633\u062a \u06cc\u0627 \u0646\u06cc\u0627\u0632 \u0628\u0647 \u067e\u06cc\u06a9\u0631\u0628\u0646\u062f\u06cc \u062f\u0631\u06af\u0627\u0647 \u062f\u0627\u0631\u062f.',
        );
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
        router.push(
          `/login?next=${encodeURIComponent(bookingLoginReturnPath(draft))}`,
        );
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
        <p className="font-bold">\u062e\u062f\u0645\u062a\u06cc \u0628\u0631\u0627\u06cc \u0631\u0632\u0631\u0648 \u0641\u0639\u0627\u0644 \u0646\u06cc\u0633\u062a</p>
        <Link
          href={`/professionals/${professional.slug}`}
          className="mt-4 inline-block text-coral hover:underline"
        >
          \u0628\u0627\u0632\u06af\u0634\u062a \u0628\u0647 \u067e\u0631\u0648\u0641\u0627\u06cc\u0644
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <nav className="mb-4 text-sm text-gray">
        <Link href={`/professionals/${professional.slug}`} className="hover:text-coral">
          {professional.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">\u0631\u0632\u0631\u0648 \u0646\u0648\u0628\u062a</span>
      </nav>

      <h1 className="text-2xl font-bold">\u0631\u0632\u0631\u0648 \u0628\u0627 {professional.name}</h1>
      <p className="mt-1 text-sm text-gray">
        \u0632\u0645\u0627\u0646\u200c\u0647\u0627 \u0641\u0642\u0637 \u0627\u0632 \u0633\u0631\u0648\u0631 \u062f\u0631\u06cc\u0627\u0641\u062a \u0645\u06cc\u200c\u0634\u0648\u0646\u062f \u2014 \u0628\u062f\u0648\u0646 \u0627\u0633\u0644\u0627\u062a \u0633\u0627\u062e\u062a\u06af\u06cc
      </p>

      <ol className="mt-6 flex flex-wrap gap-2 text-xs font-medium">
        {(
          [
            ['service', '\u06f1. \u062e\u062f\u0645\u062a'],
            ['datetime', '\u06f2. \u062a\u0627\u0631\u06cc\u062e \u0648 \u0633\u0627\u0639\u062a'],
            ['summary', '\u06f3. \u062a\u0623\u06cc\u06cc\u062f'],
            ['done', '\u06f4. \u0646\u062a\u06cc\u062c\u0647'],
          ] as const
        ).map(([key, label]) => (
          <li
            key={key}
            className={`rounded-full px-3 py-1 ${
              step === key ? 'bg-coral text-white' : 'bg-gray-light text-gray'
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      {step === 'service' && (
        <Card className="mt-6 space-y-3">
          <h2 className="font-bold">\u0627\u0646\u062a\u062e\u0627\u0628 \u062e\u062f\u0645\u062a</h2>
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
                      {s.durationMin} \u062f\u0642\u06cc\u0642\u0647
                      {s.categoryName ? ` \u00b7 ${s.categoryName}` : ''}
                    </span>
                  </span>
                  <span className="font-bold text-coral">{formatPrice(s.price)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Button className="w-full" disabled={!serviceId} onClick={goDatetime}>
            \u0627\u062f\u0627\u0645\u0647
          </Button>
        </Card>
      )}

      {step === 'datetime' && selected && (
        <Card className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">\u062a\u0627\u0631\u06cc\u062e \u0648 \u0633\u0627\u0639\u062a</h2>
            <button type="button" className="text-sm text-coral hover:underline" onClick={() => setStep('service')}>
              \u062a\u063a\u06cc\u06cc\u0631 \u062e\u062f\u0645\u062a
            </button>
          </div>
          <p className="text-sm text-gray">
            {selected.name} \u2014 {totalDuration} \u062f\u0642\u06cc\u0642\u0647 \u2014 {formatPrice(selected.price)}
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium">\u062a\u0627\u0631\u06cc\u062e</label>
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
              <label className="mb-1 block text-sm font-medium">\u0645\u06a9\u0627\u0646</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} \u2014 {l.city}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">\u0632\u0645\u0627\u0646\u200c\u0647\u0627\u06cc \u0622\u0632\u0627\u062f</label>
              <button type="button" className="text-xs text-coral hover:underline" onClick={loadSlots} disabled={slotsLoading}>
                \u0628\u0647\u200c\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06cc
              </button>
            </div>
            {slotsLoading && <p className="text-sm text-gray">\u062f\u0631 \u062d\u0627\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u0627\u0632 \u0633\u0631\u0648\u0631...</p>}
            {slotsError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{slotsError}</p>
            )}
            {!slotsLoading && !slotsError && slots.length === 0 && (
              <p className="rounded-xl bg-gray-light px-3 py-4 text-center text-sm text-gray">
                \u062f\u0631 \u0627\u06cc\u0646 \u062a\u0627\u0631\u06cc\u062e \u0632\u0645\u0627\u0646 \u0622\u0632\u0627\u062f\u06cc \u0646\u06cc\u0633\u062a.
              </p>
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
            \u0627\u062f\u0627\u0645\u0647 \u0628\u0647 \u062e\u0644\u0627\u0635\u0647
          </Button>
        </Card>
      )}

      {step === 'summary' && selected && (
        <Card className="mt-6 space-y-4">
          <h2 className="font-bold">\u062e\u0644\u0627\u0635\u0647 \u0631\u0632\u0631\u0648</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-gray">\u0632\u06cc\u0628\u0627\u06af\u0631</dt>
              <dd className="font-medium">{professional.name}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray">\u062e\u062f\u0645\u062a</dt>
              <dd className="font-medium">{selected.name}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray">\u062a\u0627\u0631\u06cc\u062e</dt>
              <dd dir="ltr">{date}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray">\u0633\u0627\u0639\u062a</dt>
              <dd dir="ltr">{slotStart}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray">\u0645\u0628\u0644\u063a</dt>
              <dd className="font-bold text-coral">{formatPrice(selected.price)}</dd>
            </div>
          </dl>
          <div>
            <label className="mb-1 block text-sm font-medium">\u06cc\u0627\u062f\u062f\u0627\u0634\u062a (\u0627\u062e\u062a\u06cc\u0627\u0631\u06cc)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-2xl border border-border px-3 py-2 text-sm outline-none focus:border-coral"
            />
          </div>
          {!authLoading && !isAuthenticated && (
            <p className="rounded-xl bg-blue-light px-3 py-2 text-sm text-blue">
              \u0628\u0631\u0627\u06cc \u062b\u0628\u062a \u0631\u0632\u0631\u0648 \u0628\u0627\u06cc\u062f \u0648\u0627\u0631\u062f \u0634\u0648\u06cc\u062f. \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0647\u0627\u06cc \u0634\u0645\u0627 \u0630\u062e\u06cc\u0631\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f.
            </p>
          )}
          {submitError && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={() => setStep('datetime')} disabled={submitting}>
              \u0628\u0627\u0632\u06af\u0634\u062a
            </Button>
            <Button className="flex-1" loading={submitting} onClick={submitBooking}>
              {isAuthenticated ? '\u062b\u0628\u062a \u0631\u0632\u0631\u0648' : '\u0648\u0631\u0648\u062f \u0648 \u062b\u0628\u062a \u0631\u0632\u0631\u0648'}
            </Button>
          </div>
        </Card>
      )}

      {step === 'done' && booking && (
        <Card className="mt-6 space-y-4 text-center">
          <h2 className="text-xl font-bold text-coral">\u0631\u0632\u0631\u0648 \u062b\u0628\u062a \u0634\u062f</h2>
          <p className="text-sm text-gray">
            \u0648\u0636\u0639\u06cc\u062a \u0627\u0632 \u0633\u0631\u0648\u0631: <strong>{persianBookingStatus(booking.status)}</strong>
          </p>
          <p className="text-xs text-gray" dir="ltr">\u0634\u0646\u0627\u0633\u0647: {booking.id}</p>
          {paymentInfo && (
            <p className="rounded-xl bg-gray-light px-3 py-3 text-sm text-gray">{paymentInfo}</p>
          )}
          <p className="text-xs text-gray">
            \u067e\u0631\u062f\u0627\u062e\u062a \u0645\u0648\u0641\u0642 \u0641\u0642\u0637 \u067e\u0633 \u0627\u0632 \u062a\u0623\u06cc\u06cc\u062f \u0628\u06a9\u200c\u0627\u0646\u062f/\u062f\u0631\u06af\u0627\u0647 \u0627\u0639\u0644\u0627\u0645 \u0645\u06cc\u200c\u0634\u0648\u062f \u2014 \u0646\u0647 \u0627\u0632 \u0633\u0645\u062a \u0641\u0631\u0627\u0646\u062a\u200c\u0627\u0646\u062f.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href={`/booking/confirmation/${booking.id}`}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-coral px-6 text-sm font-medium text-white"
            >
              \u062c\u0632\u0626\u06cc\u0627\u062a \u0631\u0632\u0631\u0648
            </Link>
            <Link
              href={`/professionals/${professional.slug}`}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-6 text-sm font-medium"
            >
              \u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
