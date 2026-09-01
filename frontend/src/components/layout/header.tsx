'use client';

import Link from 'next/link';
import { Search, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';

export function Header() {
  const { user, loading, logout, isAuthenticated, hasRole } = useAuth();
  const [open, setOpen] = useState(false);

  const displayName =
    user?.profile?.displayName || user?.phone || 'کاربر';

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/95 backdrop-blur-md shadow-[0_1px_0_0_rgba(11,110,153,0.04)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-coral to-coral-dark text-base font-bold text-white shadow-sm sm:size-9 sm:text-lg">
            ب
          </span>
          <span className="text-base font-bold tracking-tight text-foreground sm:text-lg">
            Beautijoo
          </span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-medium text-gray md:flex">
          <Link
            href="/professionals"
            className="rounded-xl px-3 py-2 transition-colors hover:bg-blue-soft hover:text-blue"
          >
            زیباگران
          </Link>
          <Link
            href="/search"
            className="rounded-xl px-3 py-2 transition-colors hover:bg-blue-soft hover:text-blue"
          >
            جستجو
          </Link>
          <Link
            href="/services"
            className="rounded-xl px-3 py-2 transition-colors hover:bg-blue-soft hover:text-blue"
          >
            خدمات
          </Link>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/search"
            className="flex size-10 items-center justify-center rounded-xl text-gray transition-colors hover:bg-blue-soft hover:text-blue md:hidden"
            aria-label="جستجو"
          >
            <Search className="size-5" />
          </Link>

          {!loading && isAuthenticated ? (
            <div className="hidden items-center gap-2 sm:flex">
              {hasRole('admin') && (
                <Link
                  href="/admin"
                  className="rounded-xl px-2 py-1.5 text-sm font-medium text-blue hover:bg-blue-soft"
                >
                  ادمین
                </Link>
              )}
              {hasRole('professional') && (
                <Link
                  href="/zibagar"
                  className="rounded-xl px-2 py-1.5 text-sm font-medium text-coral hover:bg-coral-soft"
                >
                  پنل زیباگر
                </Link>
              )}
              {hasRole('customer') && (
                <Link
                  href="/panel"
                  className="rounded-2xl bg-gray-light px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-gray-mid"
                >
                  پنل مشتری
                </Link>
              )}
              {!hasRole('customer') && hasRole('professional') && (
                <Link
                  href="/zibagar"
                  className="rounded-2xl bg-gray-light px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-gray-mid"
                >
                  {displayName}
                </Link>
              )}
              {hasRole('customer') && !hasRole('professional') && (
                <span className="hidden text-sm text-gray sm:inline">{displayName}</span>
              )}
              <Button variant="ghost" size="sm" onClick={() => logout()}>
                خروج
              </Button>
            </div>
          ) : (
            !loading && (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href="/login"
                  className="inline-flex h-10 items-center rounded-2xl px-4 text-sm font-medium text-foreground transition-colors hover:bg-gray-light"
                >
                  ورود
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-10 items-center rounded-2xl bg-coral px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-coral-dark"
                >
                  ثبت‌نام
                </Link>
              </div>
            )
          )}

          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-xl text-gray transition-colors hover:bg-blue-soft hover:text-blue md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'بستن منو' : 'منو'}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1 text-sm font-medium">
            <Link
              href="/professionals"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3 text-foreground transition-colors hover:bg-blue-soft hover:text-blue"
            >
              زیباگران
            </Link>
            <Link
              href="/search"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3 text-foreground transition-colors hover:bg-blue-soft hover:text-blue"
            >
              جستجو
            </Link>
            <Link
              href="/services"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3 text-foreground transition-colors hover:bg-blue-soft hover:text-blue"
            >
              خدمات
            </Link>
            <div className="my-2 h-px bg-border" />
            {isAuthenticated ? (
              <>
                {hasRole('customer') && (
                <Link
                  href="/panel"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-foreground hover:bg-gray-light"
                >
                    پنل مشتری
                </Link>
                )}
                {hasRole('professional') && (
                  <Link
                    href="/zibagar"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-3 text-coral hover:bg-coral-soft"
                  >
                    پنل زیباگر
                  </Link>
                )}
                {hasRole('admin') && (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-3 text-blue hover:bg-blue-soft"
                  >
                    ادمین
                  </Link>
                )}
                <button
                  type="button"
                  className="rounded-xl px-3 py-3 text-right text-coral hover:bg-coral-soft"
                  onClick={() => {
                    setOpen(false);
                    logout();
                  }}
                >
                  خروج
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-foreground hover:bg-gray-light"
                >
                  ورود
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="mt-1 flex h-11 items-center justify-center rounded-2xl bg-coral text-center font-medium text-white shadow-sm hover:bg-coral-dark"
                >
                  ثبت‌نام
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
