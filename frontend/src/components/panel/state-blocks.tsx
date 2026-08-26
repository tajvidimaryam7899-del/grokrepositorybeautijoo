'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function PanelLoading({ label = 'در حال بارگذاری...' }: { label?: string }) {
  return <div className="flex min-h-[30vh] items-center justify-center text-sm text-gray">{label}</div>;
}

export function PanelError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-6 text-center">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>تلاش مجدد</Button>}
    </div>
  );
}

export function PanelEmpty({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-gray-light/40 px-4 py-12 text-center">
      <p className="font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-gray">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
