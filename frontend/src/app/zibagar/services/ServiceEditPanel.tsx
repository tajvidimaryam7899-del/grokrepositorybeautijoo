'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  deactivateMyAddOn,
  deleteMyDurationRule,
  deleteMyPriceRule,
  fetchMyDurationRules,
  fetchMyPriceRules,
  resolveMediaUrl,
  upsertMyAddOn,
  upsertMyDurationRule,
  upsertMyPriceRule,
  type DurationRuleItem,
  type MediaAssetItem,
  type PriceRuleItem,
  type ProfessionalServiceItem,
  type ServiceAddOnItem,
} from '@/lib/panel-api';
import { formatPrice, formatPriceDigits, parsePriceInput, priceToWords } from '@/lib/utils';
import { isVideoMime, navy, serviceLabel, statusOf } from './services-helpers';

export type ServiceEditPanelProps = {
  selectedPs: ProfessionalServiceItem;
  busy: boolean;
  price: number;
  setPrice: (n: number) => void;
  durationMin: number;
  setDurationMin: (n: number) => void;
  activeRootId: string | null;
  showModels: boolean;
  setShowModels: (v: boolean) => void;
  priceRules: PriceRuleItem[];
  setPriceRules: (v: PriceRuleItem[]) => void;
  durationRules: DurationRuleItem[];
  setDurationRules: (v: DurationRuleItem[]) => void;
  ruleLabel: string;
  setRuleLabel: (v: string) => void;
  rulePrice: number;
  setRulePrice: (n: number) => void;
  ruleDuration: number;
  setRuleDuration: (n: number) => void;
  showAddOnForm: boolean;
  setShowAddOnForm: (v: boolean) => void;
  addOnName: string;
  setAddOnName: (v: string) => void;
  addOnPrice: number;
  setAddOnPrice: (n: number) => void;
  addOnExtra: number;
  setAddOnExtra: (n: number) => void;
  uploadState: 'idle' | 'uploading' | 'ok' | 'err';
  uploadErr: string | null;
  onSavePs: () => void | Promise<void>;
  applyFixedToAllUnderRoot: () => void | Promise<void>;
  onAddModel: () => void | Promise<void>;
  onAddOn: () => void | Promise<void>;
  onToggleActive: (ps: ProfessionalServiceItem) => void | Promise<void>;
  onDeleteMedia: (id: string) => void | Promise<void>;
  onUploadMedia: (file: File, attachToPsId?: string) => void | Promise<void>;
  load: () => void | Promise<void>;
};

export function ServiceEditPanel(props: ServiceEditPanelProps) {
  const {
    selectedPs, busy, price, setPrice, durationMin, setDurationMin, activeRootId,
    showModels, setShowModels, priceRules, setPriceRules, durationRules, setDurationRules,
    ruleLabel, setRuleLabel, rulePrice, setRulePrice, ruleDuration, setRuleDuration,
    showAddOnForm, setShowAddOnForm, addOnName, setAddOnName, addOnPrice, setAddOnPrice,
    addOnExtra, setAddOnExtra, uploadState, uploadErr, onSavePs, applyFixedToAllUnderRoot,
    onAddModel, onAddOn, onToggleActive, onDeleteMedia, onUploadMedia, load,
  } = props;

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRuleDurationId, setEditingRuleDurationId] = useState<string | null>(null);
  const [editingRuleLabel, setEditingRuleLabel] = useState('');
  const [editingRulePrice, setEditingRulePrice] = useState(0);
  const [editingRuleDuration, setEditingRuleDuration] = useState(60);
  const [editingAddOnId, setEditingAddOnId] = useState<string | null>(null);
  const [editingAddOnName, setEditingAddOnName] = useState('');
  const [editingAddOnPrice, setEditingAddOnPrice] = useState(0);
  const [editingAddOnExtra, setEditingAddOnExtra] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);

  function startRuleEdit(label: string, pr?: PriceRuleItem, dr?: DurationRuleItem) {
    setEditingRuleId(pr?.id || null);
    setEditingRuleDurationId(dr?.id || null);
    setEditingRuleLabel(label);
    setEditingRulePrice(pr?.price || 0);
    setEditingRuleDuration(dr?.durationMin || 60);
  }

  async function saveRuleEdit() {
    if (!editingRuleLabel.trim() || (!editingRuleId && !editingRuleDurationId)) return;
    setSavingEdit(true);
    try {
      if (editingRuleId) await upsertMyPriceRule(selectedPs.id, { id: editingRuleId, label: editingRuleLabel.trim(), price: editingRulePrice });
      else await upsertMyPriceRule(selectedPs.id, { label: editingRuleLabel.trim(), price: editingRulePrice });
      if (editingRuleDurationId) await upsertMyDurationRule(selectedPs.id, { id: editingRuleDurationId, label: editingRuleLabel.trim(), durationMin: Math.max(5, editingRuleDuration) });
      else await upsertMyDurationRule(selectedPs.id, { label: editingRuleLabel.trim(), durationMin: Math.max(5, editingRuleDuration) });
      setPriceRules(await fetchMyPriceRules(selectedPs.id));
      setDurationRules(await fetchMyDurationRules(selectedPs.id));
      setEditingRuleId(null); setEditingRuleDurationId(null);
    } finally { setSavingEdit(false); }
  }

  function startAddOnEdit(a: ServiceAddOnItem) {
    setEditingAddOnId(a.id); setEditingAddOnName(a.name); setEditingAddOnPrice(a.price || 0); setEditingAddOnExtra(a.extraDurationMin || 0);
  }

  async function saveAddOnEdit() {
    if (!editingAddOnId || !editingAddOnName.trim()) return;
    setSavingEdit(true);
    try {
      await upsertMyAddOn(selectedPs.id, { id: editingAddOnId, name: editingAddOnName.trim(), price: editingAddOnPrice, extraDurationMin: editingAddOnExtra, isActive: true });
      setEditingAddOnId(null);
      await load();
    } finally { setSavingEdit(false); }
  }

  return (
    <div className={`space-y-5 rounded-2xl border ${navy.border} bg-white p-4`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{statusOf(selectedPs) === 'ready' ? '🟢 آماده رزرو' : '🟡 نیاز به تکمیل'}</p>
        <button type="button" disabled={busy} onClick={() => onToggleActive(selectedPs)} className="text-xs text-gray-500 underline">{selectedPs.isActive === false ? 'فعال‌سازی' : 'غیرفعال'}</button>
      </div>

      <div className="rounded-2xl bg-[#F3F6F9] p-3">
        <p className={`font-semibold ${navy.title}`}>{serviceLabel(selectedPs)}</p>
        <p className="mt-1 text-xs text-gray-500">قیمت اصلی را فقط برای گزینه نهایی وارد کن. برای حالت‌های مختلف از «تنوع قیمت‌گذاری» استفاده کن.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm"><span className="text-gray-500">قیمت نهایی (تومان)</span><Input inputMode="numeric" value={price ? formatPriceDigits(price) : ''} onChange={(e) => setPrice(parsePriceInput(e.target.value))} placeholder="مثلاً ۱۰۰۰۰۰۰" className="mt-1" />{price > 0 && <span className="mt-1 block text-xs text-gray-500">{priceToWords(price)}</span>}</label>
        <label className="block text-sm"><span className="text-gray-500">مدت خدمت (دقیقه)</span><Input inputMode="numeric" value={durationMin || ''} onChange={(e) => setDurationMin(parsePriceInput(e.target.value) || 0)} placeholder="۶۰" className="mt-1" /></label>
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={onSavePs} className={`rounded-xl px-5 py-2.5 text-sm font-medium ${navy.btn} disabled:opacity-50`}>تأیید تغییرات</button>{activeRootId && <button type="button" disabled={busy || !(price > 0)} onClick={applyFixedToAllUnderRoot} className={`rounded-xl px-4 py-2.5 text-sm font-medium ${navy.btnOutline} disabled:opacity-50`}>اعمال برای همه</button>}</div>

      <div className={`border-t ${navy.border} pt-4`}>
        <div className="flex items-center justify-between gap-2"><div><p className={`text-sm font-semibold ${navy.title}`}>تنوع‌های قیمت‌گذاری</p><p className="mt-1 text-xs text-gray-400">هر تنوع می‌تواند نام، قیمت و زمان مستقل داشته باشد.</p></div><button type="button" onClick={() => setShowModels(!showModels)} className={`text-xs ${navy.title} underline`}>{showModels ? 'بستن' : '+ افزودن تنوع'}</button></div>
        {showModels && <div className="mt-3 space-y-3">
          {(priceRules.length > 0 || durationRules.length > 0) && <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead className="text-xs text-gray-500"><tr><th className="py-1">نام</th><th className="py-1">قیمت</th><th className="py-1">زمان</th><th /></tr></thead><tbody>{Array.from(new Set([...priceRules.map((r) => r.label), ...durationRules.map((r) => r.label)])).map((label) => { const pr = priceRules.find((r) => r.label === label); const dr = durationRules.find((r) => r.label === label); return <tr key={label} className={`border-t ${navy.border}`}><td className="py-2">{label}</td><td className="py-2">{pr ? formatPrice(pr.price) : '—'}</td><td className="py-2">{dr ? `${dr.durationMin} دقیقه` : '—'}</td><td className="py-2"><div className="flex gap-2"><button type="button" disabled={busy || savingEdit} className={`text-xs ${navy.title}`} onClick={() => startRuleEdit(label, pr, dr)}>ویرایش</button><button type="button" disabled={busy || savingEdit} className="text-xs text-red-600" onClick={async () => { if (pr) await deleteMyPriceRule(selectedPs.id, pr.id); if (dr) await deleteMyDurationRule(selectedPs.id, dr.id); setPriceRules(await fetchMyPriceRules(selectedPs.id)); setDurationRules(await fetchMyDurationRules(selectedPs.id)); }}>حذف</button></div></td></tr>; })}</tbody></table></div>}
          {editingRuleId || editingRuleDurationId ? <div className="rounded-xl border border-[#0B2C4A]/20 bg-[#F3F6F9] p-3"><p className="mb-2 text-xs font-semibold text-[#0B2C4A]">ویرایش تنوع</p><div className="grid gap-2 sm:grid-cols-3"><Input placeholder="نام تنوع" value={editingRuleLabel} onChange={(e) => setEditingRuleLabel(e.target.value)} /><Input inputMode="numeric" placeholder="قیمت" value={editingRulePrice ? formatPriceDigits(editingRulePrice) : ''} onChange={(e) => setEditingRulePrice(parsePriceInput(e.target.value))} /><Input type="number" min={5} placeholder="زمان" value={editingRuleDuration || ''} onChange={(e) => setEditingRuleDuration(Number(e.target.value) || 0)} /></div><div className="mt-2 flex gap-2"><button type="button" disabled={savingEdit || busy} onClick={() => void saveRuleEdit()} className={`rounded-xl px-4 py-2 text-xs ${navy.btn}`}>ذخیره ویرایش</button><button type="button" disabled={savingEdit || busy} onClick={() => { setEditingRuleId(null); setEditingRuleDurationId(null); }} className="rounded-xl border px-4 py-2 text-xs">انصراف</button></div></div> : <div className="grid gap-2 sm:grid-cols-3"><Input placeholder="نام تنوع" value={ruleLabel} onChange={(e) => setRuleLabel(e.target.value)} /><Input inputMode="numeric" placeholder="قیمت نهایی" value={rulePrice ? formatPriceDigits(rulePrice) : ''} onChange={(e) => setRulePrice(parsePriceInput(e.target.value))} /><Input type="number" min={5} placeholder="زمان" value={ruleDuration || ''} onChange={(e) => setRuleDuration(Number(e.target.value) || 0)} /></div>}
          {!editingRuleId && !editingRuleDurationId && <button type="button" disabled={busy || !ruleLabel.trim()} onClick={onAddModel} className={`rounded-xl px-4 py-2 text-sm font-medium ${navy.btn} disabled:opacity-50`}>تأیید تنوع</button>}
        </div>}
      </div>

      <div className={`border-t ${navy.border} pt-4`}>
        <div className="flex items-center justify-between"><div><p className={`text-sm font-semibold ${navy.title}`}>ویژگی‌های تکمیلی</p><p className="mt-1 text-xs text-gray-400">این بخش برای مواردی است که به‌صورت اختیاری به خدمت اضافه می‌شوند.</p></div></div>
        {(selectedPs.addOns || []).filter((a) => a.isActive !== false).map((a) => editingAddOnId === a.id ? <div key={a.id} className="mb-2 rounded-xl border border-[#0B2C4A]/20 bg-[#F3F6F9] p-3"><div className="grid gap-2 sm:grid-cols-3"><Input placeholder="نام ویژگی" value={editingAddOnName} onChange={(e) => setEditingAddOnName(e.target.value)} /><Input inputMode="numeric" placeholder="قیمت" value={editingAddOnPrice ? formatPriceDigits(editingAddOnPrice) : ''} onChange={(e) => setEditingAddOnPrice(parsePriceInput(e.target.value))} /><Input type="number" min={0} placeholder="زمان اضافه" value={editingAddOnExtra || ''} onChange={(e) => setEditingAddOnExtra(Number(e.target.value) || 0)} /></div><div className="mt-2 flex gap-2"><button type="button" disabled={savingEdit || busy || !editingAddOnName.trim()} onClick={() => void saveAddOnEdit()} className={`rounded-xl px-4 py-2 text-xs ${navy.btn}`}>ذخیره ویرایش</button><button type="button" onClick={() => setEditingAddOnId(null)} className="rounded-xl border px-4 py-2 text-xs">انصراف</button></div></div> : <div key={a.id} className={`mb-2 flex items-center justify-between rounded-xl border ${navy.border} px-3 py-2 text-sm`}><span>{a.name}<span className="mr-2 text-xs text-gray-500">{formatPrice(a.price)}{a.extraDurationMin ? ` · +${a.extraDurationMin}د` : ''}</span></span><div className="flex gap-2"><button type="button" className={`text-xs ${navy.title}`} onClick={() => startAddOnEdit(a)}>ویرایش</button><button type="button" className="text-xs text-gray-500" onClick={() => deactivateMyAddOn(a.id).then(load)}>حذف</button></div></div>)}
        {!showAddOnForm ? <button type="button" onClick={() => setShowAddOnForm(true)} className={`mt-1 text-sm font-medium ${navy.title}`}>+ افزودن ویژگی تکمیلی</button> : <div className="mt-2 space-y-2"><div className="grid gap-2 sm:grid-cols-3"><Input placeholder="نام ویژگی" value={addOnName} onChange={(e) => setAddOnName(e.target.value)} /><Input inputMode="numeric" placeholder="قیمت" value={addOnPrice ? formatPriceDigits(addOnPrice) : ''} onChange={(e) => setAddOnPrice(parsePriceInput(e.target.value))} /><Input type="number" min={0} placeholder="زمان اضافه" value={addOnExtra || ''} onChange={(e) => setAddOnExtra(Number(e.target.value) || 0)} /></div><p className="text-xs text-gray-400">این ویژگی تکمیلی است؛ برای ساخت مسیرهایی مثل امبره ← با فویل ← قد مو، از «افزودن ویژگی» در صفحه تخصص استفاده کن.</p><button type="button" disabled={busy || !addOnName.trim()} onClick={onAddOn} className={`rounded-xl px-4 py-2 text-sm font-medium ${navy.btn}`}>تأیید</button></div>}
      </div>

      <div className={`border-t ${navy.border} pt-4`}><p className={`mb-2 text-sm font-medium ${navy.title}`}>نمونه‌کار این خدمت</p><div className="mb-2 grid grid-cols-3 gap-2">{(selectedPs.mediaAssets || []).map((m: MediaAssetItem) => <div key={m.id} className="relative">{isVideoMime(m.mimeType) ? <video src={resolveMediaUrl(m.publicUrl)} className="aspect-square w-full rounded-xl object-cover" controls playsInline /> : <img src={resolveMediaUrl(m.publicUrl)} alt="" className="aspect-square w-full rounded-xl object-cover" />}<button type="button" onClick={() => void onDeleteMedia(m.id)} className="absolute left-1 top-1 rounded-md bg-black/55 px-1.5 text-[10px] text-white">حذف</button></div>)}</div><label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed ${navy.border} px-4 py-2 text-sm text-[#0B2C4A]`}><span>{uploadState === 'uploading' ? 'در حال آپلود…' : uploadState === 'ok' ? '✓ آپلود شد' : '+ افزودن نمونه‌کار'}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUploadMedia(f, selectedPs.id); e.target.value = ''; }} /></label>{uploadState === 'err' && uploadErr && <p className="mt-1 text-xs text-red-600">آپلود ناموفق بود: {uploadErr}</p>}</div>
    </div>
  );
}
