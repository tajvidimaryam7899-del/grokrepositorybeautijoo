/**
 * Minimal Jalali (Persian) calendar helpers — no external dependency.
 * Algorithm based on well-known civil conversion (compatible with Iran calendar).
 */

const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

const PERSIAN_WEEKDAYS = [
  'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه',
];

/** Gregorian → Jalali */
export function toJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

/** Jalali → Gregorian */
export function toGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  let gy = jy <= 979 ? 621 : 1600;
  jy -= jy <= 979 ? 0 : 979;
  const days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  let d = days % 146097;
  if (d > 36524) {
    gy += 100 * Math.floor(--d / 36524);
    d %= 36524;
    if (d >= 365) d++;
  }
  gy += 4 * Math.floor(d / 1461);
  d %= 1461;
  if (d > 365) {
    gy += Math.floor((d - 1) / 365);
    d = (d - 1) % 365;
  }
  const gd = d + 1;
  const sal_a = [
    0, 31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ];
  let gm = 0;
  let v = gd;
  for (let i = 1; i <= 12; i++) {
    const v2 = v - sal_a[i];
    if (v2 <= 0) {
      gm = i;
      break;
    }
    v = v2;
  }
  return { gy, gm, gd: v };
}

export function jalaliMonthName(jm: number): string {
  return PERSIAN_MONTHS[jm - 1] || '';
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** YYYY-MM-DD (Gregorian) */
export function toIsoDate(gy: number, gm: number, gd: number): string {
  return `${gy}-${pad2(gm)}-${pad2(gd)}`;
}

export function fromIsoDate(iso: string): { gy: number; gm: number; gd: number } {
  const [gy, gm, gd] = iso.split('-').map(Number);
  return { gy, gm, gd };
}

export function isoToJalaliLabel(iso: string): string {
  const { gy, gm, gd } = fromIsoDate(iso);
  const { jy, jm, jd } = toJalali(gy, gm, gd);
  return `${jy}/${pad2(jm)}/${pad2(jd)}`;
}

/** 0 = Saturday … 6 = Friday (Persian week) */
export function persianWeekdayIndex(gy: number, gm: number, gd: number): number {
  const utc = Date.UTC(gy, gm - 1, gd);
  const jsDay = new Date(utc).getUTCDay();
  return (jsDay + 1) % 7;
}

export function persianWeekdayName(gy: number, gm: number, gd: number): string {
  return PERSIAN_WEEKDAYS[persianWeekdayIndex(gy, gm, gd)];
}

export const DAY_OF_WEEK_VALUES = [
  'saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
] as const;

export type DayOfWeekValue = (typeof DAY_OF_WEEK_VALUES)[number];

export function dayOfWeekFromIso(iso: string): DayOfWeekValue {
  const { gy, gm, gd } = fromIsoDate(iso);
  return DAY_OF_WEEK_VALUES[persianWeekdayIndex(gy, gm, gd)];
}

export function todayIsoTehran(): string {
  const now = new Date();
  const tehran = new Date(now.getTime() + 3.5 * 60 * 60 * 1000);
  const y = tehran.getUTCFullYear();
  const m = tehran.getUTCMonth() + 1;
  const d = tehran.getUTCDate();
  return toIsoDate(y, m, d);
}

export function daysInJalaliMonth(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  const r = jy % 33;
  const leaps = [1, 5, 9, 13, 17, 22, 26, 30];
  return leaps.includes(r) ? 30 : 29;
}

export function buildJalaliMonthGrid(jy: number, jm: number): Array<{
  jy: number; jm: number; jd: number; iso: string; inMonth: boolean;
}> {
  const { gy, gm, gd } = toGregorian(jy, jm, 1);
  const startWeekIdx = persianWeekdayIndex(gy, gm, gd);
  const dim = daysInJalaliMonth(jy, jm);
  const cells: Array<{ jy: number; jm: number; jd: number; iso: string; inMonth: boolean }> = [];
  const prevJm = jm === 1 ? 12 : jm - 1;
  const prevJy = jm === 1 ? jy - 1 : jy;
  const prevDim = daysInJalaliMonth(prevJy, prevJm);
  for (let i = startWeekIdx - 1; i >= 0; i--) {
    const jd = prevDim - i;
    const g = toGregorian(prevJy, prevJm, jd);
    cells.push({ jy: prevJy, jm: prevJm, jd, iso: toIsoDate(g.gy, g.gm, g.gd), inMonth: false });
  }
  for (let jd = 1; jd <= dim; jd++) {
    const g = toGregorian(jy, jm, jd);
    cells.push({ jy, jm, jd, iso: toIsoDate(g.gy, g.gm, g.gd), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    let njy = last.jy;
    let njm = last.jm;
    let njd = last.jd + 1;
    if (njd > daysInJalaliMonth(njy, njm)) {
      njd = 1;
      njm += 1;
      if (njm > 12) { njm = 1; njy += 1; }
    }
    const g = toGregorian(njy, njm, njd);
    cells.push({ jy: njy, jm: njm, jd: njd, iso: toIsoDate(g.gy, g.gm, g.gd), inMonth: false });
  }
  return cells;
}

export function addJalaliMonths(jy: number, jm: number, delta: number): { jy: number; jm: number } {
  let m = jm + delta;
  let y = jy;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return { jy: y, jm: m };
}

export { PERSIAN_MONTHS, PERSIAN_WEEKDAYS };
