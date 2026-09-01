'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
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

/** Featured root names for wizard-like "add specialty" chips (Persian catalog). */
const FEATURED_ROOT_NAMES = ['پوست', 'مو', 'ناخن', 'میکاپ', 'مردانه'];

type PathNode = { id: string; name: string };
type LeafService = { id: string; name: string };

const navy = {
  btn: 'bg-[#0B2C4A] text-white hover:bg-[#08324F]',
  btnOutline: 'border border-[#0B2C4A] text-[#0B2C4A] bg-white hover:bg-[#F3F6F9]',
  chipOn: 'border-[#0B2C4A] bg-[#0B2C4A] text-white',
  chipOff: 'border-gray-200 bg-white text-gray-800 hover:border-[#0B2C4A]/40',
  title: 'text-[#0B2C4A]',
  soft: 'bg-[#F3F6F9]',
  border: 'border-gray-200',
};

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
    out.push({ type: 'cat', id: c.id, name: c.name, path: p.join(' › '), rootId });
    for (const s of c.services || []) {
      out.push({ type: 'svc', id: s.id, name: s.name, path: [...p, s.name].join(' › '), rootId });
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

function serviceLabel(ps: ProfessionalServiceItem) {
  return ps.service?.name?.trim() || 'خدمت';
}

export default function ZibagarServicesPage() {
  const [tree, setTree] = useState<CatalogCategory[]>([]);
  const [mine, setMine] = useState<ProfessionalServiceItem[]>([]);
  const [selectedRootIds, setSelectedRootIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** home | specialty (one root) | edit service | add specialty */
  const [mode, setMode] = useState<'home' | 'specialty' | 'edit' | 'add'>('home');
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [path, setPath] = useState<PathNode[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPsId, setSelectedPsId] = useState<string | null>(null);

  const [price, setPrice] = useState(0);
  const [durationMin, setDurationMin] = useState(60);
  const [showModels, setShowModels] = useState(false);
  const [priceRules, setPriceRules] = useState<PriceRuleItem[]>([]);
  const [durationRules, setDurationRules] = useState<DurationRuleItem[]>([]);
  const [ruleLabel, setRuleLabel] = useState('');
  const [rulePrice, setRulePrice] = useState(0);
  const [ruleDuration, setRuleDuration] = useState(60);

  const [showAddOnForm, setShowAddOnForm] = useState(false);
  const [addOnName, setAddOnName] = useState('');
  const [addOnPrice, setAddOnPrice] = useState(0);
  const [addOnExtra, setAddOnExtra] = useState(0);

  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'ok' | 'err'>('idle');
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [showMoreSearch, setShowMoreSearch] = useState(false);
  const [addSearch, setAddSearch] = useState('');

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
        } catch {
          /* ignore */
        }
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

  useEffect(() => {
    load();
  }, [load]);

  const selectedPs = useMemo(
    () => (selectedPsId ? mine.find((m) => m.id === selectedPsId) || null : null),
    [selectedPsId, mine],
  );

  useEffect(() => {
    if (!selectedPs) return;
    setPrice(selectedPs.price || 0);
    setDurationMin(selectedPs.durationMin || 60);
    setShowModels((selectedPs.priceRules?.length || 0) > 0 || (selectedPs.durationRules?.length || 0) > 0);
    setPriceRules(selectedPs.priceRules || []);
    setDurationRules(selectedPs.durationRules || []);
    setShowAddOnForm(false);
    (async () => {
      try {
        const [pr, dr] = await Promise.all([
          fetchMyPriceRules(selectedPs.id).catch(() => []),
          fetchMyDurationRules(selectedPs.id).catch(() => []),
        ]);
        if (pr.length) setPriceRules(pr);
        if (dr.length) setDurationRules(dr);
        if (pr.length || dr.length) setShowModels(true);
      } catch {
        /* ignore */
      }
    })();
  }, [selectedPsId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeRoot = useMemo(
    () => (activeRootId ? roots.find((r) => r.id === activeRootId) || null : null),
    [roots, activeRootId],
  );

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

  /** Offered services under active root — the price menu table. */
  const specialtyMenu = useMemo(() => {
    if (!activeRootId) return [];
    const root = findCategory(tree, activeRootId);
    const leaves = collectLeaves(root);
    const leafIds = new Set(leaves.map((l) => l.id));
    return mine
      .filter((ps) => leafIds.has(ps.serviceId) || (ps.service?.category?.id && rootOf(tree, ps.service.category.id)?.id === activeRootId))
      .sort((a, b) => serviceLabel(a).localeCompare(serviceLabel(b), 'fa'));
  }, [activeRootId, tree, mine]);

  /** All media under this specialty (all services). */
  const specialtyMedia = useMemo(() => {
    const items: MediaAssetItem[] = [];
    for (const ps of specialtyMenu) {
      for (const m of ps.mediaAssets || []) items.push(m);
    }
    return items;
  }, [specialtyMenu]);

  const searchResults = useMemo(() => {
    const q = search.trim();
    if (!q || !activeRootId) return [];
    return searchIndex
      .filter((x) => x.rootId === activeRootId && x.name.includes(q))
      .slice(0, 24);
  }, [search, searchIndex, activeRootId]);

  const featuredRoots = useMemo(() => {
    const byName = new Map(roots.map((r) => [r.name, r]));
    return FEATURED_ROOT_NAMES.map((n) => byName.get(n)).filter(Boolean) as CatalogCategory[];
  }, [roots]);

  const addSearchResults = useMemo(() => {
    const q = addSearch.trim();
    if (!q) return [];
    return roots.filter((r) => r.name.includes(q) && !selectedRootIds.includes(r.id)).slice(0, 20);
  }, [addSearch, roots, selectedRootIds]);

  async function persistRoots(ids: string[]) {
    setSelectedRootIds(ids);
    try {
      localStorage.setItem('beautijoo_wizard_root_categories', JSON.stringify(ids));
    } catch {
      /* */
    }
    try {
      await setMySelectedCategories(ids);
    } catch (e) {
      setError(friendlyApiError(e));
    }
  }

  function goHome() {
    setMode('home');
    setActiveRootId(null);
    setPath([]);
    setSelectedPsId(null);
    setSearch('');
    setMsg(null);
  }

  function openRoot(id: string) {
    setActiveRootId(id);
    setPath([]);
    setMode('specialty');
    setSelectedPsId(null);
    setSearch('');
    setMsg(null);
  }

  function openAddSpecialty() {
    setMode('add');
    setShowMoreSearch(false);
    setAddSearch('');
    setActiveRootId(null);
    setPath([]);
    setSelectedPsId(null);
  }

  async function addRootSpecialty(rootId: string) {
    if (selectedRootIds.includes(rootId)) return;
    setBusy(true);
    try {
      await persistRoots([...selectedRootIds, rootId]);
      setMsg('تخصص اضافه شد');
      setMode('home');
    } finally {
      setBusy(false);
    }
  }

  async function removeRootSpecialty(rootId: string) {
    setBusy(true);
    try {
      await persistRoots(selectedRootIds.filter((id) => id !== rootId));
      if (activeRootId === rootId) goHome();
    } finally {
      setBusy(false);
    }
  }

  async function ensureAndEditService(serviceId: string, nameHint?: string) {
    setBusy(true);
    setError(null);
    try {
      let ps = mine.find((m) => m.serviceId === serviceId);
      if (!ps) {
        await upsertMyService({ serviceId, durationMin: 60, price: 0, isActive: true });
        await load();
        // reload picks up new row
        const refreshed = await fetchMyServices();
        setMine(refreshed || []);
        ps = (refreshed || []).find((m) => m.serviceId === serviceId);
      }
      if (ps) {
        setSelectedPsId(ps.id);
        setMode('edit');
        setMsg(null);
      } else {
        setError(nameHint ? `نتوانستیم «${nameHint}» را اضافه کنیم` : 'خدمت اضافه نشد');
      }
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSavePs() {
    if (!selectedPs) return;
    setBusy(true);
    setError(null);
    try {
      await patchMyService(selectedPs.id, {
        price,
        durationMin,
        isActive: true,
      });
      setMsg('ذخیره شد');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function applyFixedToAllUnderRoot() {
    if (!activeRootId) return;
    const root = findCategory(tree, activeRootId);
    const leaves = collectLeaves(root);
    if (!leaves.length) {
      setError('خدمتی برای اعمال وجود ندارد');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const leaf of leaves) {
        await upsertMyService({
          serviceId: leaf.id,
          durationMin: durationMin || 60,
          price: price || 0,
          isActive: true,
        });
      }
      setMsg(`قیمت برای ${leaves.length} مورد اعمال شد`);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAddModel() {
    if (!selectedPs || !ruleLabel.trim()) return;
    setBusy(true);
    try {
      await upsertMyPriceRule(selectedPs.id, { label: ruleLabel.trim(), price: rulePrice || price || 0 });
      await upsertMyDurationRule(selectedPs.id, {
        label: ruleLabel.trim(),
        durationMin: ruleDuration || durationMin || 60,
      });
      setRuleLabel('');
      setPriceRules(await fetchMyPriceRules(selectedPs.id));
      setDurationRules(await fetchMyDurationRules(selectedPs.id));
      setMsg('مدل اضافه شد');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAddOn() {
    if (!selectedPs || !addOnName.trim()) return;
    setBusy(true);
    try {
      await upsertMyAddOn(selectedPs.id, {
        name: addOnName.trim(),
        price: addOnPrice || 0,
        extraDurationMin: addOnExtra || 0,
        isActive: true,
      });
      setAddOnName('');
      setAddOnPrice(0);
      setAddOnExtra(0);
      setShowAddOnForm(false);
      setMsg('گزینه تکمیلی اضافه شد');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onUploadMedia(file: File, attachToPsId?: string) {
    const targetId = attachToPsId || selectedPs?.id || specialtyMenu[0]?.id;
    if (!targetId) {
      setUploadState('err');
      setUploadErr('ابتدا یک خدمت با قیمت ثبت کنید، سپس نمونه‌کار اضافه کنید.');
      return;
    }
    setUploadState('uploading');
    setUploadErr(null);
    setBusy(true);
    try {
      await uploadMyMedia(file, 'service', targetId);
      setUploadState('ok');
      setMsg('آپلود شد');
      await load();
    } catch (e) {
      setUploadState('err');
      setUploadErr(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteMedia(id: string) {
    setBusy(true);
    try {
      await deleteMyMedia(id);
      await load();
      setMsg('حذف شد');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(ps: ProfessionalServiceItem) {
    setBusy(true);
    try {
      if (ps.isActive === false) await patchMyService(ps.id, { isActive: true });
      else await deactivateMyService(ps.id);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PanelLoading />;
  if (error && !tree.length) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl font-bold ${navy.title}`}>
            {mode === 'home' && 'تخصص‌های من'}
            {mode === 'add' && 'افزودن تخصص'}
            {mode === 'specialty' && (activeRoot?.name || 'تخصص')}
            {mode === 'edit' && (selectedPs ? serviceLabel(selectedPs) : 'ویرایش')}
          </h1>
          {mode === 'specialty' && path.length > 0 && (
            <p className="mt-0.5 text-xs text-gray-500">
              {(activeRoot?.name || '') + ' › ' + path.map((p) => p.name).join(' › ')}
            </p>
          )}
        </div>
        {mode !== 'home' && (
          <button
            type="button"
            onClick={() => {
              if (mode === 'edit') {
                setSelectedPsId(null);
                setMode(activeRootId ? 'specialty' : 'home');
              } else if (mode === 'specialty' && path.length) {
                setPath((p) => p.slice(0, -1));
              } else {
                goHome();
              }
            }}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            ← بازگشت
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {msg && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>
      )}

      {/* ——— HOME ——— */}
      {mode === 'home' && (
        <>
          {myRoots.length === 0 ? (
            <div className={`rounded-2xl border ${navy.border} ${navy.soft} p-6 text-center`}>
              <p className="text-sm text-gray-600">هنوز تخصصی انتخاب نکرده‌اید</p>
              <button
                type="button"
                onClick={openAddSpecialty}
                className={`mt-4 rounded-xl px-5 py-2.5 text-sm font-medium ${navy.btn}`}
              >
                + افزودن تخصص
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {myRoots.map((r) => {
                const leaves = collectLeaves(r);
                const offered = leaves.filter((l) => mine.some((m) => m.serviceId === l.id));
                const ready = offered.filter(
                  (l) => statusOf(mine.find((m) => m.serviceId === l.id)) === 'ready',
                ).length;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => openRoot(r.id)}
                      className={`flex h-full w-full flex-col rounded-2xl border ${navy.border} bg-white p-4 text-right shadow-sm transition hover:border-[#0B2C4A]/35`}
                    >
                      <span className={`text-base font-bold ${navy.title}`}>{r.name}</span>
                      <span className="mt-2 text-xs text-gray-500">
                        {offered.length
                          ? ready === offered.length
                            ? '🟢 آماده'
                            : '🟡 نیاز به تکمیل'
                          : 'بدون خدمت'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={openAddSpecialty}
            className={`w-full rounded-2xl border border-dashed ${navy.border} py-3 text-sm font-medium text-[#0B2C4A] hover:bg-[#F3F6F9]`}
          >
            + افزودن تخصص
          </button>
        </>
      )}

      {/* ——— ADD SPECIALTY ——— */}
      {mode === 'add' && (
        <div className="space-y-4">
          <p className={`text-sm ${navy.title} font-medium`}>تخصص خودت را انتخاب کن</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {featuredRoots.map((r) => {
              const on = selectedRootIds.includes(r.id);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={busy || on}
                    onClick={() => addRootSpecialty(r.id)}
                    className={`w-full rounded-2xl border px-3 py-3.5 text-sm font-medium transition ${
                      on ? navy.chipOn + ' opacity-70' : navy.chipOff
                    }`}
                  >
                    {on ? '✓ ' : ''}
                    {r.name}
                  </button>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => setShowMoreSearch((v) => !v)}
                className={`w-full rounded-2xl border border-dashed ${navy.border} px-3 py-3.5 text-sm font-medium text-gray-600 hover:border-[#0B2C4A]/40`}
              >
                بیشتر…
              </button>
            </li>
          </ul>

          {showMoreSearch && (
            <div className="space-y-2">
              <Input
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder="جستجوی تخصص…"
                className="w-full"
                autoFocus
              />
              {addSearch.trim() && (
                <ul className={`max-h-56 overflow-y-auto rounded-2xl border ${navy.border} bg-white p-1`}>
                  {addSearchResults.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-gray-500">نتیجه‌ای نیست</li>
                  ) : (
                    addSearchResults.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => addRootSpecialty(r.id)}
                          className="w-full rounded-xl px-3 py-2.5 text-right text-sm hover:bg-[#F3F6F9]"
                        >
                          {r.name}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* ——— SPECIALTY DETAIL ——— */}
      {mode === 'specialty' && activeRootId && (
        <div className="space-y-5">
          {/* Search services inside specialty only */}
          <div className="relative">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی خدمت…"
              className="w-full"
            />
            {search.trim() && (
              <ul
                className={`absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border ${navy.border} bg-white p-1 shadow-lg`}
              >
                {searchResults.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-500">نتیجه‌ای یافت نشد</li>
                ) : (
                  searchResults.map((r) => (
                    <li key={`${r.type}-${r.id}`}>
                      <button
                        type="button"
                        className="w-full rounded-xl px-3 py-2.5 text-right text-sm hover:bg-[#F3F6F9]"
                        onClick={() => {
                          setSearch('');
                          if (r.type === 'svc') {
                            void ensureAndEditService(r.id, r.name);
                          } else {
                            setPath((prev) => {
                              // build path to category under root
                              const cat = findCategory(tree, r.id);
                              if (!cat) return prev;
                              return [...prev.filter(() => false), { id: cat.id, name: cat.name }];
                            });
                          }
                        }}
                      >
                        <span className="font-medium">{r.name}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {/* Optional subcategories — only when present and not searching */}
          {!search.trim() && children.length > 0 && (
            <ul className="grid grid-cols-2 gap-2">
              {children.map((c) => (
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

          {/* Price menu table for configured services */}
          {specialtyMenu.length > 0 && (
            <div className={`overflow-hidden rounded-2xl border ${navy.border} bg-white`}>
              <div className={`border-b ${navy.border} px-4 py-3`}>
                <h2 className={`text-sm font-semibold ${navy.title}`}>
                  قیمت‌های {activeRoot?.name}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px] text-right text-sm">
                  <thead className={`${navy.soft} text-xs text-gray-500`}>
                    <tr>
                      <th className="px-3 py-2 font-medium">خدمت</th>
                      <th className="px-3 py-2 font-medium">قیمت</th>
                      <th className="px-3 py-2 font-medium">مدت</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {specialtyMenu.map((ps) => {
                      const st = statusOf(ps);
                      return (
                        <tr key={ps.id} className={`border-t ${navy.border}`}>
                          <td className="px-3 py-2.5 font-medium">
                            {serviceLabel(ps)}
                            <span className="mr-1 text-xs font-normal text-gray-400">
                              {st === 'ready' ? '🟢' : '🟡'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-gray-700">
                            {(ps.price ?? 0) > 0 ? formatPrice(ps.price) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700">
                            {ps.durationMin ? `${ps.durationMin} دقیقه` : '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              type="button"
                              className={`text-xs font-medium ${navy.title}`}
                              onClick={() => {
                                setSelectedPsId(ps.id);
                                setMode('edit');
                              }}
                            >
                              ویرایش
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
      )}

      {/* ——— EDIT SERVICE ——— */}
      {mode === 'edit' && selectedPs && (
        <div className={`space-y-5 rounded-2xl border ${navy.border} bg-white p-4`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              {statusOf(selectedPs) === 'ready' ? '🟢 آماده رزرو' : '🟡 نیاز به تکمیل'}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggleActive(selectedPs)}
              className="text-xs text-gray-500 underline"
            >
              {selectedPs.isActive === false ? 'فعال‌سازی' : 'غیرفعال'}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-gray-500">قیمت (تومان)</span>
              <Input
                type="number"
                min={0}
                value={price || ''}
                onChange={(e) => setPrice(Number(e.target.value) || 0)}
                className="mt-1"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-500">مدت (دقیقه)</span>
              <Input
                type="number"
                min={5}
                value={durationMin || ''}
                onChange={(e) => setDurationMin(Number(e.target.value) || 0)}
                className="mt-1"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onSavePs}
              className={`rounded-xl px-5 py-2.5 text-sm font-medium ${navy.btn} disabled:opacity-50`}
            >
              تأیید
            </button>
            {activeRootId && (
              <button
                type="button"
                disabled={busy || !(price > 0)}
                onClick={applyFixedToAllUnderRoot}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium ${navy.btnOutline} disabled:opacity-50`}
              >
                اعمال برای همه
              </button>
            )}
          </div>

          {/* Models — collapsed by default */}
          <div className={`border-t ${navy.border} pt-4`}>
            {!showModels ? (
              <button
                type="button"
                onClick={() => setShowModels(true)}
                className={`text-sm font-medium ${navy.title}`}
              >
                + افزودن قیمت متفاوت
              </button>
            ) : (
              <div className="space-y-3">
                <p className={`text-sm font-medium ${navy.title}`}>مدل‌ها</p>
                {(priceRules.length > 0 || durationRules.length > 0) && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead className="text-xs text-gray-500">
                        <tr>
                          <th className="py-1 font-medium">مدل</th>
                          <th className="py-1 font-medium">قیمت</th>
                          <th className="py-1 font-medium">زمان</th>
                          <th className="py-1" />
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(
                          new Set([
                            ...priceRules.map((r) => r.label),
                            ...durationRules.map((r) => r.label),
                          ]),
                        ).map((label) => {
                          const pr = priceRules.find((r) => r.label === label);
                          const dr = durationRules.find((r) => r.label === label);
                          return (
                            <tr key={label} className={`border-t ${navy.border}`}>
                              <td className="py-2">{label}</td>
                              <td className="py-2 tabular-nums">
                                {pr ? formatPrice(pr.price) : '—'}
                              </td>
                              <td className="py-2">
                                {dr ? `${dr.durationMin} دقیقه` : '—'}
                              </td>
                              <td className="py-2">
                                <button
                                  type="button"
                                  className="text-xs text-red-600"
                                  onClick={async () => {
                                    if (!selectedPs) return;
                                    if (pr) await deleteMyPriceRule(selectedPs.id, pr.id);
                                    if (dr) await deleteMyDurationRule(selectedPs.id, dr.id);
                                    setPriceRules(await fetchMyPriceRules(selectedPs.id));
                                    setDurationRules(await fetchMyDurationRules(selectedPs.id));
                                  }}
                                >
                                  حذف
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    placeholder="نام مدل"
                    value={ruleLabel}
                    onChange={(e) => setRuleLabel(e.target.value)}
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="قیمت"
                    value={rulePrice || ''}
                    onChange={(e) => setRulePrice(Number(e.target.value) || 0)}
                  />
                  <Input
                    type="number"
                    min={5}
                    placeholder="زمان"
                    value={ruleDuration || ''}
                    onChange={(e) => setRuleDuration(Number(e.target.value) || 0)}
                  />
                </div>
                <button
                  type="button"
                  disabled={busy || !ruleLabel.trim()}
                  onClick={onAddModel}
                  className={`rounded-xl px-4 py-2 text-sm font-medium ${navy.btn} disabled:opacity-50`}
                >
                  تأیید مدل
                </button>
              </div>
            )}
          </div>

          {/* Add-ons — collapsed */}
          <div className={`border-t ${navy.border} pt-4`}>
            {(selectedPs.addOns || []).filter((a) => a.isActive !== false).length > 0 && (
              <ul className="mb-3 space-y-2">
                {(selectedPs.addOns || [])
                  .filter((a: ServiceAddOnItem) => a.isActive !== false)
                  .map((a) => (
                    <li
                      key={a.id}
                      className={`flex items-center justify-between rounded-xl border ${navy.border} px-3 py-2 text-sm`}
                    >
                      <span>
                        {a.name}
                        <span className="mr-2 text-xs text-gray-500">
                          {formatPrice(a.price)}
                          {a.extraDurationMin ? ` · +${a.extraDurationMin}د` : ''}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="text-xs text-gray-500"
                        onClick={() => deactivateMyAddOn(a.id).then(load)}
                      >
                        حذف
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            {!showAddOnForm ? (
              <button
                type="button"
                onClick={() => setShowAddOnForm(true)}
                className={`text-sm font-medium ${navy.title}`}
              >
                + افزودن گزینه تکمیلی
              </button>
            ) : (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    placeholder="نام گزینه"
                    value={addOnName}
                    onChange={(e) => setAddOnName(e.target.value)}
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="قیمت"
                    value={addOnPrice || ''}
                    onChange={(e) => setAddOnPrice(Number(e.target.value) || 0)}
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="زمان اضافه"
                    value={addOnExtra || ''}
                    onChange={(e) => setAddOnExtra(Number(e.target.value) || 0)}
                  />
                </div>
                <button
                  type="button"
                  disabled={busy || !addOnName.trim()}
                  onClick={onAddOn}
                  className={`rounded-xl px-4 py-2 text-sm font-medium ${navy.btn} disabled:opacity-50`}
                >
                  تأیید
                </button>
              </div>
            )}
          </div>

          {/* Service-level media quick add */}
          <div className={`border-t ${navy.border} pt-4`}>
            <p className={`mb-2 text-sm font-medium ${navy.title}`}>نمونه‌کار این خدمت</p>
            <div className="mb-2 grid grid-cols-3 gap-2">
              {(selectedPs.mediaAssets || []).map((m: MediaAssetItem) => (
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
                    className="absolute left-1 top-1 rounded-md bg-black/55 px-1.5 text-[10px] text-white"
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
            <label
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed ${navy.border} px-4 py-2 text-sm text-[#0B2C4A]`}
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
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUploadMedia(f, selectedPs.id);
                  e.target.value = '';
                }}
              />
            </label>
            {uploadState === 'err' && uploadErr && (
              <p className="mt-1 text-xs text-red-600">آپلود ناموفق بود: {uploadErr}</p>
            )}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-400">
        <Link href="/zibagar/profile/complete" className="underline">
          تکمیل پروفایل
        </Link>
      </p>
    </div>
  );
}
