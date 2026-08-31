'use client';

import { useMemo, useState } from 'react';
import type { ProfessionalServiceItem } from '@/types/public';
import { formatPrice } from '@/lib/utils';

function isVideo(mime?: string) {
  return (mime || '').startsWith('video/');
}

export function ServiceOfferCard({ ps }: { ps: ProfessionalServiceItem }) {
  const addOns = ps.addOns || [];
  const media = ps.mediaAssets || [];
  const [selected, setSelected] = useState<string[]>([]);

  const finalPrice = useMemo(() => {
    const base = ps.price || 0;
    const extra = addOns
      .filter((a) => selected.includes(a.id))
      .reduce((sum, a) => sum + (a.price || 0), 0);
    return base + extra;
  }, [ps.price, addOns, selected]);

  const finalDuration = useMemo(() => {
    const base = ps.durationMin || 0;
    const extra = addOns
      .filter((a) => selected.includes(a.id))
      .reduce((sum, a) => sum + (a.extraDurationMin || 0), 0);
    return base + extra;
  }, [ps.durationMin, addOns, selected]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <li className="rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{ps.service.name}</p>
          <p className="mt-0.5 text-xs text-gray">
            {ps.durationMin} دقیقه
            {ps.service.category?.name ? ` · ${ps.service.category.name}` : ''}
          </p>
        </div>
        <p className="font-semibold text-coral">{formatPrice(ps.price)}</p>
      </div>

      {ps.description && (
        <p className="mt-2 text-sm leading-6 text-gray">{ps.description}</p>
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
          <p className="text-xs font-medium text-gray">افزودنی‌ها</p>
          <ul className="space-y-1.5">
            {addOns.map((a) => {
              const on = selected.includes(a.id);
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
    </li>
  );
}
