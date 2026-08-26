type Props = {
  title?: string;
  description?: string;
};

export function EmptyState({
  title = 'موردی یافت نشد',
  description = 'فیلترها را تغییر دهید یا بعداً دوباره تلاش کنید.',
}: Props) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-gray-light/50 px-6 py-16 text-center">
      <p className="text-lg font-bold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-gray">{description}</p>
    </div>
  );
}
