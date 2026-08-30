'use client';
import { cn } from '@/lib/utils';
export function CompletionBar({ percent, className }: { percent: number; className?: string }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray">درصد تکمیل پروفایل</span>
        <span className="font-semibold text-blue" dir="ltr">{p}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-mid">
        <div
          className="h-full rounded-full bg-gradient-to-l from-coral to-coral-dark"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}
