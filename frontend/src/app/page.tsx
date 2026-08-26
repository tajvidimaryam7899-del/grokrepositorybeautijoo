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
      <section className="bg-gradient-to-b from-coral-soft to-white">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-bold leading-tight text-foreground md:text-5xl">
              زیباگر مناسب خود را پیدا کنید
            </h1>
            <p className="mt-4 text-base text-gray md:text-lg">
              رزرو آنلاین خدمات زیبایی — آرایش، ناخن، پوست و بیشتر، نزدیک شما
            </p>
            <form
              action="/search"
              method="get"
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-gray" />
                <input
                  name="q"
                  type="search"
                  placeholder="جستجوی خدمت یا زیباگر..."
                  className="h-12 w-full rounded-2xl border border-border bg-white pr-11 pl-4 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
                />
              </div>
              <button
                type="submit"
                className="h-12 shrink-0 rounded-2xl bg-coral px-8 text-sm font-medium text-white hover:bg-[#e85a4c]"
              >
                جستجو
              </button>
            </form>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="text-xl font-bold">دسته‌بندی خدمات</h2>
            <Link href="/services" className="text-sm font-medium text-coral hover:underline">
              همه خدمات
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {categories.slice(0, 8).map((c) => (
              <Link
                key={c.id}
                href={`/categories/${c.slug}`}
                className="rounded-2xl border border-border bg-white p-4 text-center shadow-sm transition hover:border-coral-light"
              >
                <span className="font-medium text-foreground">{c.name}</span>
                {c.services && (
                  <span className="mt-1 block text-xs text-gray">
                    {c.services.length} خدمت
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-xl font-bold">زیباگران برتر</h2>
          <Link
            href="/professionals"
            className="text-sm font-medium text-coral hover:underline"
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.items.map((pro) => (
              <ProfessionalCard key={pro.id} pro={pro} />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-border bg-blue-light/40">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="text-2xl font-bold text-foreground">
            آماده رزرو هستید؟
          </h2>
          <p className="mt-2 text-gray">
            زیباگر را انتخاب کنید، زمان آزاد را ببینید و نوبت بگیرید.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/search"
              className="inline-flex h-11 items-center rounded-2xl bg-coral px-6 text-sm font-medium text-white hover:bg-[#e85a4c]"
            >
              شروع جستجو
            </Link>
            <Link
              href="/register"
              className="inline-flex h-11 items-center rounded-2xl border border-border bg-white px-6 text-sm font-medium hover:bg-gray-light"
            >
              ثبت‌نام رایگان
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
