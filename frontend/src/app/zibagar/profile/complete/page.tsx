'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import { CompletionBar } from '@/components/profile/completion-bar';
import { ProfileStepper, type WizardStep } from '@/components/profile/stepper';
import {
  fetchMyProfessional, updateMyProfessional, addMyLocation, setMyWorkingHours,
  publishMyProfessional,
  uploadMyMedia, fetchCategories, resolveMediaUrl,
  setMySelectedCategories,
  type CatalogCategory,
  type OwnProfessional, type ProfileCompletion,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { IRAN_PROVINCES, citiesOf, type IranCity } from '@/lib/geo/iran-provinces';
import LocationMapPicker, { type MapPosition } from '@/components/location/location-map-picker';

const STEPS: WizardStep[] = [
  { id: 'basic', label: 'اطلاعات پایه' },
  { id: 'contact', label: 'معرفی' },
  { id: 'media', label: 'تصاویر' },
  { id: 'location', label: 'موقعیت' },
  { id: 'services', label: 'تخصص‌ها' },
  { id: 'hours', label: 'ساعات کاری' },
  { id: 'review', label: 'بررسی نهایی' },
];

const WEEK_DAYS = [
  { value: 'saturday', label: 'شنبه' },
  { value: 'sunday', label: 'یکشنبه' },
  { value: 'monday', label: 'دوشنبه' },
  { value: 'tuesday', label: 'سه‌شنبه' },
  { value: 'wednesday', label: 'چهارشنبه' },
  { value: 'thursday', label: 'پنج‌شنبه' },
  { value: 'friday', label: 'جمعه' },
];

export default function ProfileCompletePage() {
  const { user, loading: authLoading, reload } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pro, setPro] = useState<OwnProfessional | null>(null);
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null);
  const [step, setStep] = useState(0);
  const resumeApplied = useRef(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locCity, setLocCity] = useState('');
  const [locProvince, setLocProvince] = useState('');
  const [locLat, setLocLat] = useState<number | null>(null);
  const [locLng, setLocLng] = useState<number | null>(null);
  const [citySearch, setCitySearch] = useState('');
  const [mapSelected, setMapSelected] = useState(false);
  const [cityOptions, setCityOptions] = useState<IranCity[]>([]);
  const [rootCategories, setRootCategories] = useState<CatalogCategory[]>([]);
  const [selectedRootIds, setSelectedRootIds] = useState<string[]>([]);
  const [hourDays, setHourDays] = useState<string[]>(['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday']);
  const [hourStart, setHourStart] = useState('10:00');
  const [hourEnd, setHourEnd] = useState('20:00');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchMyProfessional();
      setPro(data); setCompletion(data.completion || null);
      setTitle(data.title || '');
      setFirstName(data.user?.profile?.firstName || '');
      setLastName(data.user?.profile?.lastName || '');
      setBio(data.bio || data.user?.profile?.bio || '');
      setAvatarUrl(resolveMediaUrl(data.user?.profile?.avatarUrl || ''));
      setCoverImageUrl(resolveMediaUrl(data.coverImageUrl || ''));
      setLogoUrl(resolveMediaUrl((data as { logoUrl?: string }).logoUrl || ''));
      const primary = data.locations?.find((l) => l.isPrimary) || data.locations?.[0];
      if (primary) {
        setLocName(primary.location.name || '');
        setLocAddress(primary.location.address || '');
        setLocCity(primary.location.city || '');
        setLocProvince(primary.location.province || '');
        const lat = primary.location.latitude != null ? Number(primary.location.latitude) : null;
        const lng = primary.location.longitude != null ? Number(primary.location.longitude) : null;
        setLocLat(lat); setLocLng(lng);
        setMapSelected(lat != null && lng != null);
        if (primary.location.province) setCityOptions(citiesOf(primary.location.province));
      }
      if (!resumeApplied.current) {
        resumeApplied.current = true;
        const fields = data.completion?.fields || [];
        const order = ['title','firstName','lastName','bio','avatarOrCover','location','service','workingHours'];
        let resume = 0;
        for (let i = 0; i < order.length; i++) {
          const f = fields.find((x) => x.key === order[i]);
          if (f && !f.done) {
            if (i <= 2) resume = 0;
            else if (i === 3) resume = 1;
            else if (i === 4) resume = 2;
            else if (i === 5) resume = 3;
            else if (i === 6) resume = 4;
            else resume = 5;
            break;
          }
          if (i === order.length - 1 && data.completion?.complete) resume = 6;
        }
        setStep(resume);
      }
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading && user) load(); }, [authLoading, user, load]);
  useEffect(() => {
    if (step === 4) {
      fetchCategories()
        .then((cats) => {
          const roots = (cats || []).filter((c) => !c.parentId);
          setRootCategories(roots);
          try {
            const raw = localStorage.getItem('beautijoo_wizard_root_categories');
            if (raw) {
              const ids = JSON.parse(raw) as string[];
              if (Array.isArray(ids)) setSelectedRootIds(ids.filter((id) => roots.some((r) => r.id === id)));
            }
          } catch { /* ignore */ }
          if (pro?.professionalServices?.length) {
            const fromServices = new Set<string>();
            for (const ps of pro.professionalServices) {
              const cid = (ps as { service?: { category?: { id?: string } } }).service?.category?.id;
              if (cid) fromServices.add(cid);
            }
            const rootIds = new Set(roots.map((r) => r.id));
            const selected = [...fromServices].filter((id) => rootIds.has(id));
            if (selected.length) setSelectedRootIds((prev) => Array.from(new Set([...prev, ...selected])));
          }
        })
        .catch(() => setRootCategories([]));
    }
  }, [step, pro]);

  async function saveBasic() {
    setSaving(true); setError(null); setMsg(null);
    try {
      const data = await updateMyProfessional({
        title: title.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: [firstName, lastName].filter(Boolean).join(' ').trim() || undefined,
      });
      setPro(data); setCompletion(data.completion || null);
      setMsg('ذخیره شد');
      return true;
    } catch (e) {
      setError(friendlyApiError(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveContact() {
    setSaving(true); setError(null); setMsg(null);
    try {
      const data = await updateMyProfessional({ bio: bio.trim() });
      setPro(data); setCompletion(data.completion || null);
      setMsg('ذخیره شد');
      return true;
    } catch (e) {
      setError(friendlyApiError(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveMedia() {
    setSaving(true); setError(null); setMsg(null);
    try {
      await load();
      setMsg('تصاویر ثبت شد');
      return true;
    } catch (e) {
      setError(friendlyApiError(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveLocation() {
    setSaving(true); setError(null); setMsg(null);
    try {
      if (!locProvince.trim() || !locCity.trim()) {
        setError('استان و شهر الزامی است');
        return false;
      }
      await addMyLocation({
        name: locName.trim() || undefined,
        address: locAddress.trim() || undefined,
        city: locCity.trim(),
        province: locProvince.trim(),
        latitude: locLat ?? undefined,
        longitude: locLng ?? undefined,
        isPrimary: true,
      });
      await load();
      setMsg('موقعیت ذخیره شد');
      return true;
    } catch (e) {
      setError(friendlyApiError(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveService() {
    setSaving(true); setError(null); setMsg(null);
    try {
      if (!selectedRootIds.length) {
        setError('حداقل یک دسته خدمات انتخاب کنید');
        return false;
      }
      try {
        localStorage.setItem('beautijoo_wizard_root_categories', JSON.stringify(selectedRootIds));
      } catch { /* ignore */ }
      try {
        await setMySelectedCategories(selectedRootIds);
      } catch (e) {
        // non-blocking if backend field not yet migrated
        console.warn('selectedCategoryIds persist failed', e);
      }
      setMsg('دسته‌های انتخاب‌شده ذخیره شد. جزئیات قیمت و نمونه‌کار را در «تخصص‌ها» تکمیل کنید.');
      return true;
    } catch (e) {
      setError(friendlyApiError(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  function toggleRootCategory(id: string) {
    setSelectedRootIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function saveHours() {
    setSaving(true); setError(null); setMsg(null);
    try {
      if (!hourDays.length) {
        setError('حداقل یک روز کاری انتخاب کنید');
        return false;
      }
      for (const day of hourDays) {
        await setMyWorkingHours({ dayOfWeek: day, startTime: hourStart, endTime: hourEnd });
      }
      await load();
      setMsg('ساعات کاری ذخیره شد');
      return true;
    } catch (e) {
      setError(friendlyApiError(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function onNext() {
    let ok = true;
    if (step === 0) ok = await saveBasic();
    else if (step === 1) ok = await saveContact();
    else if (step === 2) ok = await saveMedia();
    else if (step === 3) ok = await saveLocation();
    else if (step === 4) ok = await saveService();
    else if (step === 5) ok = await saveHours();
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function onPublish() {
    setPublishing(true); setError(null);
    try {
      const data = await publishMyProfessional();
      setPro(data); setCompletion(data.completion || null);
      setConfirmPublish(false);
      setMsg('پروفایل منتشر شد');
      await reload();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setPublishing(false);
    }
  }

  function toggleHourDay(day: string) {
    setHourDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  }

  if (authLoading || loading) return <PanelLoading />;
  if (error && !pro) return <PanelError message={error} />;
  if (!user) return null;

  const percent = completion?.percent ?? 0;
  const isPublished = pro?.status === 'approved';

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-coral">تکمیل پروفایل</h1>
        <p className="mt-1 text-sm text-gray">اطلاعات هر مرحله بلافاصله در سرور ذخیره می‌شود</p>
      </div>
      <CompletionBar percent={percent} />
      <ProfileStepper steps={STEPS} current={step} />
      {msg && <p className="rounded-xl bg-blue/10 px-3 py-2 text-sm text-blue">{msg}</p>}
      {error && <p className="rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}

      {step === 0 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">اطلاعات پایه</h2>
          <label className="block space-y-1 text-sm">عنوان حرفه‌ای
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً میکاپ آرتیست" /></label>
          <label className="block space-y-1 text-sm">نام
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
          <label className="block space-y-1 text-sm">نام خانوادگی
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
        </Card>
      )}
      {step === 1 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">معرفی / بیو</h2>
          <label className="block space-y-1 text-sm">درباره شما (حداقل ۱۰ کاراکتر)
            <textarea className="w-full rounded-xl border border-border p-3 text-sm" rows={4}
              value={bio} onChange={(e) => setBio(e.target.value)} /></label>
        </Card>
      )}
      {step === 2 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">تصاویر پروفایل</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {([
              { kind: 'avatar' as const, label: 'آواتار', url: avatarUrl },
              { kind: 'cover' as const, label: 'کاور', url: coverImageUrl },
              { kind: 'logo' as const, label: 'لوگو', url: logoUrl },
            ] as const).map(({ kind, label, url }) => (
              <div key={kind} className="flex flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
                <div className="relative h-28 bg-gray-light">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={label} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray">بدون تصویر</div>
                  )}
                </div>
                <div className="flex items-center justify-between px-3 pb-3">
                  <span className="text-sm font-medium">{label}</span>
                  <label className="cursor-pointer rounded-lg bg-coral px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
                    {uploading === kind ? '...' : url ? 'تعویض' : 'آپلود'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={!!uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(kind); setError(null); setMsg(null);
                        try {
                          const asset = await uploadMyMedia(file, kind);
                          if (kind === 'avatar') setAvatarUrl(asset.publicUrl);
                          if (kind === 'cover') setCoverImageUrl(asset.publicUrl);
                          if (kind === 'logo') setLogoUrl(asset.publicUrl);
                          setMsg('تصویر آپلود شد');
                        } catch (err) {
                          setError(friendlyApiError(err));
                        } finally {
                          setUploading(null);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {step === 3 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">موقعیت محل فعالیت</h2>
          <p className="text-xs text-gray">استان و شهر الزامی است. موقعیت دقیق را روی نقشه انتخاب کنید.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">استان *
              <select className="w-full rounded-xl border border-border p-3 text-sm" value={locProvince}
                onChange={(e) => {
                  const name = e.target.value;
                  setLocProvince(name);
                  setCityOptions(citiesOf(name));
                  setLocCity('');
                  setCitySearch('');
                  setLocLat(null); setLocLng(null);
                  setMapSelected(false);
                }}>
                <option value="">انتخاب استان</option>
                {IRAN_PROVINCES.map((pr) => <option key={pr.name} value={pr.name}>{pr.name}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-sm">شهر *
              <input
                type="text"
                className="mb-1 w-full rounded-xl border border-border p-2 text-sm"
                placeholder="جستجوی شهر…"
                value={citySearch}
                disabled={!locProvince}
                onChange={(e) => setCitySearch(e.target.value)}
              />
              <select className="w-full rounded-xl border border-border p-3 text-sm" value={locCity}
                disabled={!locProvince}
                onChange={(e) => {
                  const name = e.target.value;
                  setLocCity(name);
                  const c = cityOptions.find((x) => x.name === name);
                  if (c) {
                    setLocLat(c.lat); setLocLng(c.lng);
                    setMapSelected(false);
                  }
                }}>
                <option value="">انتخاب شهر</option>
                {cityOptions
                  .filter((c) => !citySearch.trim() || c.name.includes(citySearch.trim()))
                  .map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-sm">آدرس (اختیاری)
            <Input value={locAddress} onChange={(e) => setLocAddress(e.target.value)} placeholder="خیابان، پلاک، …" /></label>
          <label className="block space-y-1 text-sm">نام محل (اختیاری)
            <Input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="سالن زیبایی …" /></label>

          {locCity && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">انتخاب موقعیت روی نقشه</p>
                {mapSelected && locLat != null && locLng != null && (
                  <span className="rounded-full bg-blue/10 px-2.5 py-0.5 text-xs font-medium text-blue">موقعیت انتخاب شد ✓</span>
                )}
              </div>
              <p className="text-[11px] text-gray">روی نقشه کلیک کنید یا نشانگر را جابه‌جا کنید. مختصات عددی نمایش داده نمی‌شود.</p>
              <LocationMapPicker
                position={locLat != null && locLng != null ? { lat: locLat, lng: locLng } : null}
                onPositionChange={(pos: MapPosition) => {
                  setLocLat(pos.lat);
                  setLocLng(pos.lng);
                  setMapSelected(true);
                }}
                height="280px"
              />
              {locLat != null && locLng != null && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <a className="rounded-lg bg-blue px-3 py-1.5 font-medium text-white"
                    href={`https://neshan.org/maps/@${locLat},${locLng},15.0z`}
                    target="_blank" rel="noreferrer">باز کردن در نشان</a>
                  <a className="rounded-lg border border-border bg-white px-3 py-1.5 font-medium text-blue"
                    href={`https://www.google.com/maps/search/?api=1&query=${locLat},${locLng}`}
                    target="_blank" rel="noreferrer">باز کردن در Google Maps</a>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
      {step === 4 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">دسته‌های خدمات شما</h2>
          <p className="text-xs text-gray">
            چند دسته اصلی را انتخاب کنید. قیمت، زمان و نمونه‌کار را بعداً در صفحه «خدمات من» تنظیم می‌کنید.
          </p>
          {!rootCategories.length ? (
            <p className="text-sm text-gray">در حال بارگذاری دسته‌ها…</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {rootCategories.map((c) => {
                const on = selectedRootIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleRootCategory(c.id)}
                    className={`rounded-2xl border px-4 py-3 text-right text-sm transition ${
                      on
                        ? 'border-coral bg-coral text-white'
                        : 'border-border bg-white text-foreground hover:border-coral/40'
                    }`}
                  >
                    <span className="font-medium">{on ? '✓ ' : ''}{c.name}</span>
                  </button>
                );
              })}
            </div>
          )}
          {selectedRootIds.length > 0 && (
            <p className="text-xs text-blue-dark">{selectedRootIds.length} دسته انتخاب شده</p>
          )}
        </Card>
      )}
      {step === 5 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">ساعات کاری</h2>
          <div className="flex flex-wrap gap-2">
            {WEEK_DAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleHourDay(d.value)}
                className={`rounded-full px-3 py-1.5 text-sm border ${
                  hourDays.includes(d.value)
                    ? 'border-coral bg-coral text-white'
                    : 'border-border bg-white text-gray'
                }`}
              >{d.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm">ساعت شروع
              <Input type="time" value={hourStart} onChange={(e) => setHourStart(e.target.value)} /></label>
            <label className="block space-y-1 text-sm">ساعت پایان
              <Input type="time" value={hourEnd} onChange={(e) => setHourEnd(e.target.value)} /></label>
          </div>
        </Card>
      )}
      {step === 6 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">بررسی نهایی</h2>
          <CompletionBar percent={percent} />
          {completion?.fields && (
            <ul className="space-y-1 text-sm">
              {completion.fields.map((f) => (
                <li key={f.key} className="flex items-center justify-between rounded-xl bg-gray-light px-3 py-2">
                  <span>{f.label}</span>
                  <span className={f.done ? 'text-blue' : 'text-coral'}>{f.done ? '✓' : 'ناقص'}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href="/zibagar/profile/preview"><Button variant="secondary" size="sm">مشاهده پیش‌نمایش</Button></Link>
            {percent === 100 && !isPublished && (
              <Button size="sm" onClick={() => setConfirmPublish(true)}>انتشار پروفایل</Button>
            )}
            {isPublished && pro?.slug && (
              <Link href={`/professionals/${pro.slug}`}><Button size="sm">مشاهده صفحه عمومی</Button></Link>
            )}
          </div>
        </Card>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" disabled={step === 0 || saving}
          onClick={() => { setError(null); setStep((s) => Math.max(0, s - 1)); }}>قبلی</Button>
        <div className="flex gap-2">
          <Link href="/zibagar"><Button variant="ghost" size="sm">ذخیره و خروج</Button></Link>
          {step < STEPS.length - 1 && <Button size="sm" loading={saving} onClick={onNext}>بعدی</Button>}
        </div>
      </div>
      {confirmPublish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-w-md space-y-4">
            <h3 className="text-lg font-bold">تأیید انتشار</h3>
            <p className="text-sm text-gray">
              پروفایل شما آماده انتشار است. با تأیید، اطلاعات پروفایل برای کاربران عمومی سایت قابل مشاهده خواهد بود.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmPublish(false)}>انصراف</Button>
              <Button size="sm" loading={publishing} onClick={onPublish}>تأیید و انتشار</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
