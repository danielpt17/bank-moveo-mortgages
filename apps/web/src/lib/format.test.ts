import { describe, expect, it } from 'vitest';
import { formatBillingDay, formatDate, formatMoney, formatPercent } from './format';

describe('format', () => {
  it('formats money with the shekel sign first and two decimals', () => {
    expect(formatMoney(1521.24)).toBe('₪1,521.24');
    expect(formatMoney(1100500)).toBe('₪1,100,500.00');
    expect(formatMoney(5.44)).toBe('₪5.44');
  });

  it('formats dates as dd.mm.yyyy', () => {
    expect(formatDate('2045-01-15')).toBe('15.01.2045');
  });

  it('formats percentages and billing days', () => {
    expect(formatPercent(5.75)).toBe('5.75%');
    expect(formatBillingDay(10)).toBe('10 בחודש');
  });
});
