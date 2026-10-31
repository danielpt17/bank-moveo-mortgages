import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from '../cache/cache.service';
import { LobbyRepository, MortgageRow } from './lobby.repository';
import { LobbyService, lobbyCacheKey, maskPhone } from './lobby.service';

const CUSTOMER = 'customer-1';

const row = (over: Partial<MortgageRow> = {}): MortgageRow => ({
  id: 'm1',
  property_id: 'p1',
  street: 'רבי יוחנן הלוי 23',
  city: 'ירושלים',
  mortgage_number: '2392345632',
  product_name: 'רכישת דירה',
  remaining_balance: '1000.00',
  early_repayment_fee: '10.50',
  monthly_payment: '100.00',
  interest_rate: '5.75',
  monthly_interest: '4.79',
  billing_day: 10,
  start_date: '2020-01-01',
  end_date: '2045-01-15',
  last_charge_date: null,
  last_charge_amount: null,
  next_charge_date: null,
  next_charge_amount: null,
  has_payment_delays: false,
  borrowers: ['אביגיל רוזנבלום'],
  pending_request_id: null,
  pending_reference_number: null,
  pending_new_billing_day: null,
  pending_effective_from: null,
  ...over,
});

function build(rows: MortgageRow[]) {
  const repo = {
    findCustomer: vi.fn(async () => [
      { id: CUSTOMER, account_number: '401-123456', first_name: 'אביגיל', last_name: 'רוזנבלום', phone: '0501234122' },
    ]),
    findActiveMortgages: vi.fn(async () => rows),
  };
  const store = new Map<string, unknown>();
  const cache = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => void store.set(key, value)),
    del: vi.fn(async (key: string) => void store.delete(key)),
  };
  const config = { get: vi.fn(() => 300) } as unknown as ConfigService;
  const service = new LobbyService(repo as unknown as LobbyRepository, cache as unknown as CacheService, config as never);
  return { service, repo, cache, store };
}

describe('LobbyService cache-aside', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build([row()]);
  });

  it('miss: builds the lobby from Postgres and writes it to Redis with the TTL', async () => {
    const lobby = await ctx.service.getLobby(CUSTOMER);
    expect(lobby.fromCache).toBe(false);
    expect(ctx.repo.findActiveMortgages).toHaveBeenCalledTimes(1);
    expect(ctx.cache.set).toHaveBeenCalledWith(lobbyCacheKey(CUSTOMER), expect.objectContaining({ fromCache: false }), 300);
  });

  it('hit: serves the cached copy and does not touch Postgres', async () => {
    await ctx.service.getLobby(CUSTOMER);
    const second = await ctx.service.getLobby(CUSTOMER);
    expect(second.fromCache).toBe(true);
    expect(ctx.repo.findActiveMortgages).toHaveBeenCalledTimes(1);
  });

  it('invalidate: deletes the customer key so the next read rebuilds', async () => {
    await ctx.service.getLobby(CUSTOMER);
    await ctx.service.invalidate(CUSTOMER);
    expect(ctx.cache.del).toHaveBeenCalledWith(lobbyCacheKey(CUSTOMER));
    const after = await ctx.service.getLobby(CUSTOMER);
    expect(after.fromCache).toBe(false);
    expect(ctx.repo.findActiveMortgages).toHaveBeenCalledTimes(2);
  });

  it('Redis down: the lobby is still served from Postgres (CacheService returns a miss)', async () => {
    ctx.cache.get.mockResolvedValue(null);
    ctx.cache.set.mockResolvedValue(undefined);
    const lobby = await ctx.service.getLobby(CUSTOMER);
    expect(lobby.fromCache).toBe(false);
    expect(lobby.properties).toHaveLength(1);
  });

  it('keys are per customer', () => {
    expect(lobbyCacheKey('a')).not.toBe(lobbyCacheKey('b'));
    expect(lobbyCacheKey('a')).toBe('lobby:v1:a');
  });
});

describe('LobbyService aggregation', () => {
  it('groups mortgages by property and sums remaining, fees and monthly payment', async () => {
    const ctx = build([
      row({ id: 'm1', property_id: 'p1', remaining_balance: '1000.00', early_repayment_fee: '10.00', monthly_payment: '100.00', end_date: '2040-01-01' }),
      row({ id: 'm2', property_id: 'p1', remaining_balance: '500.50', early_repayment_fee: '0.50', monthly_payment: '50.25', end_date: '2045-06-01' }),
      row({ id: 'm3', property_id: 'p2', street: 'זאב ז׳בוטינסקי 123', city: 'אשדוד', remaining_balance: '200.00', early_repayment_fee: '0', monthly_payment: '20.00', end_date: '2030-01-01' }),
    ]);
    const lobby = await ctx.service.getLobby(CUSTOMER);
    expect(lobby.properties.map((p) => p.mortgages.length)).toEqual([2, 1]);
    expect(lobby.properties[0].summary).toMatchObject({
      totalRemaining: 1500.5,
      totalRemainingWithFees: 1511,
      totalMonthlyPayment: 150.25,
      lastRepaymentDate: '2045-06-01',
      mortgageCount: 2,
    });
    expect(lobby.summary).toMatchObject({ totalRemaining: 1700.5, totalRemainingWithFees: 1711, mortgageCount: 3 });
  });

  it('exposes an open request on the mortgage so the UI can block it', async () => {
    const ctx = build([
      row({ pending_request_id: 'r1', pending_reference_number: '6565787', pending_new_billing_day: 1, pending_effective_from: '2026-12-01' }),
    ]);
    const lobby = await ctx.service.getLobby(CUSTOMER);
    expect(lobby.properties[0].mortgages[0].pendingBillingDayRequest).toEqual({
      id: 'r1',
      referenceNumber: '6565787',
      newBillingDay: 1,
      effectiveFrom: '2026-12-01',
    });
  });

  it('masks the phone number', () => {
    expect(maskPhone('0501234122')).toBe('050-****122');
    expect(maskPhone('050-1234122')).toBe('050-****122');
    expect(maskPhone('123')).toBe('****');
  });
});
