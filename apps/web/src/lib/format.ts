/** ₪1,521.24 – the design places the shekel sign before the number. */
export function formatMoney(amount: number): string {
  const formatted = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `₪${formatted}`;
}

export function formatPercent(rate: number): string {
  return `${rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/** 2045-01-15 → 15.01.2045 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

const two = (n: number) => String(n).padStart(2, '0');

/** ISO instant → 30/10/26, 14:21 (as in the design's confirmation screen) */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}, ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** ISO instant → 30.10.2026 (local date; the lobby's "updated at") */
export function formatLocalDate(iso: string): string {
  const d = new Date(iso);
  return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** ISO instant → 14:36 */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** "10 בחודש" */
export function formatBillingDay(day: number): string {
  return `${day} בחודש`;
}

export function fullName(parts: { firstName: string; lastName: string }): string {
  return `${parts.firstName} ${parts.lastName}`;
}
