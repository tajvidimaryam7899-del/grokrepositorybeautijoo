'use client';
import type { ReactNode } from 'react';
import { PanelShell } from '@/components/panel/panel-shell';
const ITEMS = [
  { href: '/admin', label: 'داشبورد' },
  { href: '/admin/users', label: 'کاربران' },
  { href: '/admin/professionals', label: 'زیباگرها' },
  { href: '/admin/service-categories', label: 'دسته‌بندی تخصص‌ها' },
  { href: '/admin/bookings', label: 'رزروها' },
  { href: '/admin/audit', label: 'لاگ‌های ممیزی' },
];
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <PanelShell title="پنل ادمین" items={ITEMS} roles={['admin']}>{children}</PanelShell>;
}
