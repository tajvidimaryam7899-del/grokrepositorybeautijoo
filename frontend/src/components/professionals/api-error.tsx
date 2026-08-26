type Props = {
  message?: string;
};

export function ApiErrorState({
  message = 'دریافت اطلاعات از سرور ممکن نشد.',
}: Props) {
  return (
    <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-12 text-center">
      <p className="font-medium text-red-700">{message}</p>
      <p className="mt-2 text-sm text-red-600/80">
        اتصال به API را بررسی کنید و صفحه را مجدداً بارگذاری کنید.
      </p>
    </div>
  );
}
