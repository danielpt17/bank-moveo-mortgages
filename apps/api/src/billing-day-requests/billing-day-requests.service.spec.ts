import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseError } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LobbyService } from '../lobby/lobby.service';
import { BillingDayRequestsRepository, OwnedMortgageRow, RequestRow } from './billing-day-requests.repository';
import { BillingDayRequestsService } from './billing-day-requests.service';

/**
 * The service enforces the brief's rules on top of the repository: ownership, allowed day,
 * one open request, idempotent replay and cache invalidation. The repository is faked here;
 * the SQL and the constraints behind it are covered by the integration test.
 */
const CUSTOMER = 'customer-1';
const M1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const M2 = 'aaaaaaaa-0000-4000-8000-000000000002';

const owned = (id: string, billingDay: number, hasPending = false): OwnedMortgageRow => ({
  id,
  mortgage_number: '2392345632',
  product_name: 'רכישת דירה',
  billing_day: billingDay,
  interest_rate: '5.75',
  monthly_interest: '173.98',
  street: 'רבי יוחנן הלוי 23',
  city: 'ירושלים',
  borrowers: ['אביגיל רוזנבלום'],
  has_pending_request: hasPending,
});

const requestRow = (over: Partial<RequestRow> = {}): RequestRow => ({
  id: 'req-1',
  customer_id: CUSTOMER,
  reference_number: '6565787',
  status: 'pending',
  submitted_at: new Date('2026-10-31T09:00:00Z'),
  effective_from: '2026-12-01',
  fee_per_mortgage: '5.44',
  total_fee: '5.44',
  notify_phone: '0501234122',
  ...over,
});

const uniqueViolation = (constraint: string): DatabaseError => {
  const err = new DatabaseError('duplicate key', 0, 'error');
  err.code = '23505';
  err.constraint = constraint;
  return err;
};

function build(mortgages: OwnedMortgageRow[]) {
  const repo = {
    // ownership is a join in SQL: the fake returns only the rows whose id is both owned and requested
    findOwnedMortgages: vi.fn(async (_c: string, ids: string[]) => mortgages.filter((m) => ids.includes(m.id))),
    findByIdempotencyKey: vi.fn(async () => [] as RequestRow[]),
    findCustomerPhone: vi.fn(async () => [{ phone: '0501234122' }]),
    insert: vi.fn(async () => requestRow()),
    // the stored items of the (replayed) request: mortgage M1 → day 1
    findItems: vi.fn(async () => [
      {
        mortgage_id: M1,
        mortgage_number: '2392345632',
        product_name: 'רכישת דירה',
        borrowers: ['אביגיל רוזנבלום'],
        interest_rate: '5.75',
        monthly_interest: '173.98',
        street: 'רבי יוחנן הלוי 23',
        city: 'ירושלים',
        previous_billing_day: 10,
        new_billing_day: 1,
        fee: '5.44',
      },
    ]),
    findById: vi.fn(async () => [] as RequestRow[]),
  };
  const lobby = { invalidate: vi.fn(async () => undefined) };
  const config = { get: vi.fn(() => 'Asia/Jerusalem') } as unknown as ConfigService;
  const service = new BillingDayRequestsService(
    repo as unknown as BillingDayRequestsRepository,
    lobby as unknown as LobbyService,
    config as never,
  );
  service.now = () => new Date('2026-10-31T09:00:00Z'); // after the 23rd → takes effect in December
  return { service, repo, lobby };
}

describe('BillingDayRequestsService', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build([owned(M1, 10), owned(M2, 1)]);
  });

  describe('preview', () => {
    it('quotes the fee per mortgage, the total and the effective month', async () => {
      const quote = await ctx.service.preview(CUSTOMER, [
        { mortgageId: M1, newBillingDay: 1 },
        { mortgageId: M2, newBillingDay: 15 },
      ]);
      expect(quote).toMatchObject({ feePerMortgage: 5.44, totalFee: 10.88, effectiveFrom: '2026-12-01' });
      expect(quote.items).toEqual([
        { mortgageId: M1, previousBillingDay: 10, newBillingDay: 1, fee: 5.44 },
        { mortgageId: M2, previousBillingDay: 1, newBillingDay: 15, fee: 5.44 },
      ]);
      expect(ctx.repo.insert).not.toHaveBeenCalled();
    });

    it('rejects a mortgage the customer does not own with 403 (same answer as "does not exist")', async () => {
      await expect(ctx.service.preview(CUSTOMER, [{ mortgageId: 'someone-elses', newBillingDay: 1 }])).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects the mortgage’s current billing day with 422', async () => {
      await expect(ctx.service.preview(CUSTOMER, [{ mortgageId: M1, newBillingDay: 10 }])).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('rejects a mortgage that already has an open request with 409', async () => {
      ctx = build([owned(M1, 10, true)]);
      await expect(ctx.service.preview(CUSTOMER, [{ mortgageId: M1, newBillingDay: 1 }])).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('create', () => {
    const items = [{ mortgageId: M1, newBillingDay: 1 as const }];

    it('persists the snapshot (previous day, fee, effective month) and invalidates the lobby cache', async () => {
      const { request, created } = await ctx.service.create(CUSTOMER, 'key-1', { items });
      expect(created).toBe(true);
      expect(request.replayed).toBe(false);
      expect(ctx.repo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: CUSTOMER,
          idempotencyKey: 'key-1',
          effectiveFrom: '2026-12-01',
          feePerMortgage: 5.44,
          totalFee: 5.44,
          items: [{ mortgageId: M1, previousBillingDay: 10, newBillingDay: 1, fee: 5.44 }],
        }),
      );
      expect(ctx.lobby.invalidate).toHaveBeenCalledWith(CUSTOMER);
    });

    it('replays the original request for a repeated Idempotency-Key instead of creating another', async () => {
      ctx.repo.findByIdempotencyKey.mockResolvedValueOnce([requestRow()]);
      const { request, created } = await ctx.service.create(CUSTOMER, 'key-1', { items });
      expect(created).toBe(false);
      expect(request.replayed).toBe(true);
      expect(request.referenceNumber).toBe('6565787');
      expect(ctx.repo.insert).not.toHaveBeenCalled();
      expect(ctx.lobby.invalidate).not.toHaveBeenCalled();
    });

    it('rejects a reused Idempotency-Key that carries different items (422)', async () => {
      ctx.repo.findByIdempotencyKey.mockResolvedValueOnce([requestRow()]);
      await expect(
        ctx.service.create(CUSTOMER, 'key-1', { items: [{ mortgageId: M1, newBillingDay: 15 }] }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(ctx.repo.insert).not.toHaveBeenCalled();
    });

    it('two concurrent submissions with the same key: the loser of the race gets the winner’s request', async () => {
      // both passed the checks; the second INSERT hits the unique (customer, key) constraint
      ctx.repo.insert.mockRejectedValueOnce(uniqueViolation('billing_day_requests_customer_id_idempotency_key_key'));
      ctx.repo.findByIdempotencyKey.mockResolvedValueOnce([]).mockResolvedValueOnce([requestRow()]);
      const { request, created } = await ctx.service.create(CUSTOMER, 'key-1', { items });
      expect(created).toBe(false);
      expect(request.replayed).toBe(true);
    });

    it('two concurrent submissions for the same mortgage: the loser gets 409 from the partial unique index', async () => {
      ctx.repo.insert.mockRejectedValueOnce(uniqueViolation('billing_day_request_items_one_open_per_mortgage'));
      await expect(ctx.service.create(CUSTOMER, 'key-2', { items })).rejects.toBeInstanceOf(ConflictException);
      expect(ctx.lobby.invalidate).not.toHaveBeenCalled();
    });

    it('does not swallow unrelated database errors', async () => {
      ctx.repo.insert.mockRejectedValueOnce(new Error('connection lost'));
      await expect(ctx.service.create(CUSTOMER, 'key-3', { items })).rejects.toThrow('connection lost');
    });

    it('masks the notification phone in the response', async () => {
      const { request } = await ctx.service.create(CUSTOMER, 'key-1', { items });
      expect(request.notifyPhoneMasked).toBe('050-****122');
    });
  });
});
