import { describe, expect, it } from 'vitest';
import {
  calculateEffectiveFrom,
  calculateTotalFee,
  FEE_PER_MORTGAGE_ILS,
  isAllowedBillingDay,
  selectableBillingDays,
  validateNewBillingDay,
} from './billing-day.rules';

const TZ = 'Asia/Jerusalem';

describe('allowed billing days', () => {
  it('accepts only 1, 10 and 15', () => {
    expect(isAllowedBillingDay(1)).toBe(true);
    expect(isAllowedBillingDay(10)).toBe(true);
    expect(isAllowedBillingDay(15)).toBe(true);
    expect(isAllowedBillingDay(5)).toBe(false);
    expect(isAllowedBillingDay(0)).toBe(false);
    expect(isAllowedBillingDay(31)).toBe(false);
  });

  it('excludes the mortgage’s current day from the selectable set', () => {
    expect(selectableBillingDays(10)).toEqual([1, 15]);
    expect(selectableBillingDays(1)).toEqual([10, 15]);
    expect(selectableBillingDays(15)).toEqual([1, 10]);
  });

  it('offers all three days when the current day is not one of them', () => {
    expect(selectableBillingDays(12)).toEqual([1, 10, 15]);
  });

  it('rejects a day that is not allowed', () => {
    expect(validateNewBillingDay(10, 20)).toEqual({ ok: false, reason: 'NOT_ALLOWED' });
  });

  it('rejects the current day', () => {
    expect(validateNewBillingDay(10, 10)).toEqual({ ok: false, reason: 'SAME_AS_CURRENT' });
  });

  it('accepts a different allowed day', () => {
    expect(validateNewBillingDay(10, 15)).toEqual({ ok: true });
  });
});

describe('fee', () => {
  it('charges ₪5.44 per mortgage', () => {
    expect(FEE_PER_MORTGAGE_ILS).toBe(5.44);
    expect(calculateTotalFee(1)).toBe(5.44);
    expect(calculateTotalFee(3)).toBe(16.32);
  });

  it('rounds to agorot', () => {
    expect(calculateTotalFee(7)).toBe(38.08);
  });

  it('is zero for an empty request', () => {
    expect(calculateTotalFee(0)).toBe(0);
  });

  it('rejects a negative or fractional count', () => {
    expect(() => calculateTotalFee(-1)).toThrow(RangeError);
    expect(() => calculateTotalFee(1.5)).toThrow(RangeError);
  });
});

describe('effective month', () => {
  it('takes effect next month when submitted on the 23rd', () => {
    expect(calculateEffectiveFrom(new Date('2026-10-23T12:00:00+03:00'), TZ)).toBe('2026-11-01');
  });

  it('takes effect the month after next when submitted on the 24th', () => {
    expect(calculateEffectiveFrom(new Date('2026-10-24T00:00:01+03:00'), TZ)).toBe('2026-12-01');
  });

  it('uses bank local time, not UTC, at the cutoff boundary', () => {
    // 23:30 UTC on the 23rd is already 01:30 on the 24th in Israel (UTC+2 in November).
    expect(calculateEffectiveFrom(new Date('2026-11-23T23:30:00Z'), TZ)).toBe('2027-01-01');
    // …but still the 23rd in UTC, so a UTC-based rule would say December.
    expect(calculateEffectiveFrom(new Date('2026-11-23T23:30:00Z'), 'UTC')).toBe('2026-12-01');
  });

  it('rolls over the year correctly', () => {
    expect(calculateEffectiveFrom(new Date('2026-12-10T10:00:00+02:00'), TZ)).toBe('2027-01-01');
    expect(calculateEffectiveFrom(new Date('2026-12-28T10:00:00+02:00'), TZ)).toBe('2027-02-01');
  });

  it('handles the 1st of the month', () => {
    expect(calculateEffectiveFrom(new Date('2026-03-01T08:00:00+02:00'), TZ)).toBe('2026-04-01');
  });
});
