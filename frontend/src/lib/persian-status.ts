export function persianBookingStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'در انتظار تأیید', CONFIRMED: 'تأیید شده', REJECTED: 'رد شده',
    CANCELLED: 'لغو شده', COMPLETED: 'انجام شده', NO_SHOW: 'عدم حضور',
  };
  return map[status] || status;
}
export function persianProfessionalStatus(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'پیش‌نویس', PENDING_REVIEW: 'در انتظار بررسی', ACTIVE: 'فعال',
    SUSPENDED: 'معلق', REJECTED: 'رد شده',
  };
  return map[status] || status;
}
export const WEEKDAY_FA: Record<string, string> = {
  SUNDAY: 'یکشنبه', MONDAY: 'دوشنبه', TUESDAY: 'سه‌شنبه', WEDNESDAY: 'چهارشنبه',
  THURSDAY: 'پنجشنبه', FRIDAY: 'جمعه', SATURDAY: 'شنبه',
};
