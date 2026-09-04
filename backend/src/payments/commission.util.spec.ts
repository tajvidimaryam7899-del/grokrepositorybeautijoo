import {
  calculateCommissionSplit,
  isValidCommissionRate,
  DEFAULT_COMMISSION_RATE_PERCENT,
} from './commission.util';

describe('calculateCommissionSplit', () => {
  it('matches the brief example: 500,000 at 10%', () => {
    const { commissionAmount, professionalNetAmount } = calculateCommissionSplit(500_000, 10);
    expect(commissionAmount).toBe(50_000);
    expect(professionalNetAmount).toBe(450_000);
  });

  it('1000 at 10% is exact', () => {
    const { commissionAmount, professionalNetAmount } = calculateCommissionSplit(1000, 10);
    expect(commissionAmount).toBe(100);
    expect(professionalNetAmount).toBe(900);
  });

  it('1001 at 10% rounds to the nearest Toman and still sums to gross', () => {
    const { commissionAmount, professionalNetAmount } = calculateCommissionSplit(1001, 10);
    expect(commissionAmount).toBe(100); // 100.1 -> 100
    expect(commissionAmount + professionalNetAmount).toBe(1001);
  });

  it('never lets commission + net drift from gross, across many rates', () => {
    const gross = 137_777;
    for (let rate = 0; rate <= 100; rate += 1) {
      const { commissionAmount, professionalNetAmount } = calculateCommissionSplit(gross, rate);
      expect(commissionAmount + professionalNetAmount).toBe(gross);
    }
  });

  it('clamps a negative or out-of-range rate defensively', () => {
    expect(calculateCommissionSplit(1000, -5).commissionAmount).toBe(0);
    expect(calculateCommissionSplit(1000, 150).commissionAmount).toBe(1000);
  });

  it('default commission rate is 10%', () => {
    expect(DEFAULT_COMMISSION_RATE_PERCENT).toBe(10);
  });
});

describe('isValidCommissionRate', () => {
  it('accepts values within 0-100 with up to 2 decimals', () => {
    expect(isValidCommissionRate(0)).toBe(true);
    expect(isValidCommissionRate(10)).toBe(true);
    expect(isValidCommissionRate(12.5)).toBe(true);
    expect(isValidCommissionRate(12.34)).toBe(true);
    expect(isValidCommissionRate(100)).toBe(true);
  });

  it('rejects out-of-range or overly precise values', () => {
    expect(isValidCommissionRate(-1)).toBe(false);
    expect(isValidCommissionRate(100.01)).toBe(false);
    expect(isValidCommissionRate(12.345)).toBe(false);
    expect(isValidCommissionRate('10')).toBe(false);
    expect(isValidCommissionRate(NaN)).toBe(false);
  });
});
