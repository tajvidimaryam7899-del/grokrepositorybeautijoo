import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-gray-light">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-coral text-sm font-bold text-white">
              ب
            </span>
            <span className="font-bold">Beautijoo</span>
          </div>
          <p className="text-sm leading-6 text-gray">
            پلتفرم رزرو آنلاین خدمات زیبایی با زیباگران حرفه‌ای در سراسر ایران.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold">دسترسی سریع</h3>
          <ul className="space-y-2 text-sm text-gray">
            <li>
              <Link href="/professionals" className="hover:text-coral">
                زیباگران
              </Link>
            </li>
            <li>
              <Link href="/search" className="hover:text-coral">
                جستجو
              </Link>
            </li>
            <li>
              <Link href="/services" className="hover:text-coral">
                خدمات
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold">حساب کاربری</h3>
          <ul className="space-y-2 text-sm text-gray">
            <li>
              <Link href="/login" className="hover:text-coral">
                ورود
              </Link>
            </li>
            <li>
              <Link href="/register" className="hover:text-coral">
                ثبت‌نام
              </Link>
            </li>
            <li>
              <Link href="/panel" className="hover:text-coral">
                پنل مشتری
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-gray">
        © {new Date().getFullYear()} Beautijoo — همه حقوق محفوظ است
      </div>
    </footer>
  );
}
