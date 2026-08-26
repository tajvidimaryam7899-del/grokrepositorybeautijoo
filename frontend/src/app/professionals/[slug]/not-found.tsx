import Link from 'next/link';

export default function ProfessionalNotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">زیباگر یافت نشد</h1>
      <p className="mt-2 text-sm text-gray">
        این پروفایل وجود ندارد یا هنوز تأیید نشده است.
      </p>
      <Link
        href="/professionals"
        className="mt-6 inline-flex h-11 items-center rounded-2xl bg-coral px-6 text-sm font-medium text-white"
      >
        بازگشت به لیست زیباگران
      </Link>
    </div>
  );
}
