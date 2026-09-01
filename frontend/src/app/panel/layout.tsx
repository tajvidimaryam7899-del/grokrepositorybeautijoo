'use client';
import type { ReactNode } from 'react';
import { PanelShell } from '@/components/panel/panel-shell';
const ITEMS = [
  { href: '/panel', label: '\u062f\u0627\u0634\u0628\u0648\u0631\u062f' },
  { href: '/panel/bookings', label: '\u0631\u0632\u0631\u0648\u0647\u0627\u06cc \u0645\u0646' },
  { href: '/panel/favorites', label: '\u0639\u0644\u0627\u0642\u0647\u200c\u0645\u0646\u062f\u06cc\u200c\u0647\u0627' },
  { href: '/panel/reviews', label: '\u0646\u0638\u0631\u0627\u062a' },
  { href: '/panel/notifications', label: '\u0627\u0639\u0644\u0627\u0646\u200c\u0647\u0627' },
  { href: '/panel/profile', label: '\u067e\u0631\u0648\u0641\u0627\u06cc\u0644' },
  { href: '/panel/settings', label: '\u062a\u0646\u0638\u06cc\u0645\u0627\u062a' },
];
export default function PanelLayout({ children }: { children: ReactNode }) {
  return <PanelShell title="\u067e\u0646\u0644 \u0645\u0634\u062a\u0631\u06cc" items={ITEMS} roles={['customer', 'admin']}>{children}</PanelShell>;
}
