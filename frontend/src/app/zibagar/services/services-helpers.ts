import type {
  CatalogCategory,
  ProfessionalServiceItem,
} from '@/lib/panel-api';

export const FEATURED_ROOT_NAMES = ['پوست', 'مو', 'ناخن', 'میکاپ', 'مردانه'];

export type PathNode = { id: string; name: string };
export type LeafService = { id: string; name: string };

export const navy = {
  btn: 'bg-[#0B2C4A] text-white hover:bg-[#08324F]',
  btnOutline: 'border border-[#0B2C4A] text-[#0B2C4A] bg-white hover:bg-[#F3F6F9]',
  chipOn: 'border-[#0B2C4A] bg-[#0B2C4A] text-white',
  chipOff: 'border-gray-200 bg-white text-gray-800 hover:border-[#0B2C4A]/40',
  title: 'text-[#0B2C4A]',
  soft: 'bg-[#F3F6F9]',
  border: 'border-gray-200',
};

export function isVideoMime(mime?: string) {
  return (mime || '').startsWith('video/');
}

export function collectLeaves(cat: CatalogCategory | null | undefined): LeafService[] {
  if (!cat) return [];
  const out: LeafService[] = [];
  for (const s of cat.services || []) out.push({ id: s.id, name: s.name });
  for (const ch of cat.children || []) out.push(...collectLeaves(ch));
  return out;
}

export function findCategory(cats: CatalogCategory[], id: string): CatalogCategory | null {
  for (const c of cats) {
    if (c.id === id) return c;
    if (c.children?.length) {
      const f = findCategory(c.children, id);
      if (f) return f;
    }
  }
  return null;
}

export function rootOf(cats: CatalogCategory[], id: string): CatalogCategory | null {
  for (const r of cats) {
    if (r.id === id) return r;
    if (findCategory([r], id)) return r;
  }
  return null;
}

export function flattenSearch(cats: CatalogCategory[]) {
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

export function statusOf(ps: ProfessionalServiceItem | undefined): 'ready' | 'incomplete' | 'none' {
  if (!ps) return 'none';
  if (ps.isActive === false) return 'incomplete';
  if ((ps.price ?? 0) > 0 && (ps.durationMin ?? 0) > 0) return 'ready';
  return 'incomplete';
}

export function serviceLabel(ps: ProfessionalServiceItem) {
  return ps.service?.name?.trim() || 'خدمت';
}
