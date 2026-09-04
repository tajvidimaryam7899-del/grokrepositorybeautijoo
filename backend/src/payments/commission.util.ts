/**
 * Pure, dependency-free commission math for Beautijoo payments.
 * No DB access here on purpose — keeps this testable and auditable
 * in isolation from PaymentsService.
 */

/** Used only when no `platform_commission_rate` PlatformSetting row exists yet. */
export const DEFAULT_COMMISSION_RATE_PERCENT = 10;

export const PLATFORM_COMMISSION_RATE_KEY = 'platform_commission_rate';

/**
 * Splits a gross Toman amount into platform commission + professional net.
 *
 * Rounding policy (deterministic, applied everywhere — frontend must never
 * recompute this): the commission amount is rounded to the nearest whole
 * Toman with standard round-half-up (`Math.round`), then the professional's
 * net is derived by subtracting the rounded commission from the gross.
 * This guarantees `commissionAmount + professionalNetAmount === grossAmount`
 * exactly, with no rounding drift ever appearing or disappearing money.
 */
export function calculateCommissionSplit(
  grossAmount: number,
  ratePercent: number,
): { commissionAmount: number; professionalNetAmount: number } {
  const safeGross = Number.isFinite(grossAmount) ? Math.max(0, Math.trunc(grossAmount)) : 0;
  const safeRate = Number.isFinite(ratePercent) ? Math.min(100, Math.max(0, ratePercent)) : 0;
  const commissionAmount = Math.round((safeGross * safeRate) / 100);
  const professionalNetAmount = safeGross - commissionAmount;
  return { commissionAmount, professionalNetAmount };
}

/** Validates a commission rate input: 0–100, at most 2 decimal places. */
export function isValidCommissionRate(rate: unknown): rate is number {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return false;
  if (rate < 0 || rate > 100) return false;
  // at most 2 decimal places
  return Math.round(rate * 100) === rate * 100;
}
