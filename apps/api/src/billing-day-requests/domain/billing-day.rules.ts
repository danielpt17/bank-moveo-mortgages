/**
 * Pure business rules for billing-day change requests.
 *
 * Kept free of Nest and database concerns so they are trivial to unit test
 * and so the same numbers can be quoted to the UI before submission.
 */

export const ALLOWED_BILLING_DAYS = [1, 10, 15] as const;
export type AllowedBillingDay = (typeof ALLOWED_BILLING_DAYS)[number];

/** Fee charged per mortgage included in a request, in ILS. */
export const FEE_PER_MORTGAGE_ILS = 5.44;

/** Requests submitted on or before this day of the month take effect next month. */
export const CUTOFF_DAY_OF_MONTH = 23;

export function isAllowedBillingDay(day: number): day is AllowedBillingDay {
  return (ALLOWED_BILLING_DAYS as readonly number[]).includes(day);
}

/** Days the customer may pick for a mortgage: the allowed set minus its current day. */
export function selectableBillingDays(currentDay: number): AllowedBillingDay[] {
  return ALLOWED_BILLING_DAYS.filter((d) => d !== currentDay);
}

export type BillingDayValidation =
  | { ok: true }
  | { ok: false; reason: 'NOT_ALLOWED' | 'SAME_AS_CURRENT' };

export function validateNewBillingDay(currentDay: number, newDay: number): BillingDayValidation {
  if (!isAllowedBillingDay(newDay)) return { ok: false, reason: 'NOT_ALLOWED' };
  if (newDay === currentDay) return { ok: false, reason: 'SAME_AS_CURRENT' };
  return { ok: true };
}

/** Total fee for a request: a flat fee per mortgage, rounded to agorot. */
export function calculateTotalFee(mortgageCount: number, feePerMortgage = FEE_PER_MORTGAGE_ILS): number {
  if (!Number.isInteger(mortgageCount) || mortgageCount < 0) {
    throw new RangeError('mortgageCount must be a non-negative integer');
  }
  return Math.round(mortgageCount * feePerMortgage * 100) / 100;
}

export interface LocalDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/** Breaks an instant into calendar parts in the given IANA timezone. */
export function toLocalDateParts(instant: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(instant);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: pick('year'), month: pick('month'), day: pick('day') };
}

/**
 * First month in which the new billing day applies.
 *
 * Submitted on or before the 23rd (bank local time) → the following month.
 * Submitted after the 23rd → the month after that.
 * Returned as an ISO date string for the 1st of that month, e.g. "2026-12-01".
 */
export function calculateEffectiveFrom(submittedAt: Date, timeZone: string): string {
  const { year, month, day } = toLocalDateParts(submittedAt, timeZone);
  const monthsAhead = day <= CUTOFF_DAY_OF_MONTH ? 1 : 2;
  // Month arithmetic with Date.UTC handles the December → January rollover.
  const effective = new Date(Date.UTC(year, month - 1 + monthsAhead, 1));
  return effective.toISOString().slice(0, 10);
}
