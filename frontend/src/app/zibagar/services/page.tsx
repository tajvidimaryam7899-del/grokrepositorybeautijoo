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
  createServiceNode,
  createCategoryNode,
  type ProfessionalServiceItem,
  type CatalogCategory,
  type ServiceAddOnItem,
  type PriceRuleItem,
  type DurationRuleItem,
  type MediaAssetItem,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice, parsePriceInput, formatPriceDigits, priceToWords } from '@/lib/utils';
import {
  FEATURED_ROOT_NAMES,
  collectLeaves,
  findCategory,
  flattenSearch,
  navy,
  rootOf,
  serviceLabel,
  statusOf,
  type PathNode,
} from './services-helpers';
import { SpecialtyView } from './SpecialtyView';
import { ServiceEditPanel } from './ServiceEditPanel';

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

  /** Offered services under active root — restaurant-style menu. */
  const specialtyMenu = useMemo(() => {
    if (!activeRootId) return [];
    const root = findCategory(tree, activeRootId);
    const leaves = collectLeaves(root);
    const leafIds = new Set(leaves.map((l) => l.id));
    return mine
      .filter(
        (ps) =>
          leafIds.has(ps.serviceId) ||
          (ps.service?.category?.id && rootOf(tree, ps.service.category.id)?.id === activeRootId),
      )
      .sort((a, b) => serviceLabel(a).localeCompare(serviceLabel(b), 'fa'));
  }, [activeRootId, tree, mine]);

  /** Group menu items by parent category name for restaurant sections. */
  const menuSections = useMemo(() => {
    const map = new Map<string, ProfessionalServiceItem[]>();
    for (const ps of specialtyMenu) {
      const section = ps.service?.category?.name?.trim() || activeRoot?.name || 'خدمات';
      if (!map.has(section)) map.set(section, []);
      map.get(section)!.push(ps);
    }
    return Array.from(map.entries());
  }, [specialtyMenu, activeRoot?.name]);

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

  async function createAndEditCustomService(name: string) {
    if (!activeRootId || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createServiceNode({
        name: name.trim(),
        categoryId: activeRootId,
      });
      setSearch('');
      setMsg(`«${created.name}» اضافه شد`);
      await load();
      await ensureAndEditService(created.id, created.name);
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
      setMsg('تنوع اضافه شد');
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
      setMsg('گزینه اضافی اضافه شد');
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
                  {!addSearchResults.some((r) => r.name === addSearch.trim()) && (
                    <li>
                      <button
                        type="button"
                        disabled={busy}
                        className={`w-full rounded-xl px-3 py-2.5 text-right text-sm font-semibold ${navy.title} hover:bg-[#F3F6F9]`}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const created = await createCategoryNode({ name: addSearch.trim() });
                            await addRootSpecialty(created.id);
                            setAddSearch('');
                          } catch (e) {
                            setError(friendlyApiError(e));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        ＋ افزودن «{addSearch.trim()}»
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'specialty' && activeRootId && (
        <SpecialtyView
          activeRootId={activeRootId}
          activeRoot={activeRoot}
          tree={tree}
          mine={mine}
          path={path}
          setPath={setPath}
          search={search}
          setSearch={setSearch}
          searchResults={searchResults}
          categoryChildren={children}
          leafServices={leafServices}
          menuSections={menuSections}
          specialtyMedia={specialtyMedia}
          specialtyMenu={specialtyMenu}
          busy={busy}
          uploadState={uploadState}
          uploadErr={uploadErr}
          ensureAndEditService={ensureAndEditService}
          setSelectedPsId={setSelectedPsId}
          setMode={setMode}
          setBusy={setBusy}
          setError={setError}
          setMsg={setMsg}
          load={load}
          onDeleteMedia={onDeleteMedia}
          onUploadMedia={onUploadMedia}
          removeRootSpecialty={removeRootSpecialty}
          createAndEditCustomService={createAndEditCustomService}
        />
      )}

      {mode === 'edit' && selectedPs && (
        <ServiceEditPanel
          selectedPs={selectedPs}
          busy={busy}
          price={price}
          setPrice={setPrice}
          durationMin={durationMin}
          setDurationMin={setDurationMin}
          activeRootId={activeRootId}
          showModels={showModels}
          setShowModels={setShowModels}
          priceRules={priceRules}
          setPriceRules={setPriceRules}
          durationRules={durationRules}
          setDurationRules={setDurationRules}
          ruleLabel={ruleLabel}
          setRuleLabel={setRuleLabel}
          rulePrice={rulePrice}
          setRulePrice={setRulePrice}
          ruleDuration={ruleDuration}
          setRuleDuration={setRuleDuration}
          showAddOnForm={showAddOnForm}
          setShowAddOnForm={setShowAddOnForm}
          addOnName={addOnName}
          setAddOnName={setAddOnName}
          addOnPrice={addOnPrice}
          setAddOnPrice={setAddOnPrice}
          addOnExtra={addOnExtra}
          setAddOnExtra={setAddOnExtra}
          uploadState={uploadState}
          uploadErr={uploadErr}
          onSavePs={onSavePs}
          applyFixedToAllUnderRoot={applyFixedToAllUnderRoot}
          onAddModel={onAddModel}
          onAddOn={onAddOn}
          onToggleActive={onToggleActive}
          onDeleteMedia={onDeleteMedia}
          onUploadMedia={onUploadMedia}
          load={load}
        />
      )}

      <p className="text-center text-xs text-gray-400">
        <Link href="/zibagar/profile/complete" className="underline">
          تکمیل پروفایل
        </Link>
      </p>
    </div>
  );
}
