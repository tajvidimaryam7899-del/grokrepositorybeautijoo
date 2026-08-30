import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/90 bg-white p-4 shadow-[0_1px_3px_rgba(31,41,55,0.04)] sm:rounded-3xl sm:p-6',
        className,
      )}
      {...props}
    />
  );
}
