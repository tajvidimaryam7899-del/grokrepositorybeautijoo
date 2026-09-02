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
  const [editingAddOnId, setEditingAddOnId] = useState<string | null>(null);

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
      const ids = (pro?.selectedCategoryIds as string[] | null) || [];
      setSelectedRootIds(Array.isArray(ids) ? ids.filter(Boolean) : []);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedPs = useMemo(
    () => (selectedPsId ? mine.find((m) => m.id === selectedPsId) || null : null),
    [mine, selectedPsId],
  );

  useEffect(() => {
    if (!selectedPs) return;
    setPrice(selectedPs.price || 0);
    setDurationMin(selectedPs.durationMin || 60);
    setShowModels((selectedPs.priceRules?.length || 0) > 0 || (selectedPs.durationRules?.length || 0) > 0);
    setPriceRules(selectedPs.priceRules || []);
    setDurationRules(selectedPs.durationRules || []);
    (async () => {
      try {
        const [pr, dr] = await Promise.all([
          fetchMyPriceRules(selectedPs.id),
          fetchMyDurationRules(selectedPs.id),
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
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return searchIndex
      .filter((r) => r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q))
      .slice(0, 20);
  }, [search, searchIndex]);

  async function persistRoots(ids: string[]) {
    setSelectedRootIds(ids);
    await setMySelectedCategories(ids);
  }

  async function addRootSpecialty(rootId: string) {
    if (selectedRootIds.includes(rootId)) return;
    setBusy(true);
    try {
      await persistRoots([...selectedRootIds, rootId]);
      setActiveRootId(rootId);
      setPath([]);
      setMode('specialty');
      setMsg(null);
    } catch (e) {
      setError(friendlyApiError(e));
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

  function goHome() {
    setMode('home');
    setActiveRootId(null);
    setPath([]);
    setSelectedPsId(null);
    setSearch('');
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
      // Final option attaches under current path category (or root). Price optional (defaults 0).
      const parentCatId = path.length > 0 ? path[path.length - 1].id : activeRootId;
      const created = await createServiceNode({
        name: name.trim(),
        categoryId: parentCatId,
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

  /** Intermediate feature (category). Never asks for price. */
  async function createFeature(name: string) {
    if (!activeRootId || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const parentId = path.length > 0 ? path[path.length - 1].id : activeRootId;
      const created = await createCategoryNode({
        name: name.trim(),
        parentId,
      });
      setMsg(`ویژگی «${created.name}» اضافه شد`);
      await load();
      setPath((p) => [...p, { id: created.id, name: created.name }]);
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
      setRulePrice(0);
      setRuleDuration(60);
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
        ...(editingAddOnId ? { id: editingAddOnId } : {}),
        name: addOnName.trim(),
        price: addOnPrice || 0,
        extraDurationMin: addOnExtra || 0,
        isActive: true,
      });
      setAddOnName('');
      setAddOnPrice(0);
      setAddOnExtra(0);
      setEditingAddOnId(null);
      setShowAddOnForm(false);
      setMsg(editingAddOnId ? 'ویژگی به‌روزرسانی شد' : 'ویژگی اضافه شد');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(ps: ProfessionalServiceItem) {
    setBusy(true);
    try {
      await patchMyService(ps.id, { isActive: !(ps.isActive !== false) });
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteMedia(id: string) {
    setBusy(true);
    try {
      await deleteMyMedia(id);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onUploadMedia(file: File, attachToPsId?: string) {
    setUploadState('uploading');
    setUploadErr(null);
    try {
      await uploadMyMedia(file, 'portfolio', attachToPsId);
      setUploadState('ok');
      await load();
    } catch (e) {
      setUploadState('err');
      setUploadErr(friendlyApiError(e));
    }
  }

  if (loading) return <PanelLoading />;
  if (error && !tree.length) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="mx-auto max-w-lg space-y-4 px-3 py-4 pb-24">
      {/* header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className={`text-lg font-bold ${navy.title}`}>
            {mode === 'home' && 'تخصص‌ها و خدمات'}
            {mode === 'specialty' && (activeRoot?.name || 'تخصص')}
            {mode === 'edit' && 'ویرایش خدمت'}
            {mode === 'add' && 'افزودن تخصص'}
          </h1>
          {msg && <p className="text-xs text-green-600">{msg}</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        {mode !== 'home' && (
          <button type="button" onClick={goHome} className="text-sm text-gray-500 underline">
            ← بازگشت
          </button>
        )}
      </div>

      {mode === 'home' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">تخصص‌های خود را انتخاب یا بسازید.</p>
          <div className="grid grid-cols-2 gap-2">
            {myRoots.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setActiveRootId(r.id);
                  setPath([]);
                  setMode('specialty');
                }}
                className={`rounded-2xl border ${navy.border} bg-white px-3 py-4 text-right text-sm font-medium`}
              >
                {r.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMode('add')}
              className={`rounded-2xl border border-dashed ${navy.border} px-3 py-4 text-sm text-gray-500`}
            >
              + افزودن تخصص
            </button>
          </div>

          {FEATURED_ROOT_NAMES.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-400">پیشنهادی</p>
              <div className="flex flex-wrap gap-2">
                {roots
                  .filter((r) => FEATURED_ROOT_NAMES.some((n) => r.name.includes(n)))
                  .filter((r) => !selectedRootIds.includes(r.id))
                  .slice(0, 8)
                  .map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void addRootSpecialty(r.id)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs"
                    >
                      {r.name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMode('add')}
            className={`w-full rounded-xl py-2.5 text-sm font-medium ${navy.btn}`}
          >
            + افزودن تخصص
          </button>
        </div>
      )}

      {mode === 'add' && (
        <div className="space-y-3">
          <Input
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            placeholder="نام تخصص..."
            className="w-full"
          />
          {addSearch.trim() && (
            <div className="relative">
              <ul className={`max-h-60 overflow-y-auto rounded-2xl border ${navy.border} bg-white p-1`}>
                {roots
                  .filter((r) => r.name.includes(addSearch.trim()))
                  .slice(0, 10)
                  .map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="w-full rounded-xl px-3 py-2.5 text-right text-sm hover:bg-[#F3F6F9]"
                        onClick={() => void addRootSpecialty(r.id)}
                      >
                        {r.name}
                      </button>
                    </li>
                  ))}
                {!roots.some((r) => r.name === addSearch.trim()) && (
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
          createFeature={createFeature}
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
          editingAddOnId={editingAddOnId}
          setEditingAddOnId={setEditingAddOnId}
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
