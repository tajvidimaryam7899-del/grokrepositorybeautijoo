import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-4 text-4xl font-bold text-gray-dark">۴۰۴</h1>
      <p className="mb-6 text-lg text-gray">صفحه مورد نظر شما پیدا نشد.</p>
      <Link
        href="/"
        className="rounded-xl bg-coral px-6 py-2.5 font-medium text-white transition-colors hover:bg-coral-dark"
      >
        بازگشت به صفحه اصلی
      </Link>
    </div>
  );
}
