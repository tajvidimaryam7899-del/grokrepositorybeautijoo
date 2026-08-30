import { ApiError } from './api';

/** Map HTTP / backend messages to Persian UI copy */
export function friendlyApiError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 0:
        return err.message || 'ارتباط با سرور برقرار نشد.';
      case 401:
        return 'برای ادامه باید وارد حساب کاربری شوید.';
      case 403:
        return 'اجازه انجام این عملیات را ندارید.';
      case 404:
        return 'مورد درخواستی یافت نشد.';
      case 409:
        return err.message || 'تداخل زمانی — این بازه قبلاً رزرو شده است.';
      case 422:
        return err.message || 'اطلاعات ارسالی نامعتبر است.';
      case 429:
        return 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد تلاش کنید.';
      case 400:
        return err.message || 'درخواست نامعتبر است.';
      default:
        if (err.status >= 500) {
          return err.message && !/internal server error/i.test(err.message)
            ? err.message
            : 'خطای سرور. لطفاً بعداً دوباره تلاش کنید.';
        }
        return err.message || 'خطا در ارتباط با سرور';
    }
  }
  // Plain Error (legacy callers) — surface the message when it is user-facing Persian/text
  if (err instanceof Error && err.message && err.message.trim().length > 0) {
    const m = err.message.trim();
    if (/[\u0600-\u06FF]/.test(m) || m.length < 120) return m;
  }
  return 'خطای غیرمنتظره رخ داد. دوباره تلاش کنید.';
}
