import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-gray-light">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:py-12">
        <div className="sm:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-coral to-coral-dark text-sm font-bold text-white shadow-sm">
              ب
            </span>
            <span className="font-bold text-foreground">Beautijoo</span>
          </div>
          <p className="text-sm leading-7 text-gray">
            پلتفرم رزرو آنلاین خدمات زیبایی با زیباگران حرفه‌ای در سراسر ایران.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-foreground">دسترسی سریع</h3>
          <ul className="space-y-2.5 text-sm text-gray">
            <li>
              <Link href="/professionals" className="transition-colors hover:text-blue">
                زیباگران
              </Link>
            </li>
            <li>
              <Link href="/search" className="transition-colors hover:text-blue">
                جستجو
              </Link>
            </li>
            <li>
              <Link href="/services" className="transition-colors hover:text-blue">
                خدمات
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-foreground">حساب کاربری</h3>
          <ul className="space-y-2.5 text-sm text-gray">
            <li>
              <Link href="/login" className="transition-colors hover:text-blue">
                ورود
              </Link>
            </li>
            <li>
              <Link href="/register" className="transition-colors hover:text-blue">
                ثبت‌نام
              </Link>
            </li>
            <li>
              <Link href="/panel" className="transition-colors hover:text-blue">
                پنل مشتری
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/80 bg-white/60 py-4 text-center text-xs text-gray-muted">
        © {new Date().getFullYear()} Beautijoo — همه حقوق محفوظ است
      </div>
    </footer>
  );
}
