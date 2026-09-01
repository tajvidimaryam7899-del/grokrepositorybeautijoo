'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchMyServices,
  fetchCategories,
  fetchMyProfessional,
  setMySelectedCategories,
  upsertMyService,
  patchMyService,
  deactivateMyService,
  upsertMyAddOn,
  deactivateMyAddOn,
  uploadMyMedia,
  deleteMyMedia,
  resolveMediaUrl,
  upsertMyPriceRule,
  deleteMyPriceRule,
  fetchMyPriceRules,
  upsertMyDurationRule,
  deleteMyDurationRule,
  fetchMyDurationRules,
  type ProfessionalServiceItem,
  type CatalogCategory,
  type ServiceAddOnItem,
  type PriceRuleItem,
  type DurationRuleItem,
  type MediaAssetItem,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice } from '@/lib/utils';

type PathNode = { id: string; name: string };
type LeafService = { id: string; name: string };

function isVideoMime(mime?: string) {
  return (mime || '').startsWith('video/');
}

function collectLeaves(cat: CatalogCategory | null | undefined): LeafService[] {
  if (!cat) return [];
  const out: LeafService[] = [];
  for (const s of cat.services || []) out.push({ id: s.id, name: s.name });
  for (const ch of cat.children || []) out.push(...collectLeaves(ch));
  return out;
}

function findCategory(cats: CatalogCategory[], id: string): CatalogCategory | null {
  for (const c of cats) {
    if (c.id === id) return c;
    if (c.children?.length) {
      const f = findCategory(c.children, id);
      if (f) return f;
    }
  }
  return null;
}

function rootOf(cats: CatalogCategory[], id: string): CatalogCategory | null {
  for (const r of cats) {
    if (r.id === id) return r;
    if (findCategory([r], id)) return r;
  }
  return null;
}

function flattenSearch(cats: CatalogCategory[]) {
  const out: Array<{ type: 'cat' | 'svc'; id: string; name: string; path: string; rootId: string }> = [];
  function walk(c: CatalogCategory, path: string[], rootId: string) {
    const p = [...path, c.name];
    out.push({ type: 'cat', id: c.id, name: c.name, path: p.join(' \u2190 '), rootId });
    for (const s of c.services || []) {
      out.push({ type: 'svc', id: s.id, name: s.name, path: [...p, s.name].join(' \u2190 '), rootId });
    }
    for (const ch of c.children || []) walk(ch, p, rootId);
  }
  for (const r of cats) walk(r, [], r.id);
  return out;
}

function statusOf(ps: ProfessionalServiceItem | undefined): 'ready' | 'incomplete' | 'none' {
  if (!ps) return 'none';
  if (ps.isActive === false) return 'incomplete';
  if ((ps.price ?? 0) > 0 && (ps.durationMin ?? 0) > 0) return 'ready';
  return 'incomplete';
}

export default function ZibagarServicesPage() {
  const [tree, setTree] = useState<CatalogCategory[]>([]);
  const [mine, setMine] = useState<ProfessionalServiceItem[]>([]);
  const [selectedRootIds, setSelectedRootIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'home' | 'browse' | 'add'>('home');
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [path, setPath] = useState<PathNode[]>([]);
  const [search, setSearch] = useState('');
  const [pickedServiceIds, setPickedServiceIds] = useState<string[]>([]);
  const [selectedPsId, setSelectedPsId] = useState<string | null>(null);
  const [price, setPrice] = useState(0);
  const [durationMin, setDurationMin] = useState(60);
  const [description, setDescription] = useState('');
  const [priceMode, setPriceMode] = useState<'fixed' | 'varied'>('fixed');
  const [priceRules, setPriceRules] = useState<PriceRuleItem[]>([]);
  const [durationRules, setDurationRules] = useState<DurationRuleItem[]>([]);
  const [ruleLabel, setRuleLabel] = useState('');
  const [rulePrice, setRulePrice] = useState(0);
  const [ruleDuration, setRuleDuration] = useState(60);
  const [addOnName, setAddOnName] = useState('');
  const [addOnPrice, setAddOnPrice] = useState(0);
  const [addOnExtra, setAddOnExtra] = useState(0);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'ok' | 'err'>('idle');
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const roots = useMemo(() => (tree || []).filter((c) => !c.parentId), [tree]);
  const myRoots = useMemo(() => roots.filter((r) => selectedRootIds.includes(r.id)), [roots, selectedRootIds]);
  const searchIndex = useMemo(() => flattenSearch(tree), [tree]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, services, pro] = await Promise.all([
        fetchCategories(),
        fetchMyServices(),
        fetchMyProfessional().catch(() => null),
      ]);
      setTree(cats || []);
      setMine(services || []);
      let ids: string[] = [];
      if (pro?.selectedCategoryIds && Array.isArray(pro.selectedCategoryIds)) {
        ids = pro.selectedCategoryIds.filter((x): x is string => typeof x === 'string');
      }
      if (!ids.length) {
        try {
          const raw = localStorage.getItem('beautijoo_wizard_root_categories');
          if (raw) {
            const parsed = JSON.parse(raw) as string[];
            if (Array.isArray(parsed)) ids = parsed;
          }
        } catch { /* ignore */ }
      }
      if (services?.length && cats?.length) {
        const derived = new Set(ids);
        for (const ps of services) {
          const cid = ps.service?.category?.id;
          if (!cid) continue;
          const root = rootOf(cats, cid);
          if (root) derived.add(root.id);
        }
        ids = Array.from(derived);
      }
      setSelectedRootIds(ids);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedPs = useMemo(
    () => (selectedPsId ? mine.find((m) => m.id === selectedPsId) || null : null),
    [selectedPsId, mine],
  );

  useEffect(() => {
    if (!selectedPs) return;
    setPrice(selectedPs.price || 0);
    setDurationMin(selectedPs.durationMin || 60);
    setDescription(selectedPs.description || '');
    setPriceMode(
      (selectedPs.priceRules?.length || 0) > 0 || (selectedPs.durationRules?.length || 0) > 0
        ? 'varied'
        : 'fixed',
    );
    setPriceRules(selectedPs.priceRules || []);
    setDurationRules(selectedPs.durationRules || []);
    (async () => {
      try {
        const [pr, dr] = await Promise.all([
          fetchMyPriceRules(selectedPs.id).catch(() => []),
          fetchMyDurationRules(selectedPs.id).catch(() => []),
        ]);
        if (pr.length) setPriceRules(pr);
        if (dr.length) setDurationRules(dr);
        if (pr.length || dr.length) setPriceMode('varied');
      } catch { /* ignore */ }
    })();
  }, [selectedPsId]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentCategory = useMemo(() => {
    if (!path.length) return activeRootId ? findCategory(tree, activeRootId) : null;
    return findCategory(tree, path[path.length - 1].id);
  }, [path, tree, activeRootId]);

  const children = useMemo(() => {
    if (!activeRootId) return [];
    if (path.length === 0) return findCategory(tree, activeRootId)?.children || [];
    return currentCategory?.children || [];
  }, [path, currentCategory, activeRootId, tree]);

  const leafServices = useMemo(() => {
    if (path.length === 0 && activeRootId) return findCategory(tree, activeRootId)?.services || [];
    return currentCategory?.services || [];
  }, [path, currentCategory, activeRootId, tree]);

  const searchResults = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    return searchIndex.filter((x) => x.name.includes(q)).slice(0, 40);
  }, [search, searchIndex]);

  async function persistRoots(ids: string[]) {
    setSelectedRootIds(ids);
    try { localStorage.setItem('beautijoo_wizard_root_categories', JSON.stringify(ids)); } catch { /* */ }
    try { await setMySelectedCategories(ids); } catch (e) { setError(friendlyApiError(e)); }
  }

  function openRoot(id: string) {
    setActiveRootId(id); setPath([]); setMode('browse'); setSelectedPsId(null); setPickedServiceIds([]); setMsg(null);
  }
  function openAddSpecialty() { setMode('add'); setActiveRootId(null); setPath([]); setSelectedPsId(null); setSearch(''); }
  function goHome() { setMode('home'); setActiveRootId(null); setPath([]); setSelectedPsId(null); setSearch(''); }
  function enterCategory(c: CatalogCategory) { setPath((p) => [...p, { id: c.id, name: c.name }]); setSelectedPsId(null); }
  function goBreadcrumb(index: number) {
    if (index < 0) setPath([]); else setPath((p) => p.slice(0, index + 1));
    setSelectedPsId(null);
  }
  function togglePick(serviceId: string) {
    setPickedServiceIds((prev) => prev.includes(serviceId) ? prev.filter((x) => x !== serviceId) : [...prev, serviceId]);
  }

  async function offerPicked() {
    if (!pickedServiceIds.length) return;
    setBusy(true); setError(null);
    try {
      for (const serviceId of pickedServiceIds) {
        if (mine.find((m) => m.serviceId === serviceId)) continue;
        await upsertMyService({ serviceId, durationMin: 60, price: 0, isActive: true });
      }
      setMsg(`${pickedServiceIds.length} خدمت اضافه شد — قیمت و زمان را تکمیل کنید`);
      setPickedServiceIds([]);
      await load();
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setBusy(false); }
  }

  async function addRootSpecialty(rootId: string) {
    if (selectedRootIds.includes(rootId)) return;
    setBusy(true);
    try { await persistRoots([...selectedRootIds, rootId]); setMsg('تخصص اضافه شد'); setMode('home'); }
    finally { setBusy(false); }
  }

  async function removeRootSpecialty(rootId: string) {
    setBusy(true);
    try {
      await persistRoots(selectedRootIds.filter((id) => id !== rootId));
      if (activeRootId === rootId) goHome();
    } finally { setBusy(false); }
  }

  async function onSavePs() {
    if (!selectedPs) return;
    setBusy(true); setError(null);
    try {
      await patchMyService(selectedPs.id, { price, durationMin, description: description.trim() || undefined });
      setMsg('قیمت و زمان ذخیره شد');
      await load();
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setBusy(false); }
  }

  async function applyFixedToAllLeaves() {
    const base = path.length ? currentCategory : activeRootId ? findCategory(tree, activeRootId) : null;
    const leaves = collectLeaves(base);
    if (!leaves.length) { setError('خدمتی برای اعمال وجود ندارد'); return; }
    setBusy(true); setError(null);
    try {
      for (const leaf of leaves) {
        await upsertMyService({ serviceId: leaf.id, durationMin: durationMin || 60, price: price || 0, isActive: true });
      }
      setMsg(`اعمال شد برای ${leaves.length} خدمت`);
      await load();
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setBusy(false); }
  }

  async function onAddPriceRule() {
    if (!selectedPs || !ruleLabel.trim()) return;
    setBusy(true);
    try {
      await upsertMyPriceRule(selectedPs.id, { label: ruleLabel.trim(), price: rulePrice || 0 });
      setRuleLabel('');
      setPriceRules(await fetchMyPriceRules(selectedPs.id));
      setMsg('قانون قیمت اضافه شد');
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setBusy(false); }
  }

  async function onAddDurationRule() {
    if (!selectedPs || !ruleLabel.trim()) return;
    setBusy(true);
    try {
      await upsertMyDurationRule(selectedPs.id, { label: ruleLabel.trim(), durationMin: ruleDuration || 60 });
      setRuleLabel('');
      setDurationRules(await fetchMyDurationRules(selectedPs.id));
      setMsg('قانون زمان اضافه شد');
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setBusy(false); }
  }

  async function onAddOn() {
    if (!selectedPs || !addOnName.trim()) return;
    setBusy(true);
    try {
      await upsertMyAddOn(selectedPs.id, { name: addOnName.trim(), price: addOnPrice || 0, extraDurationMin: addOnExtra || 0, isActive: true });
      setAddOnName(''); setAddOnPrice(0); setAddOnExtra(0);
      setMsg('افزودنی فعال شد');
      await load();
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setBusy(false); }
  }

  async function onUploadMedia(file: File) {
    if (!selectedPs) return;
    setUploadState('uploading'); setUploadErr(null); setBusy(true);
    try {
      await uploadMyMedia(file, 'service', selectedPs.id);
      setUploadState('ok');
      setMsg('\u2705 \u0646\u0645\u0648\u0646\u0647\u200c\u06a9\u0627\u0631 \u0628\u0627 \u0645\u0648\u0641\u0642\u06cc\u062a \u0627\u0636\u0627\u0641\u0647 \u0634\u062f');
      await load();
    } catch (e) {
      setUploadState('err');
      setUploadErr(friendlyApiError(e));
      setError(friendlyApiError(e));
    } finally { setBusy(false); }
  }

  async function onDeleteMedia(id: string) {
    setBusy(true);
    try { await deleteMyMedia(id); await load(); setMsg('نمونه‌کار حذف شد'); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setBusy(false); }
  }

  async function onToggleActive(ps: ProfessionalServiceItem) {
    setBusy(true);
    try {
      if (ps.isActive === false) await patchMyService(ps.id, { isActive: true });
      else await deactivateMyService(ps.id);
      await load();
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setBusy(false); }
  }

  if (loading) return <PanelLoading />;
  if (error && !tree.length) return <PanelError message={error} onRetry={load} />;

  const rootName = activeRootId ? roots.find((r) => r.id === activeRootId)?.name || 'تخصص' : '';

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">تخصص‌ها</h1>
          <p className="mt-1 text-sm text-gray">مدیریت خدمات، قیمت، زمان و نمونه‌کار</p>
        </div>
        {mode !== 'home' && (
          <Button size="sm" variant="outline" onClick={goHome}>\u2190 تخصص‌های من</Button>
        )}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">\u274c {error}</p>}
      {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      <div className="relative">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="\uD83D\uDD0D جستجوی تخصص یا خدمت" className="w-full" />
        {search.trim() && (
          <Card className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto p-2 shadow-lg">
            {searchResults.length === 0 ? (
              <p className="p-2 text-sm text-gray">نتیجه‌ای یافت نشد</p>
            ) : (
              <ul className="space-y-1">
                {searchResults.map((r) => (
                  <li key={`${r.type}-${r.id}`}>
                    <button type="button" className="w-full rounded-xl px-3 py-2 text-right text-sm hover:bg-gray-light"
                      onClick={() => {
                        if (!selectedRootIds.includes(r.rootId)) void persistRoots([...selectedRootIds, r.rootId]);
                        setActiveRootId(r.rootId); setMode('browse'); setSearch(''); setPath([]);
                        if (r.type === 'svc') {
                          const offered = mine.find((m) => m.serviceId === r.id);
                          if (offered) setSelectedPsId(offered.id);
                          else setPickedServiceIds((p) => (p.includes(r.id) ? p : [...p, r.id]));
                        }
                      }}>
                      <span className="font-medium">{r.name}</span>
                      <span className="mt-0.5 block text-xs text-gray">{r.path}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      {mode === 'home' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">تخصص‌های من</h2>
            <Button size="sm" onClick={openAddSpecialty}>+ افزودن تخصص</Button>
          </div>
          {myRoots.length === 0 ? (
            <PanelEmpty title="هنوز تخصصی انتخاب نشده" />
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {myRoots.map((r) => {
                const leaves = collectLeaves(r);
                const offered = leaves.filter((l) => mine.some((m) => m.serviceId === l.id));
                const ready = offered.filter((l) => statusOf(mine.find((m) => m.serviceId === l.id)) === 'ready').length;
                const incomplete = offered.length - ready;
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => openRoot(r.id)}
                      className="flex h-full w-full flex-col rounded-2xl border border-border bg-white p-4 text-right shadow-sm hover:border-coral/40">
                      <span className="text-base font-bold">{r.name}</span>
                      <span className="mt-2 text-xs text-gray">
                        {offered.length} خدمت{ready > 0 ? ` \u00b7 \uD83D\uDFE2 ${ready}` : ''}{incomplete > 0 ? ` \u00b7 \uD83D\uDFE1 ${incomplete}` : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Card className="space-y-3">
            <h2 className="font-semibold">خدمات فعال شما</h2>
            {mine.length === 0 ? (
              <p className="text-sm text-gray">خدمتی ثبت نشده — یک تخصص را باز کنید.</p>
            ) : (
              <ul className="space-y-2">
                {mine.map((ps) => {
                  const st = statusOf(ps);
                  return (
                    <li key={ps.id}>
                      <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-border px-3 py-2.5 text-right text-sm"
                        onClick={() => {
                          const root = ps.service?.category?.id ? rootOf(tree, ps.service.category.id) : null;
                          if (root) { setActiveRootId(root.id); setMode('browse'); }
                          setSelectedPsId(ps.id);
                        }}>
                        <div>
                          <p className="font-medium">{ps.service?.name || ps.serviceId}</p>
                          <p className="text-xs text-gray">{ps.durationMin ? `${ps.durationMin} دقیقه` : 'زمان؟'} \u00b7 {(ps.price ?? 0) > 0 ? formatPrice(ps.price) : 'قیمت؟'}</p>
                        </div>
                        <span className="text-xs">{st === 'ready' ? '\uD83D\uDFE2 آماده' : '\uD83D\uDFE1 نیاز به تکمیل'}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      {mode === 'add' && (
        <Card className="space-y-3">
          <h2 className="font-semibold">افزودن تخصص از کاتالوگ</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {roots.map((r) => {
              const on = selectedRootIds.includes(r.id);
              return (
                <li key={r.id}>
                  <button type="button" disabled={busy || on} onClick={() => addRootSpecialty(r.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-sm font-medium ${on ? 'border-coral/30 bg-coral/5 text-gray' : 'border-border bg-white hover:border-coral/40'}`}>
                    {on ? '\u2713 ' : '+ '}{r.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {mode === 'browse' && activeRootId && (
        <>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <button type="button" onClick={goHome} className="rounded-lg px-2 py-1 text-coral hover:bg-coral/5">تخصص‌ها</button>
            <span className="text-gray">/</span>
            <button type="button" onClick={() => goBreadcrumb(-1)} className="rounded-lg px-2 py-1 font-medium hover:bg-gray-light">{rootName}</button>
            {path.map((n, i) => (
              <span key={n.id} className="flex items-center gap-1">
                <span className="text-gray">\u2190</span>
                <button type="button" onClick={() => goBreadcrumb(i)} className="rounded-lg px-2 py-1 hover:bg-gray-light">{n.name}</button>
              </span>
            ))}
            <button type="button" className="mr-auto text-xs text-gray underline" onClick={() => removeRootSpecialty(activeRootId)}>حذف از تخصص‌های من</button>
          </nav>

          <Card className="space-y-3">
            {children.length === 0 && leafServices.length === 0 && <PanelEmpty title="زیرمجموعه‌ای ثبت نشده" />}
            {children.length > 0 && (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {children.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => enterCategory(c)} className="w-full rounded-2xl border border-border px-3 py-3 text-right text-sm font-medium hover:border-coral/40">
                      {c.name}<span className="mt-0.5 block text-xs font-normal text-gray">ورود \u2192</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {leafServices.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-medium text-gray">خدمات این سطح</p>
                <ul className="space-y-2">
                  {leafServices.map((s) => {
                    const offered = mine.find((m) => m.serviceId === s.id);
                    const picked = pickedServiceIds.includes(s.id);
                    const st = statusOf(offered);
                    return (
                      <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{s.name}</p>
                          {offered && <p className="text-xs text-gray">{st === 'ready' ? '\uD83D\uDFE2 آماده رزرو' : '\uD83D\uDFE1 نیاز به تکمیل'} \u00b7 {formatPrice(offered.price)} \u00b7 {offered.durationMin}\u062f</p>}
                        </div>
                        {offered ? (
                          <Button size="sm" variant="secondary" onClick={() => setSelectedPsId(offered.id)}>مدیریت</Button>
                        ) : (
                          <button type="button" onClick={() => togglePick(s.id)}
                            className={`rounded-full border px-3 py-1 text-xs ${picked ? 'border-coral bg-coral text-white' : 'border-border bg-white text-gray'}`}>
                            {picked ? '\u2611\ufe0f انتخاب شد' : '\u2610 انتخاب'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {pickedServiceIds.length > 0 && (
              <div className="rounded-2xl border border-coral/30 bg-coral/5 p-3">
                <p className="text-sm font-medium">انتخاب‌های من ({pickedServiceIds.length})</p>
                <Button className="mt-2" size="sm" loading={busy} onClick={offerPicked}>افزودن به خدمات من</Button>
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <h3 className="font-semibold">قیمت ثابت برای این شاخه</h3>
            <p className="text-xs text-gray">اعمال قیمت و زمان برای همه خدمات زیر این سطح</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-sm"><span className="text-gray">قیمت (تومان)</span>
                <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-1" /></label>
              <label className="block text-sm"><span className="text-gray">زمان (دقیقه)</span>
                <Input type="number" min={5} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className="mt-1" /></label>
            </div>
            <Button size="sm" variant="secondary" loading={busy} onClick={applyFixedToAllLeaves}>\u2611\ufe0f اعمال برای همه مدل‌های این سطح</Button>
          </Card>
        </>
      )}

      {selectedPs && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">{selectedPs.service?.name}</h2>
              <p className="text-xs text-gray">{statusOf(selectedPs) === 'ready' ? '\uD83D\uDFE2 آماده رزرو' : '\uD83D\uDFE1 نیاز به تکمیل'}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" loading={busy} onClick={() => onToggleActive(selectedPs)}>{selectedPs.isActive === false ? 'فعال‌سازی' : 'غیرفعال'}</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedPsId(null)}>بستن</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button type="button" onClick={() => setPriceMode('fixed')} className={`rounded-full border px-3 py-1 ${priceMode === 'fixed' ? 'border-coral bg-coral text-white' : 'border-border'}`}>\u25cb قیمت ثابت</button>
            <button type="button" onClick={() => setPriceMode('varied')} className={`rounded-full border px-3 py-1 ${priceMode === 'varied' ? 'border-coral bg-coral text-white' : 'border-border'}`}>\u25cb قیمت / زمان متفاوت</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm"><span className="text-gray">قیمت پایه (تومان)</span>
              <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-1" /></label>
            <label className="block text-sm"><span className="text-gray">مدت پایه (دقیقه)</span>
              <Input type="number" min={5} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className="mt-1" /></label>
            <label className="block text-sm sm:col-span-2"><span className="text-gray">توضیحات</span>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" /></label>
          </div>
          <Button loading={busy} onClick={onSavePs}>ذخیره قیمت و زمان پایه</Button>

          {priceMode === 'varied' && (
            <div className="space-y-3 border-t border-border pt-3">
              <h3 className="text-sm font-medium">+ تغییر بعضی مدل‌ها</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input placeholder="برچسب مدل" value={ruleLabel} onChange={(e) => setRuleLabel(e.target.value)} />
                <Input type="number" min={0} placeholder="قیمت" value={rulePrice} onChange={(e) => setRulePrice(Number(e.target.value))} />
                <Input type="number" min={5} placeholder="زمان" value={ruleDuration} onChange={(e) => setRuleDuration(Number(e.target.value))} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" loading={busy} onClick={onAddPriceRule} disabled={!ruleLabel.trim()}>+ قانون قیمت</Button>
                <Button size="sm" variant="secondary" loading={busy} onClick={onAddDurationRule} disabled={!ruleLabel.trim()}>+ قانون زمان</Button>
              </div>
              <ul className="space-y-1 text-sm">
                {priceRules.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 rounded-lg bg-gray-light/60 px-2 py-1">
                    <span>{r.label}: {formatPrice(r.price)}</span>
                    <button type="button" className="text-xs text-coral" onClick={async () => {
                      if (!selectedPs) return;
                      await deleteMyPriceRule(selectedPs.id, r.id);
                      setPriceRules(await fetchMyPriceRules(selectedPs.id));
                    }}>حذف</button>
                  </li>
                ))}
                {durationRules.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 rounded-lg bg-gray-light/60 px-2 py-1">
                    <span>{r.label}: {r.durationMin}\u062f</span>
                    <button type="button" className="text-xs text-coral" onClick={async () => {
                      if (!selectedPs) return;
                      await deleteMyDurationRule(selectedPs.id, r.id);
                      setDurationRules(await fetchMyDurationRules(selectedPs.id));
                    }}>حذف</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="font-medium">نمونه‌کار</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(selectedPs.mediaAssets || []).map((m: MediaAssetItem) => (
                <div key={m.id} className="relative">
                  {isVideoMime(m.mimeType) ? (
                    <video src={resolveMediaUrl(m.publicUrl)} className="aspect-square w-full rounded-xl object-cover" controls playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveMediaUrl(m.publicUrl)} alt="" className="aspect-square w-full rounded-xl object-cover" />
                  )}
                  <button type="button" onClick={() => onDeleteMedia(m.id)} className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">حذف</button>
                </div>
              ))}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm hover:border-coral/40">
              <span>{uploadState === 'uploading' ? 'در حال آپلود\u2026' : uploadState === 'ok' ? '\u2705 اضافه شد' : '+ افزودن نمونه‌کار'}</span>
              <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" className="hidden" disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadMedia(f); e.target.value = ''; }} />
            </label>
            {uploadState === 'err' && uploadErr && <p className="text-xs text-red-600">\u274c آپلود انجام نشد: {uploadErr}</p>}
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="font-medium">افزودنی‌ها (اختیاری)</h3>
            <p className="text-xs text-gray">فقط موارد فعال به مشتری نشان داده می‌شود.</p>
            <ul className="space-y-2">
              {(selectedPs.addOns || []).map((a: ServiceAddOnItem) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">\u2611\ufe0f {a.name}</p>
                    <p className="text-xs text-gray">{formatPrice(a.price)}{a.extraDurationMin ? ` \u00b7 +${a.extraDurationMin}\u062f` : ''}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => deactivateMyAddOn(a.id).then(load)}>غیرفعال</Button>
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input placeholder="نام افزودنی" value={addOnName} onChange={(e) => setAddOnName(e.target.value)} />
              <Input type="number" min={0} placeholder="قیمت اضافه" value={addOnPrice} onChange={(e) => setAddOnPrice(Number(e.target.value))} />
              <Input type="number" min={0} placeholder="زمان اضافه" value={addOnExtra} onChange={(e) => setAddOnExtra(Number(e.target.value))} />
            </div>
            <Button size="sm" variant="secondary" loading={busy} onClick={onAddOn} disabled={!addOnName.trim()}>\u2610 فعال‌سازی Add-on</Button>
          </div>
        </Card>
      )}

      <p className="text-center text-xs text-gray">
        <Link href="/zibagar/profile/complete" className="text-coral underline">تکمیل پروفایل</Link>
      </p>
    </div>
  );
}
