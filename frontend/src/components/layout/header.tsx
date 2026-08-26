'use client';

import Link from 'next/link';
import { Search, Menu } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';

export function Header() {
  const { user, loading, logout, isAuthenticated, hasRole } = useAuth();
  const [open, setOpen] = useState(false);

  const displayName =
    user?.profile?.displayName || user?.phone || 'کاربر';

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="flex size-9 items-center justify-center rounded-xl bg-coral text-lg font-bold text-white">
            ب
          </span>
          <span className="text-lg font-bold text-foreground">Beautijoo</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-gray md:flex">
          <Link href="/professionals" className="hover:text-coral transition-colors">
            زیباگران
          </Link>
          <Link href="/search" className="hover:text-coral transition-colors">
            جستجو
          </Link>
          <Link href="/services" className="hover:text-coral transition-colors">
            خدمات
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/search"
            className="flex size-10 items-center justify-center rounded-xl text-gray hover:bg-gray-light md:hidden"
            aria-label="جستجو"
          >
            <Search className="size-5" />
          </Link>

          {!loading && isAuthenticated ? (
            <div className="hidden items-center gap-2 sm:flex">
              {hasRole('admin') && (
                <Link
                  href="/admin"
                  className="text-sm font-medium text-blue hover:underline"
                >
                  ادمین
                </Link>
              )}
              {hasRole('professional') && (
                <Link
                  href="/zibagar"
                  className="text-sm font-medium text-coral hover:underline"
                >
                  پنل زیباگر
                </Link>
              )}
              <Link
                href="/panel"
                className="rounded-2xl bg-gray-light px-3 py-2 text-sm font-medium text-foreground hover:bg-border"
              >
                {displayName}
              </Link>
              <Button variant="ghost" size="sm" onClick={() => logout()}>
                خروج
              </Button>
            </div>
          ) : (
            !loading && (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href="/login"
                  className="h-10 inline-flex items-center rounded-2xl px-4 text-sm font-medium text-foreground hover:bg-gray-light"
                >
                  ورود
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-10 items-center rounded-2xl bg-coral px-4 text-sm font-medium text-white hover:bg-[#e85a4c]"
                >
                  ثبت‌نام
                </Link>
              </div>
            )
          )}

          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-xl text-gray hover:bg-gray-light md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="منو"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-2 text-sm font-medium">
            <Link href="/professionals" onClick={() => setOpen(false)}>
              زیباگران
            </Link>
            <Link href="/search" onClick={() => setOpen(false)}>
              جستجو
            </Link>
            <Link href="/services" onClick={() => setOpen(false)}>
              خدمات
            </Link>
            {isAuthenticated ? (
              <>
                <Link href="/panel" onClick={() => setOpen(false)}>
                  پنل من
                </Link>
                {hasRole('professional') && (
                  <Link href="/zibagar" onClick={() => setOpen(false)}>
                    پنل زیباگر
                  </Link>
                )}
                {hasRole('admin') && (
                  <Link href="/admin" onClick={() => setOpen(false)}>
                    ادمین
                  </Link>
                )}
                <button
                  type="button"
                  className="text-right text-coral"
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
                <Link href="/login" onClick={() => setOpen(false)}>
                  ورود
                </Link>
                <Link href="/register" onClick={() => setOpen(false)}>
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
