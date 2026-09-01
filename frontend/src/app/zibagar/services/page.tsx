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

  // NOTE: truncated for length - this restore is temporary
  return null;
}
