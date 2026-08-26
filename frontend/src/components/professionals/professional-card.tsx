import Link from 'next/link';
import type { ProfessionalListItem } from '@/types/public';
import { cn } from '@/lib/utils';

type Props = {
  pro: ProfessionalListItem;
  className?: string;
};

export function ProfessionalCard({ pro, className }: Props) {
  const name = pro.user?.profile?.displayName || pro.title;
  const avatar = pro.user?.profile?.avatarUrl;
  const city = pro.locations?.[0]?.location?.city;
  const services =
    pro.professionalServices?.map((s) => s.service.name).filter(Boolean) || [];
  const rating =
    pro.ratingAvg != null ? Number(pro.ratingAvg).toFixed(1) : null;
  const count = pro.ratingCount ?? 0;

  return (
    <Link
      href={`/professionals/${pro.slug}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-sm transition hover:border-coral-light hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start gap-4 p-5">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-coral-soft text-lg font-bold text-coral">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={name}
              className="size-full object-cover"
            />
          ) : (
            (name || 'ز').charAt(0)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-bold text-foreground group-hover:text-coral">
              {name}
            </h3>
            {pro.isFeatured && (
              <span className="shrink-0 rounded-full bg-blue-light px-2 py-0.5 text-xs font-medium text-blue">
                ویژه
              </span>
            )}
          </div>
          {pro.title && pro.title !== name && (
            <p className="mt-0.5 truncate text-sm text-gray">{pro.title}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray">
            {rating && count > 0 && (
              <span>
                ★ {rating}{' '}
                <span className="text-gray/70">({count} نظر)</span>
              </span>
            )}
            {city && <span>{city}</span>}
          </div>
          {services.length > 0 && (
            <p className="mt-2 line-clamp-1 text-xs text-gray">
              {services.slice(0, 3).join(' · ')}
            </p>
          )}
        </div>
      </div>
      <div className="mt-auto border-t border-border px-5 py-3">
        <span className="text-sm font-medium text-coral group-hover:underline">
          مشاهده پروفایل و رزرو
        </span>
      </div>
    </Link>
  );
}
