import Link from 'next/link';
import { Search } from 'lucide-react';

export default function HomePage() {
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

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/professionals"
            className="rounded-3xl border border-border bg-white p-6 shadow-sm transition hover:border-coral-light"
          >
            <h2 className="text-lg font-bold">زیباگران</h2>
            <p className="mt-2 text-sm text-gray">مشاهده لیست زیباگران تأییدشده</p>
          </Link>
          <Link
            href="/search"
            className="rounded-3xl border border-border bg-white p-6 shadow-sm transition hover:border-coral-light"
          >
            <h2 className="text-lg font-bold">جستجو و فیلتر</h2>
            <p className="mt-2 text-sm text-gray">خدمت، شهر، قیمت و امتیاز</p>
          </Link>
          <Link
            href="/register"
            className="rounded-3xl border border-border bg-blue-light p-6 shadow-sm transition hover:border-blue"
          >
            <h2 className="text-lg font-bold text-blue">ثبت‌نام رایگان</h2>
            <p className="mt-2 text-sm text-gray">شروع رزرو در چند دقیقه</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
