'use client';
import { cn } from '@/lib/utils';
export type WizardStep = { id: string; label: string };
export function ProfileStepper({ steps, current }: { steps: WizardStep[]; current: number }) {
  return (
    <div className="overflow-x-auto pb-1">
      <ol className="flex min-w-max items-center gap-1 sm:gap-2">
        {steps.map((step, i) => {
          const active = i === current;
          const done = i < current;
          return (
            <li key={step.id} className="flex items-center gap-1 sm:gap-2">
              {i > 0 && <span className={cn('mx-0.5 h-px w-4 sm:w-8', done || active ? 'bg-coral' : 'bg-border')} />}
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:text-sm',
                active && 'bg-coral text-white',
                done && !active && 'bg-coral-soft text-coral',
                !active && !done && 'bg-gray-light text-gray',
              )}>
                <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px]', active ? 'bg-white/20' : done ? 'bg-coral/10' : 'bg-white')} dir="ltr">
                  {done ? '✓' : i + 1}
                </span>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
