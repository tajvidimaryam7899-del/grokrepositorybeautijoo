'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import {
  createCategoryNode,
  createServiceNode,
  deactivateMyService,
  resolveMediaUrl,
  type CatalogCategory,
  type MediaAssetItem,
  type ProfessionalServiceItem,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice } from '@/lib/utils';
import { findCategory, isVideoMime, navy, serviceLabel, statusOf, type PathNode } from './services-helpers';

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
    activeRootId, activeRoot, tree, mine, path, setPath, search, setSearch, searchResults,
    categoryChildren, leafServices, menuSections, specialtyMedia, specialtyMenu, busy,
    uploadState, uploadErr, ensureAndEditService, setSelectedPsId, setMode, setBusy, setError,
    setMsg, load, onDeleteMedia, onUploadMedia, removeRootSpecialty, createAndEditCustomService,
  } = props;

  const current = path.length ? findCategory(tree, path[path.length - 1].id) : activeRoot;
  const currentId = current?.id || activeRootId;

  async function addFeature() {
    const name = window.prompt('نام ویژگی را وارد کنید؛ مثلاً «امبره» یا «قد مو»:');
    if (!name?.trim() || !currentId) return;
    setBusy(true); setError(null);
    try {
      await createCategoryNode({ name: name.trim(), parentId: currentId });
      await load();
      setMsg(`«${name.trim()}» اضافه شد`);
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setBusy(false); }
  }

  async function addFinalOption() {
    const name = window.prompt('نام گزینه نهایی را وارد کنید؛ قیمت در همین مرحله تعیین می‌شود:');
    if (!name?.trim() || !currentId) return;
    setBusy(true); setError(null);
    try {
      const created = await createServiceNode({ name: name.trim(), categoryId: currentId });
      await load();
      await ensureAndEditService(created.id, created.name);
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setBusy(false); }
  }

  async function deleteService(ps: ProfessionalServiceItem) {
    if (!window.confirm(`حذف «${serviceLabel(ps)}»؟ این خدمت از خدمات فعال شما حذف می‌شود.`)) return;
    setBusy(true); setError(null);
    try { await deactivateMyService(ps.id); await load(); setMsg('حذف شد'); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border ${navy.border} bg-white p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-base font-bold ${navy.title}`}>{activeRoot?.name || 'تخصص'}</p>
            <p className="mt-1 text-xs text-gray-500">ویژگی‌ها را مرحله‌به‌مرحله بساز؛ قیمت فقط در گزینه نهایی ثبت می‌شود.</p>
          </div>
          <button type="button" disabled={busy} onClick={addFeature} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${navy.btn}`}>
            + افزودن ویژگی
          </button>
        </div>

        {path.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1 text-xs text-gray-500">
            <button type="button" className={`${navy.title} underline`} onClick={() => setPath([])}>{activeRoot?.name}</button>
            {path.map((p, i) => (
              <span key={p.id}>
                <span className="mx-1">›</span>
                <button type="button" className={i === path.length - 1 ? 'font-semibold text-gray-800' : `${navy.title} underline`} onClick={() => setPath(path.slice(0, i + 1))}>{p.name}</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <label className={`mb-1.5 block text-sm font-bold ${navy.title}`}>🔎 جستجوی خدمت یا ویژگی</label>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="مثلاً امبره، بالیاژ، قد مو..." className="w-full rounded-2xl border-2 border-[#0B2C4A]/35 bg-white py-3.5 text-base font-medium shadow-md" />
        {search.trim() && (
          <ul className={`absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border ${navy.border} bg-white p-1 shadow-lg`}>
            {searchResults.map((r) => (
              <li key={`${r.type}-${r.id}`}>
                <button type="button" className="w-full rounded-xl px-3 py-2.5 text-right text-sm hover:bg-[#F3F6F9]" onClick={() => {
                  setSearch('');
                  if (r.type === 'svc') void ensureAndEditService(r.id, r.name);
                  else { const cat = findCategory(tree, r.id); if (cat) setPath([{ id: cat.id, name: cat.name }]); }
                }}>
                  <span className="font-medium">{r.name}</span><span className="mr-2 text-[11px] text-gray-400">{r.path}</span>
                </button>
              </li>
            ))}
            {searchResults.length === 0 && <li className="px-3 py-2 text-xs text-gray-400">در کاتالوگ نبود.</li>}
            {searchResults.length === 0 && <li><button type="button" disabled={busy} className={`w-full rounded-xl px-3 py-2.5 text-right text-sm font-semibold ${navy.title}`} onClick={() => void createAndEditCustomService(search.trim())}>＋ افزودن «{search.trim()}» به‌عنوان خدمت نهایی</button></li>}
          </ul>
        )}
      </div>

      {categoryChildren.length > 0 && (
        <div className={`rounded-2xl border ${navy.border} bg-white p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <div><h2 className={`text-sm font-semibold ${navy.title}`}>ویژگی‌های این مرحله</h2><p className="mt-1 text-xs text-gray-400">برای ورود به مرحله بعد، یکی را انتخاب کنید.</p></div>
            <button type="button" disabled={busy} onClick={addFeature} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${navy.btnOutline}`}>+ افزودن ویژگی</button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categoryChildren.map((c) => (
              <button key={c.id} type="button" onClick={() => setPath((p) => [...p, { id: c.id, name: c.name }])} className={`rounded-2xl border ${navy.border} bg-white px-3 py-3 text-right text-sm font-medium hover:border-[#0B2C4A]/35`}>{c.name}<span className="float-left text-gray-400">‹</span></button>
            ))}
          </div>
        </div>
      )}

      <div className={`rounded-2xl border ${navy.border} bg-white p-4`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div><h2 className={`text-sm font-semibold ${navy.title}`}>گزینه‌های نهایی این مرحله</h2><p className="mt-1 text-xs text-gray-400">قیمت را فقط برای گزینه نهایی تعیین کن.</p></div>
          <button type="button" disabled={busy || !currentId} onClick={addFinalOption} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${navy.btnOutline}`}>+ افزودن گزینه نهایی</button>
        </div>
        {leafServices.length > 0 ? <ul className="space-y-2">{leafServices.map((s) => {
          const offered = mine.find((m) => m.serviceId === s.id);
          return <li key={s.id} className={`flex items-center justify-between rounded-xl border ${navy.border} px-3 py-3`}>
            <button type="button" className="min-w-0 flex-1 text-right" onClick={() => void ensureAndEditService(s.id, s.name)}><span className="font-medium">{s.name}</span><span className="mr-2 text-xs text-gray-400">{offered && (offered.price ?? 0) > 0 ? formatPrice(offered.price) : 'قیمت تعیین نشده'}</span></button>
            {offered && <button type="button" className="mr-3 text-xs text-gray-500" onClick={() => void deleteService(offered)}>حذف</button>}
          </li>;
        })}</ul> : <p className="rounded-xl bg-[#F3F6F9] p-3 text-xs text-gray-500">هنوز گزینه نهایی ندارید. ابتدا ویژگی‌ها را بسازید و در آخر یک گزینه نهایی اضافه کنید.</p>}
      </div>

      {menuSections.length > 0 && (
        <div className={`rounded-2xl border ${navy.border} bg-white`}>
          <div className={`border-b ${navy.border} px-4 py-3`}><h2 className={`text-sm font-semibold ${navy.title}`}>منوی {activeRoot?.name}</h2></div>
          <div className="divide-y divide-gray-100">{menuSections.map(([section, items]) => <div key={section} className="px-4 py-3">
            {menuSections.length > 1 && <p className="mb-2 text-[11px] font-semibold text-gray-400">{section}</p>}
            <ul className="space-y-3">{items.map((ps) => {
              const rules = (ps.priceRules || []).filter((r) => r.isActive !== false);
              return <li key={ps.id} className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-medium text-gray-900">{serviceLabel(ps)} <span className="text-[10px]">{statusOf(ps) === 'ready' ? '🟢' : '🟡'}</span></p>{rules.length ? <ul className="mt-1 space-y-0.5 border-r border-gray-200 pr-2.5">{rules.map((r) => <li key={r.id} className="flex justify-between gap-3 text-xs text-gray-600"><span>{r.label}</span><span>{formatPrice(r.price)}</span></li>)}</ul> : <p className="mt-0.5 text-xs text-gray-600">{ps.price > 0 ? formatPrice(ps.price) : 'قیمت تعیین نشده'}{ps.durationMin ? ` · ${ps.durationMin} دقیقه` : ''}</p>}</div><div className="flex shrink-0 gap-2 text-xs"><button type="button" className={`font-medium ${navy.title}`} onClick={() => { setSelectedPsId(ps.id); setMode('edit'); }}>ویرایش</button><button type="button" className="text-gray-400" onClick={() => void deleteService(ps)}>حذف</button></div></li>;
            })}</ul>
          </div>)}</div>
        </div>
      )}

      <div className={`rounded-2xl border ${navy.border} bg-white p-4`}>
        <h2 className={`mb-3 text-sm font-semibold ${navy.title}`}>نمونه‌کارهای {activeRoot?.name}</h2>
        {specialtyMedia.length > 0 && <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">{specialtyMedia.map((m) => <div key={m.id} className="relative">{isVideoMime(m.mimeType) ? <video src={resolveMediaUrl(m.publicUrl)} className="aspect-square w-full rounded-xl object-cover" controls playsInline /> : <img src={resolveMediaUrl(m.publicUrl)} alt="" className="aspect-square w-full rounded-xl object-cover" />}<button type="button" onClick={() => void onDeleteMedia(m.id)} className="absolute left-1 top-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] text-white">حذف</button></div>)}</div>}
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed ${navy.border} px-4 py-2.5 text-sm text-[#0B2C4A]`}><span>{uploadState === 'uploading' ? 'در حال آپلود…' : uploadState === 'ok' ? '✓ آپلود شد' : '+ افزودن نمونه‌کار'}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif" className="hidden" disabled={busy} multiple onChange={(e) => { const files = e.target.files; if (files?.length) void (async () => { for (const f of Array.from(files)) await onUploadMedia(f); })(); e.target.value = ''; }} /></label>
        {uploadState === 'err' && uploadErr && <p className="mt-2 text-xs text-red-600">آپلود ناموفق بود: {uploadErr}</p>}
      </div>

      <button type="button" disabled={busy} className="text-xs text-red-500 underline" onClick={() => { if (window.confirm(`⚠️ با حذف «${activeRoot?.name || 'این تخصص'}» از تخصص‌های من، تمام خدمات و قیمت‌گذاری‌های من در زیرمجموعه این تخصص نیز از دسترس من خارج می‌شوند. این عملیات قابل بازگشت نیست. ادامه می‌دهید؟`)) void removeRootSpecialty(activeRootId); }}>
        حذف این تخصص از تخصص‌های من
      </button>
    </div>
  );
}
