'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { RequireAuth } from '@/components/auth/require-auth';

export type PanelNavItem = { href: string; label: string };

type Props = { title: string; items: PanelNavItem[]; roles: string[]; children: ReactNode };

export function PanelShell({ title, items, roles, children }: Props) {
  const pathname = usePathname();
  return (
    <RequireAuth roles={roles}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-8 md:flex-row">
          <aside className="w-full shrink-0 md:w-56">
            <h2 className="mb-4 text-lg font-bold text-foreground">{title}</h2>
            <nav className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
              {items.map((item) => {
                const active = pathname === item.href || (item.href !== items[0]?.href && pathname.startsWith(item.href + '/'));
                return (
                  <Link key={item.href} href={item.href}
                    className={cn('whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition',
                      active ? 'bg-coral-soft text-coral' : 'text-gray hover:bg-gray-light')}>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}
