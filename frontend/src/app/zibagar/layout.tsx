'use client';
import type { ReactNode } from 'react';
import { PanelShell } from '@/components/panel/panel-shell';
const ITEMS = [
  { href: '/zibagar', label: 'داشبورد' },
  { href: '/zibagar/bookings', label: 'رزروها' },
  { href: '/zibagar/services', label: 'تخصص‌ها' },
  { href: '/zibagar/profile', label: 'پروفایل' },
  { href: '/zibagar/hours', label: 'ساعات کاری' },
  { href: '/zibagar/locations', label: 'مکان‌ها' },
  { href: '/zibagar/notifications', label: 'اعلان‌ها' },
  { href: '/zibagar/settings', label: 'تنظیمات' },
];
export default function ZibagarLayout({ children }: { children: ReactNode }) {
  return <PanelShell title="پنل زیباگر" items={ITEMS} roles={['professional', 'admin']}>{children}</PanelShell>;
}
