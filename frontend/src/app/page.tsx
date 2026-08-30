import Link from 'next/link';
import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import {
  listCategories,
  searchProfessionals,
} from '@/lib/public-api';
import { ProfessionalCard } from '@/components/professionals/professional-card';
import { siteName } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `${siteName()} | رزرو آنلاین خدمات زیبایی` },
  description:
    'زیباگر مناسب خود را پیدا کنید — رزرو آنلاین آرایش، ناخن، پوست و خدمات زیبایی در سراسر ایران.',
};

export default async function HomePage() {
  let categories: Awaited<ReturnType<typeof listCategories>> = [];
  let featured: Awaited<ReturnType<typeof searchProfessionals>> | null = null;
  let loadError = false;

  try {
    const [cats, pros] = await Promise.all([
      listCategories(),
      searchProfessionals({ page: 1, limit: 6 }),
    ]);
    categories = cats;
    featured = pros;
  } catch {
    loadError = true;
  }

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-b from-coral-soft via-white to-blue-soft/40">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-blue-soft/50 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-medium tracking-wide text-blue sm:text-sm">
              رزرو آنلاین زیبایی
            </p>
            <h1 className="text-2xl font-bold leading-snug text-foreground sm:text-3xl sm:leading-tight md:text-5xl">
              زیباگر مناسب خود را پیدا کنید
            </h1>
            <p className="mt-3 text-sm leading-7 text-gray sm:mt-4 sm:text-base md:text-lg">
              رزرو آنلاین خدمات زیبایی — آرایش، ناخن، پوست و بیشتر، نزدیک شما
            </p>
            <form
              action="/search"
              method="get"
              className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:items-center sm:gap-3"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-gray-muted" />
                <input
                  name="q"
                  type="search"
                  placeholder="جستجوی خدمت یا زیباگر..."
                  className="h-12 w-full rounded-2xl border border-border bg-white pr-11 pl-4 text-sm shadow-sm outline-none transition-colors placeholder:text-gray-muted focus:border-blue focus:ring-2 focus:ring-blue/15"
                />
              </div>
              <button
                type="submit"
                className="h-12 shrink-0 rounded-2xl bg-coral px-8 text-sm font-medium text-white shadow-sm transition-colors hover:bg-coral-dark"
              >
                جستجو
              </button>
            </form>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
          <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
            <h2 className="text-lg font-bold text-foreground sm:text-xl">دسته‌بندی خدمات</h2>
            <Link
              href="/services"
              className="text-sm font-medium text-coral transition-colors hover:text-coral-dark"
            >
              همه خدمات
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 md:grid-cols-4">
            {categories.slice(0, 8).map((c) => (
              <Link
                key={c.id}
                href={`/categories/${c.slug}`}
                className="rounded-2xl border border-border/90 bg-white p-3.5 text-center shadow-[0_1px_2px_rgba(31,41,55,0.04)] transition-colors hover:border-blue/25 hover:bg-blue-soft/60 sm:p-4"
              >
                <span className="block text-sm font-medium text-foreground sm:text-base">
                  {c.name}
                </span>
                {c.services && (
                  <span className="mt-1 block text-xs text-gray-muted">
                    {c.services.length} خدمت
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
        <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
          <h2 className="text-lg font-bold text-foreground sm:text-xl">زیباگران برتر</h2>
          <Link
            href="/professionals"
            className="text-sm font-medium text-coral transition-colors hover:text-coral-dark"
          >
            مشاهده همه
          </Link>
        </div>
        {loadError && (
          <p className="rounded-2xl bg-gray-light px-4 py-6 text-center text-sm text-gray">
            در حال حاضر امکان بارگذاری لیست زیباگران نیست. بعداً تلاش کنید.
          </p>
        )}
        {!loadError && featured && featured.items.length === 0 && (
          <p className="text-center text-sm text-gray">
            هنوز زیباگر تأییدشده‌ای ثبت نشده است.
          </p>
        )}
        {featured && featured.items.length > 0 && (
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.items.map((pro) => (
              <ProfessionalCard key={pro.id} pro={pro} />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-border bg-gradient-to-b from-blue-soft/70 to-blue-light/50">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:py-14">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">
            آماده رزرو هستید؟
          </h2>
          <p className="mt-2 text-sm text-gray sm:text-base">
            زیباگر را انتخاب کنید، زمان آزاد را ببینید و نوبت بگیرید.
          </p>
          <div className="mt-6 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <Link
              href="/search"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-coral px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-coral-dark"
            >
              شروع جستجو
            </Link>
            <Link
              href="/register"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white px-6 text-sm font-medium text-foreground transition-colors hover:border-blue/25 hover:bg-blue-soft"
            >
              ثبت‌نام رایگان
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
