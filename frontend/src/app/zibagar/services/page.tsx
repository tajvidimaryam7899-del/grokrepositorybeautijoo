'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchMyServices,
  fetchCategories,
  upsertMyService,
  patchMyService,
  deactivateMyService,
  createCategoryNode,
  createServiceNode,
  upsertMyAddOn,
  deactivateMyAddOn,
  uploadMyMedia,
  deleteMyMedia,
  resolveMediaUrl,
  type ProfessionalServiceItem,
  type CatalogCategory,
  type ServiceAddOnItem,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice } from '@/lib/utils';

type PathNode = { id: string; name: string };

function rootCategories(cats: CatalogCategory[]): CatalogCategory[] {
  return (cats || []).filter((c) => !c.parentId);
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

function isVideoMime(mime: string) {
  return (mime || '').startsWith('video/');
}

export default function ZibagarServicesPage() {
  const [tree, setTree] = useState<CatalogCategory[]>([]);
  const [mine, setMine] = useState<ProfessionalServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<PathNode[]>([]);
  const [selectedPsId, setSelectedPsId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [subName, setSubName] = useState('');
  const [svcName, setSvcName] = useState('');
  const [price, setPrice] = useState(300000);
  const [durationMin, setDurationMin] = useState(60);
  const [description, setDescription] = useState('');
  const [addOnName, setAddOnName] = useState('');
  const [addOnPrice, setAddOnPrice] = useState(50000);
  const [addOnExtra, setAddOnExtra] = useState(0);
  const [addOnDesc, setAddOnDesc] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, services] = await Promise.all([fetchCategories(), fetchMyServices()]);
      setTree(cats || []);
      setMine(services || []);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currentCategory = useMemo(() => {
    if (!path.length) return null;
    return findCategory(tree, path[path.length - 1].id);
  }, [path, tree]);

  const selectedPs = useMemo(
    () => (selectedPsId ? mine.find((m) => m.id === selectedPsId) || null : null),
    [selectedPsId, mine],
  );

  const children = path.length === 0 ? rootCategories(tree) : currentCategory?.children || [];
  const leafServices = path.length === 0 ? [] : currentCategory?.services || [];

  function enterCategory(c: CatalogCategory) {
    setPath((p) => [...p, { id: c.id, name: c.name }]);
    setSelectedPsId(null);
    setMsg(null);
  }

  function goBreadcrumb(index: number) {
    if (index < 0) setPath([]);
    else setPath((p) => p.slice(0, index + 1));
    setSelectedPsId(null);
  }

  async function onCreateSubcategory() {
    const name = subName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      await createCategoryNode({ name, parentId: path.length ? path[path.length - 1].id : undefined });
      setSubName('');
      setMsg('زیرمجموعه ایجاد شد');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCreateSharedService() {
    if (!path.length) {
      setError('ابتدا یک دسته را انتخاب کنید');
      return;
    }
    const name = svcName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      await createServiceNode({ name, categoryId: path[path.length - 1].id });
      setSvcName('');
      setMsg('خدمت مشترک ایجاد شد — اکنون قیمت خود را ثبت کنید');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onOfferService(serviceId: string) {
    setBusy(true);
    setError(null);
    try {
      const ps = await upsertMyService({
        serviceId,
        durationMin: durationMin || 60,
        price: price || 0,
        description: description.trim() || undefined,
        isActive: true,
      });
      setMsg('خدمت به لیست شما اضافه شد');
      await load();
      if (ps && typeof ps === 'object' && 'id' in (ps as object)) {
        setSelectedPsId((ps as ProfessionalServiceItem).id);
      }
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveSelected() {
    if (!selectedPs) return;
    setBusy(true);
    setError(null);
    try {
      await patchMyService(selectedPs.id, {
        price,
        durationMin,
        description: description.trim() || undefined,
      });
      setMsg('تغییرات ذخیره شد');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(ps: ProfessionalServiceItem) {
    setBusy(true);
    setError(null);
    try {
      if (ps.isActive === false) {
        await patchMyService(ps.id, { isActive: true });
      } else {
        await deactivateMyService(ps.id);
      }
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAddOn() {
    if (!selectedPs || !addOnName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await upsertMyAddOn(selectedPs.id, {
        name: addOnName.trim(),
        price: addOnPrice || 0,
        extraDurationMin: addOnExtra || 0,
        description: addOnDesc.trim() || undefined,
        isActive: true,
      });
      setAddOnName('');
      setAddOnDesc('');
      setMsg('افزودنی ثبت شد');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivateAddOn(id: string) {
    setBusy(true);
    try {
      await deactivateMyAddOn(id);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onUploadMedia(file: File) {
    if (!selectedPs) return;
    setBusy(true);
    setError(null);
    try {
      const kind = (file.type || '').startsWith('video/') ? 'SERVICE_VIDEO' : 'SERVICE_IMAGE';
      await uploadMyMedia(file, kind, selectedPs.id);
      setMsg('رسانه آپلود شد');
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

  useEffect(() => {
    if (selectedPs) {
      setPrice(selectedPs.price || 0);
      setDurationMin(selectedPs.durationMin || 60);
      setDescription(selectedPs.description || '');
    }
  }, [selectedPsId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PanelLoading />;
  if (error && !tree.length && !mine.length) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">خدمات من</h1>
        <p className="mt-1 text-sm text-gray">دسته‌بندی، سلسله‌مراتب، قیمت، نمونه‌کار و افزودنی‌ها</p>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      <nav className="flex flex-wrap items-center gap-1 text-sm">
        <button type="button" onClick={() => goBreadcrumb(-1)} className="rounded-lg px-2 py-1 text-coral hover:bg-coral/5">
          ریشه
        </button>
        {path.map((n, i) => (
          <span key={n.id} className="flex items-center gap-1">
            <span className="text-gray">/</span>
            <button type="button" onClick={() => goBreadcrumb(i)} className="rounded-lg px-2 py-1 hover:bg-gray-light">
              {n.name}
            </button>
          </span>
        ))}
      </nav>

      <Card className="space-y-3">
        <h2 className="font-semibold">{path.length ? 'زیرمجموعه‌ها' : 'دسته‌های اصلی'}</h2>
        {children.length === 0 && leafServices.length === 0 && (
          <PanelEmpty title="موردی در این سطح نیست" />
        )}
        <ul className="grid gap-2 sm:grid-cols-2">
          {children.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => enterCategory(c)}
                className="w-full rounded-2xl border border-border px-4 py-3 text-right text-sm font-medium hover:border-coral/40"
              >
                {c.name}
                <span className="mt-0.5 block text-xs font-normal text-gray">ورود به زیرسطح →</span>
              </button>
            </li>
          ))}
        </ul>

        {leafServices.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-gray">خدمات این سطح</p>
            <ul className="space-y-2">
              {leafServices.map((s) => {
                const offered = mine.find((m) => m.serviceId === s.id);
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                    <span className="text-sm font-medium">{s.name}</span>
                    {offered ? (
                      <Button size="sm" variant="secondary" onClick={() => setSelectedPsId(offered.id)}>
                        مدیریت
                      </Button>
                    ) : (
                      <Button size="sm" loading={busy} onClick={() => onOfferService(s.id)}>
                        ارائه خدمت
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
          <div className="flex gap-2">
            <Input placeholder="نام زیرمجموعه جدید" value={subName} onChange={(e) => setSubName(e.target.value)} />
            <Button size="sm" variant="secondary" loading={busy} onClick={onCreateSubcategory} disabled={!subName.trim()}>
              + زیرمجموعه
            </Button>
          </div>
          {path.length > 0 && (
            <div className="flex gap-2">
              <Input placeholder="نام خدمت مشترک جدید" value={svcName} onChange={(e) => setSvcName(e.target.value)} />
              <Button size="sm" variant="secondary" loading={busy} onClick={onCreateSharedService} disabled={!svcName.trim()}>
                + خدمت
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">خدمات فعال شما</h2>
        {mine.length === 0 ? (
          <PanelEmpty title="هنوز خدمتی اضافه نکرده‌اید." />
        ) : (
          <ul className="space-y-2">
            {mine.map((ps) => (
              <li key={ps.id}>
                <button
                  type="button"
                  onClick={() => setSelectedPsId(ps.id)}
                  className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-right text-sm ${
                    selectedPsId === ps.id ? 'border-coral bg-coral/5' : 'border-border'
                  }`}
                >
                  <div>
                    <p className="font-medium">{ps.service?.name || ps.serviceId}</p>
                    <p className="text-xs text-gray">
                      {ps.durationMin} دقیقه · {formatPrice(ps.price)}
                      {ps.isActive === false ? ' · غیرفعال' : ''}
                    </p>
                  </div>
                  <span className="text-xs text-coral">ویرایش</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {selectedPs && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">{selectedPs.service?.name}</h2>
              <p className="text-xs text-gray">شناسه: {selectedPs.id.slice(0, 8)}…</p>
            </div>
            <Button size="sm" variant="outline" loading={busy} onClick={() => onToggleActive(selectedPs)}>
              {selectedPs.isActive === false ? 'فعال‌سازی' : 'غیرفعال'}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-gray">قیمت (تومان)</span>
              <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-1" />
            </label>
            <label className="block text-sm">
              <span className="text-gray">مدت (دقیقه)</span>
              <Input type="number" min={5} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className="mt-1" />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-gray">توضیحات</span>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
            </label>
          </div>
          <Button loading={busy} onClick={onSaveSelected}>ذخیره قیمت و مدت</Button>

          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="font-medium">نمونه‌کار</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(selectedPs.mediaAssets || []).map((m) => (
                <div key={m.id} className="relative">
                  {isVideoMime(m.mimeType) ? (
                    <video src={resolveMediaUrl(m.publicUrl)} className="aspect-square w-full rounded-xl object-cover" controls playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveMediaUrl(m.publicUrl)} alt="" className="aspect-square w-full rounded-xl object-cover" />
                  )}
                  <button type="button" onClick={() => onDeleteMedia(m.id)} className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">
                    حذف
                  </button>
                </div>
              ))}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm hover:border-coral/40">
              <span>{busy ? 'در حال آپلود…' : '+ افزودن عکس یا ویدئو'}</span>
              <input
                type="file"
                accept="image/*,video/mp4,video/webm,video/quicktime"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadMedia(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="font-medium">افزودنی‌ها (Add-ons)</h3>
            <ul className="space-y-2">
              {(selectedPs.addOns || []).map((a: ServiceAddOnItem) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-gray">
                      {formatPrice(a.price)}
                      {a.extraDurationMin ? ` · +${a.extraDurationMin} دقیقه` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onDeactivateAddOn(a.id)}>غیرفعال</Button>
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="نام افزودنی" value={addOnName} onChange={(e) => setAddOnName(e.target.value)} />
              <Input type="number" min={0} placeholder="قیمت" value={addOnPrice} onChange={(e) => setAddOnPrice(Number(e.target.value))} />
              <Input type="number" min={0} placeholder="زمان اضافی (دقیقه)" value={addOnExtra} onChange={(e) => setAddOnExtra(Number(e.target.value))} />
              <Input placeholder="توضیح (اختیاری)" value={addOnDesc} onChange={(e) => setAddOnDesc(e.target.value)} />
            </div>
            <Button size="sm" variant="secondary" loading={busy} onClick={onAddOn} disabled={!addOnName.trim()}>
              + افزودن Add-on
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
