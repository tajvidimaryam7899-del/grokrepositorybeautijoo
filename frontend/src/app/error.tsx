'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="mb-4 text-2xl font-bold text-gray-dark">خطایی رخ داد!</h2>
      <p className="mb-6 text-sm text-gray">
        متأسفانه در پردازش درخواست شما مشکلی پیش آمد.
      </p>
      <button
        onClick={() => reset()}
        className="rounded-xl bg-coral px-6 py-2.5 font-medium text-white transition-colors hover:bg-coral-dark"
      >
        تلاش مجدد
      </button>
    </div>
  );
}
