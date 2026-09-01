'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ProfessionalServiceItem } from '@/types/public';
import { formatPrice } from '@/lib/utils';

function isVideo(mime?: string) {
  return (mime || '').startsWith('video/');
}

export function ServiceOfferCard({ ps, slug }: { ps: ProfessionalServiceItem; slug?: string }) {
  const addOns = ps.addOns || [];
  const media = ps.mediaAssets || [];
  const priceRules = (ps.priceRules || []).filter((r) => r.isActive !== false);
  const durationRules = (ps.durationRules || []).filter((r) => r.isActive !== false);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [priceRuleId, setPriceRuleId] = useState<string | null>(
    priceRules.length ? priceRules[0].id : null,
  );
  const [durationRuleId, setDurationRuleId] = useState<string | null>(() => {
    if (!durationRules.length) return null;
    if (priceRules.length) {
      const match = durationRules.find((d) => d.label === priceRules[0].label);
      return (match || durationRules[0]).id;
    }
    return durationRules[0].id;
  });

  const basePrice = useMemo(() => {
    if (priceRuleId) {
      const rule = priceRules.find((r) => r.id === priceRuleId);
      if (rule) return rule.price;
    }
    return ps.price || 0;
  }, [priceRuleId, priceRules, ps.price]);

  const baseDuration = useMemo(() => {
    if (durationRuleId) {
      const rule = durationRules.find((r) => r.id === durationRuleId);
      if (rule) return rule.durationMin;
    }
    return ps.durationMin || 0;
  }, [durationRuleId, durationRules, ps.durationMin]);

  const finalPrice = useMemo(() => {
    const extra = addOns
      .filter((a) => selectedAddOns.includes(a.id))
      .reduce((sum, a) => sum + (a.price || 0), 0);
    return basePrice + extra;
  }, [basePrice, addOns, selectedAddOns]);

  const finalDuration = useMemo(() => {
    const extra = addOns
      .filter((a) => selectedAddOns.includes(a.id))
      .reduce((sum, a) => sum + (a.extraDurationMin || 0), 0);
    return baseDuration + extra;
  }, [baseDuration, addOns, selectedAddOns]);

  function toggle(id: string) {
    setSelectedAddOns((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectPriceRule(id: string) {
    setPriceRuleId(id);
    const rule = priceRules.find((r) => r.id === id);
    if (rule) {
      const match = durationRules.find((d) => d.label === rule.label);
      if (match) setDurationRuleId(match.id);
    }
  }

  const bookHref = useMemo(() => {
    if (!slug) return null;
    const params = new URLSearchParams();
    params.set('serviceId', ps.service?.id || '');
    if (selectedAddOns.length) params.set('addOnIds', selectedAddOns.join(','));
    if (priceRuleId) params.set('priceRuleId', priceRuleId);
    if (durationRuleId) params.set('durationRuleId', durationRuleId);
    return `/booking/${slug}?${params.toString()}`;
  }, [slug, ps.service?.id, selectedAddOns, priceRuleId, durationRuleId]);

  return (
    <li className="rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{ps.service.name}</p>
          <p className="mt-0.5 text-xs text-gray">
            {finalDuration} دقیقه
            {ps.service.category?.name ? ` · ${ps.service.category.name}` : ''}
          </p>
        </div>
        <p className="font-semibold text-coral">{formatPrice(finalPrice)}</p>
      </div>

      {ps.description && (
        <p className="mt-2 text-sm leading-6 text-gray">{ps.description}</p>
      )}

      {priceRules.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-gray">انتخاب مدل</p>
          <ul className="space-y-1.5">
            {priceRules.map((r) => {
              const on = priceRuleId === r.id;
              const dur =
                durationRules.find((d) => d.label === r.label)?.durationMin ??
                baseDuration;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => selectPriceRule(r.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-right text-sm ${
                      on
                        ? 'border-coral bg-coral/5 text-foreground'
                        : 'border-border bg-white text-gray'
                    }`}
                  >
                    <span>
                      {on ? '✓ ' : ''}
                      {r.label}
                      <span className="mt-0.5 block text-xs text-gray">{dur} دقیقه</span>
                    </span>
                    <span className="font-medium">{formatPrice(r.price)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {media.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {media.map((m) =>
            isVideo(m.mimeType) ? (
              <video
                key={m.id}
                src={m.publicUrl}
                className="aspect-square w-full rounded-xl object-cover"
                controls
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={m.id}
                src={m.publicUrl}
                alt=""
                className="aspect-square w-full rounded-xl object-cover"
              />
            ),
          )}
        </div>
      )}

      {addOns.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-gray">گزینه‌های جانبی</p>
          <ul className="space-y-1.5">
            {addOns.map((a) => {
              const on = selectedAddOns.includes(a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => toggle(a.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-right text-sm ${
                      on
                        ? 'border-coral bg-coral/5 text-foreground'
                        : 'border-border bg-white text-gray'
                    }`}
                  >
                    <span>
                      {on ? '✓ ' : ''}
                      {a.name}
                      {a.extraDurationMin ? ` (+${a.extraDurationMin}د)` : ''}
                    </span>
                    <span className="font-medium">{formatPrice(a.price)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-light/60 px-3 py-2 text-sm">
            <span className="text-gray">قیمت نهایی · {finalDuration} دقیقه</span>
            <span className="font-bold text-coral">{formatPrice(finalPrice)}</span>
          </div>
        </div>
      )}

      {bookHref && (
        <Link
          href={bookHref}
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-coral text-sm font-medium text-white"
        >
          رزرو همین مدل
        </Link>
      )}
    </li>
  );
}
