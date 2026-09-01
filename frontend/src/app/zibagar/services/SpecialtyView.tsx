'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import {
  deactivateMyService,
  resolveMediaUrl,
  type CatalogCategory,
  type MediaAssetItem,
  type ProfessionalServiceItem,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice } from '@/lib/utils';
import {
  findCategory,
  isVideoMime,
  navy,
  serviceLabel,
  statusOf,
  type PathNode,
} from './services-helpers';

export type SpecialtyViewProps = {
  activeRootId: string;
  activeRoot: CatalogCategory | null;
  tree: CatalogCategory[];
  mine: ProfessionalServiceItem[];
  path: PathNode[];
  setPath: Dispatch<SetStateAction<PathNode[]>>;
  search: string;
  setSearch: (v: string) => void;
  searchResults: Array<{ type: 'cat' | 'svc'; id: string; name: string; path: string; rootId: string }>;
  categoryChildren: CatalogCategory[];
  leafServices: Array<{ id: string; name: string }>;
  menuSections: Array<[string, ProfessionalServiceItem[]]>;
  specialtyMedia: MediaAssetItem[];
  specialtyMenu: ProfessionalServiceItem[];
  busy: boolean;
  uploadState: 'idle' | 'uploading' | 'ok' | 'err';
  uploadErr: string | null;
  ensureAndEditService: (serviceId: string, nameHint?: string) => void | Promise<void>;
  setSelectedPsId: (id: string | null) => void;
  setMode: (m: 'home' | 'specialty' | 'edit' | 'add') => void;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  setMsg: (v: string | null) => void;
  load: () => void | Promise<void>;
  onDeleteMedia: (id: string) => void | Promise<void>;
  onUploadMedia: (file: File, attachToPsId?: string) => void | Promise<void>;
  removeRootSpecialty: (rootId: string) => void | Promise<void>;
  createAndEditCustomService: (name: string) => void | Promise<void>;
};

export function SpecialtyView(props: SpecialtyViewProps) {
  const {
    activeRootId,
    activeRoot,
    tree,
    mine,
    path,
    setPath,
    search,
    setSearch,
    searchResults,
    categoryChildren,
    leafServices,
    menuSections,
    specialtyMedia,
    specialtyMenu,
    busy,
    uploadState,
    uploadErr,
    ensureAndEditService,
    setSelectedPsId,
    setMode,
    setBusy,
    setError,
    setMsg,
    load,
    onDeleteMedia,
    onUploadMedia,
    removeRootSpecialty,
    createAndEditCustomService,
  } = props;

  return (
        <div className="space-y-5">
          {/* Primary search — restaurant menu discovery */}
          <div className="relative">
            <label className={`mb-1.5 block text-sm font-bold ${navy.title}`}>🔎 جستجوی خدمت</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="مثلاً امبره، بالیاژ، ژورنالی..."
              className="w-full rounded-2xl border-2 border-[#0B2C4A]/35 bg-white py-3.5 text-base font-medium shadow-md focus-visible:border-[#0B2C4A]"
            />
            {search.trim() && (
              <ul
                className={`absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border ${navy.border} bg-white p-1 shadow-lg`}
              >
                {searchResults.map((r) => (
                  <li key={`${r.type}-${r.id}`}>
                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-2.5 text-right text-sm hover:bg-[#F3F6F9]"
                      onClick={() => {
                        setSearch('');
                        if (r.type === 'svc') {
                          void ensureAndEditService(r.id, r.name);
                        } else {
                          setPath(() => {
                            const cat = findCategory(tree, r.id);
                            if (!cat) return [];
                            return [{ id: cat.id, name: cat.name }];
                          });
                        }
                      }}
                    >
                      <span className="font-medium">{r.name}</span>
                    </button>
                  </li>
                ))}
                {!searchResults.some((r) => r.type === 'svc' && r.name === search.trim()) && (
                  <li>
                    <button
                      type="button"
                      disabled={busy}
                      className={`w-full rounded-xl px-3 py-2.5 text-right text-sm font-semibold ${navy.title} hover:bg-[#F3F6F9]`}
                      onClick={() => void createAndEditCustomService(search.trim())}
                    >
                      ＋ افزودن «{search.trim()}»
                    </button>
                  </li>
                )}
                {searchResults.length === 0 && (
                  <li className="px-3 py-1 text-xs text-gray-400">در کاتالوگ نبود — می‌توانید بسازید</li>
                )}
              </ul>
            )}
          </div>

          {/* Optional subcategories — only when present and not searching */}
          {!search.trim() && categoryChildren.length > 0 && (
            <ul className="grid grid-cols-2 gap-2">
              {categoryChildren.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setPath((p) => [...p, { id: c.id, name: c.name }])}
                    className={`w-full rounded-2xl border ${navy.border} bg-white px-3 py-3 text-right text-sm font-medium hover:border-[#0B2C4A]/35`}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Direct leaf services at this level — compact select, not full tree */}
          {!search.trim() && leafServices.length > 0 && (
            <ul className="space-y-2">
              {leafServices.map((s) => {
                const offered = mine.find((m) => m.serviceId === s.id);
                const st = statusOf(offered);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => void ensureAndEditService(s.id, s.name)}
                      className={`flex w-full items-center justify-between rounded-2xl border ${navy.border} bg-white px-4 py-3 text-right text-sm`}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-gray-500">
                        {offered
                          ? st === 'ready'
                            ? '🟢'
                            : '🟡'
                          : 'تنظیم'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Restaurant-style menu — sections, no forced sub-options */}
          {menuSections.length > 0 && (
            <div className={`rounded-2xl border ${navy.border} bg-white`}>
              <div className={`border-b ${navy.border} px-4 py-3`}>
                <h2 className={`text-sm font-semibold ${navy.title}`}>منوی {activeRoot?.name}</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {menuSections.map(([section, items]) => (
                  <div key={section} className="px-4 py-3">
                    {menuSections.length > 1 && (
                      <p className="mb-2 text-[11px] font-semibold tracking-wide text-gray-400">
                        {section}
                      </p>
                    )}
                    <ul className="space-y-3">
                      {items.map((ps) => {
                        const st = statusOf(ps);
                        const rules = (ps.priceRules || []).filter((r) => r.isActive !== false);
                        return (
                          <li key={ps.id}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {serviceLabel(ps)}
                                  <span className="mr-1.5 text-[10px] text-gray-400">
                                    {st === 'ready' ? '🟢' : '🟡'}
                                  </span>
                                </p>
                                {rules.length > 0 ? (
                                  <ul className="mt-1 space-y-0.5 border-r border-gray-200 pr-2.5">
                                    {rules.map((r) => (
                                      <li
                                        key={r.id}
                                        className="flex justify-between gap-3 text-xs text-gray-600"
                                      >
                                        <span>{r.label}</span>
                                        <span className="tabular-nums">{formatPrice(r.price)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-0.5 text-xs tabular-nums text-gray-600">
                                    {(ps.price ?? 0) > 0 ? formatPrice(ps.price) : 'قیمت تعیین نشده'}
                                    {ps.durationMin ? ` · ${ps.durationMin} دقیقه` : ''}
                                  </p>
                                )}
                              </div>
                              <div className="flex shrink-0 gap-2 text-xs">
                                <button
                                  type="button"
                                  className={`font-medium ${navy.title}`}
                                  onClick={() => {
                                    setSelectedPsId(ps.id);
                                    setMode('edit');
                                  }}
                                >
                                  ویرایش
                                </button>
                                <button
                                  type="button"
                                  className="text-gray-400"
                                  onClick={() => {
                                    if (
                                      typeof window === 'undefined' ||
                                      !window.confirm(`حذف «${serviceLabel(ps)}»؟`)
                                    ) {
                                      return;
                                    }
                                    void (async () => {
                                      setBusy(true);
                                      try {
                                        await deactivateMyService(ps.id);
                                        await load();
                                        setMsg('حذف شد');
                                      } catch (e) {
                                        setError(friendlyApiError(e));
                                      } finally {
                                        setBusy(false);
                                      }
                                    })();
                                  }}
                                >
                                  حذف
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Specialty portfolio */}
          <div className={`rounded-2xl border ${navy.border} bg-white p-4`}>
            <h2 className={`mb-3 text-sm font-semibold ${navy.title}`}>
              نمونه‌کارهای {activeRoot?.name}
            </h2>
            {specialtyMedia.length > 0 && (
              <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {specialtyMedia.map((m) => (
                  <div key={m.id} className="relative">
                    {isVideoMime(m.mimeType) ? (
                      <video
                        src={resolveMediaUrl(m.publicUrl)}
                        className="aspect-square w-full rounded-xl object-cover"
                        controls
                        playsInline
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveMediaUrl(m.publicUrl)}
                        alt=""
                        className="aspect-square w-full rounded-xl object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteMedia(m.id)}
                      className="absolute left-1 top-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] text-white"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed ${navy.border} px-4 py-2.5 text-sm text-[#0B2C4A] hover:bg-[#F3F6F9]`}
            >
              <span>
                {uploadState === 'uploading'
                  ? 'در حال آپلود…'
                  : uploadState === 'ok'
                    ? '✓ آپلود شد'
                    : '+ افزودن نمونه‌کار'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
                className="hidden"
                disabled={busy}
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (files?.length) {
                    void (async () => {
                      for (const f of Array.from(files)) {
                        await onUploadMedia(f);
                      }
                    })();
                  }
                  e.target.value = '';
                }}
              />
            </label>
            {uploadState === 'err' && uploadErr && (
              <p className="mt-2 text-xs text-red-600">آپلود ناموفق بود: {uploadErr}</p>
            )}
            {specialtyMenu.length === 0 && (
              <p className="mt-2 text-xs text-gray-500">
                برای اتصال نمونه‌کار، ابتدا یک خدمت را جستجو و قیمت‌گذاری کنید.
              </p>
            )}
          </div>

          <button
            type="button"
            className="text-xs text-gray-400 underline"
            onClick={() => removeRootSpecialty(activeRootId)}
          >
            حذف از تخصص‌های من
          </button>
        </div>

  );
}
