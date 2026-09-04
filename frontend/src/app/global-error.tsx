'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className="flex min-h-screen flex-col items-center justify-center p-4 text-center antialiased">
        <h2 className="mb-4 text-2xl font-bold text-gray-800">خطای سرور</h2>
        <p className="mb-6 text-sm text-gray-600">
          متأسفانه در بارگذاری سیستم مشکلی رخ داده است.
        </p>
        <button
          onClick={() => reset()}
          className="rounded-xl bg-[#E06D53] px-6 py-2.5 font-medium text-white transition-colors"
        >
          تلاش مجدد
        </button>
      </body>
    </html>
  );
}
