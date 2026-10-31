import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { calculateEffectiveFrom } from '../../src/billing-day-requests/domain/billing-day.rules';
import { CacheService } from '../../src/cache/cache.service';
import { Env } from '../../src/config/env';
import { DatabaseService } from '../../src/database/database.service';
import { LobbyDto } from '../../src/lobby/dto/lobby.dto';
import { lobbyCacheKey } from '../../src/lobby/lobby.service';

/**
 * The brief's rules, end to end through HTTP against the real database and cache:
 * allowed days, not the current day, effective month, ₪5.44 per mortgage, only the
 * customer's own mortgages, one open request per mortgage, no duplicate on resubmit.
 * The seed is deterministic, so mortgages are looked up through the lobby, not hard-coded.
 */
describe('billing-day requests (integration)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let cache: CacheService;
  let customerId: string;
  let timeZone: string;
  // two mortgages of the demo customer with different current billing days
  let m1: { id: string; billingDay: number };
  let m2: { id: string; billingDay: number };

  const api = () => request(app.getHttpServer());
  const otherDay = (current: number) => [1, 10, 15].find((d) => d !== current)!;
  const resetRequests = async () => {
    await db.query('DELETE FROM billing_day_requests');
    await cache.del(lobbyCacheKey(customerId));
  };

  beforeAll(async () => {
    process.env.DEMO_RESET_TOKEN = 'test-reset-token';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    db = app.get(DatabaseService);
    cache = app.get(CacheService);
    const config = app.get(ConfigService<Env, true>);
    customerId = config.get('DEMO_CUSTOMER_ID', { infer: true });
    timeZone = config.get('BUSINESS_TIMEZONE', { infer: true });

    await resetRequests();
    const lobby = (await api().get('/api/v1/lobby').expect(200)).body as LobbyDto;
    const mortgages = lobby.properties.flatMap((p) => p.mortgages);
    m1 = { id: mortgages[0].id, billingDay: mortgages[0].billingDay };
    m2 = { id: mortgages[1].id, billingDay: mortgages[1].billingDay };
  });

  beforeEach(resetRequests);
  afterAll(async () => {
    await resetRequests();
    await app.close();
  });

  describe('preview', () => {
    it('rejects a day that is not 1, 10 or 15 (400, before any business logic)', async () => {
      const res = await api()
        .post('/api/v1/billing-day-requests/preview')
        .send({ items: [{ mortgageId: m1.id, newBillingDay: 5 }] })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects the mortgage’s current day (422)', async () => {
      const res = await api()
        .post('/api/v1/billing-day-requests/preview')
        .send({ items: [{ mortgageId: m1.id, newBillingDay: m1.billingDay }] })
        .expect(422);
      expect(res.body.code).toBe('INVALID_BILLING_DAY');
    });

    it('rejects a mortgage that is not the customer’s (403)', async () => {
      const res = await api()
        .post('/api/v1/billing-day-requests/preview')
        .send({ items: [{ mortgageId: randomUUID(), newBillingDay: 1 }] })
        .expect(403);
      expect(res.body.code).toBe('MORTGAGE_NOT_OWNED');
    });

    it('quotes ₪5.44 per mortgage and the effective month per the 23rd rule, in bank local time', async () => {
      const res = await api()
        .post('/api/v1/billing-day-requests/preview')
        .send({
          items: [
            { mortgageId: m1.id, newBillingDay: otherDay(m1.billingDay) },
            { mortgageId: m2.id, newBillingDay: otherDay(m2.billingDay) },
          ],
        })
        .expect(200);
      expect(res.body).toMatchObject({
        feePerMortgage: 5.44,
        totalFee: 10.88,
        effectiveFrom: calculateEffectiveFrom(new Date(), timeZone),
      });
      expect(res.body.items[0]).toMatchObject({ previousBillingDay: m1.billingDay, fee: 5.44 });
      expect(await db.query('SELECT 1 FROM billing_day_requests')).toHaveLength(0);
    });
  });

  describe('create', () => {
    const body = () => ({ items: [{ mortgageId: m1.id, newBillingDay: otherDay(m1.billingDay) }] });

    it('requires an Idempotency-Key header (400)', async () => {
      const res = await api().post('/api/v1/billing-day-requests').send(body()).expect(400);
      expect(res.body.code).toBe('MISSING_IDEMPOTENCY_KEY');
    });

    it('creates the request with a snapshot per mortgage and invalidates the lobby cache', async () => {
      await api().get('/api/v1/lobby').expect(200); // warm the cache
      expect((await api().get('/api/v1/lobby')).body.fromCache).toBe(true);

      const res = await api()
        .post('/api/v1/billing-day-requests')
        .set('Idempotency-Key', randomUUID())
        .send(body())
        .expect(201);
      expect(res.body).toMatchObject({
        status: 'pending',
        replayed: false,
        feePerMortgage: 5.44,
        totalFee: 5.44,
        effectiveFrom: calculateEffectiveFrom(new Date(), timeZone),
      });
      expect(res.body.referenceNumber).toMatch(/^\d{7}$/);

      const items = await db.query<{ previous_billing_day: number; new_billing_day: number; fee: string; status: string }>(
        'SELECT previous_billing_day, new_billing_day, fee, status FROM billing_day_request_items',
      );
      expect(items).toEqual([
        { previous_billing_day: m1.billingDay, new_billing_day: otherDay(m1.billingDay), fee: '5.44', status: 'pending' },
      ]);

      // the cached lobby was dropped and the rebuilt one exposes the open request
      const lobby = (await api().get('/api/v1/lobby').expect(200)).body as LobbyDto;
      expect(lobby.fromCache).toBe(false);
      const mortgage = lobby.properties.flatMap((p) => p.mortgages).find((m) => m.id === m1.id)!;
      expect(mortgage.pendingBillingDayRequest).toMatchObject({ referenceNumber: res.body.referenceNumber });
    });

    it('replays the same request for a repeated Idempotency-Key instead of creating a second one', async () => {
      const key = randomUUID();
      const first = await api().post('/api/v1/billing-day-requests').set('Idempotency-Key', key).send(body()).expect(201);
      const again = await api().post('/api/v1/billing-day-requests').set('Idempotency-Key', key).send(body()).expect(200);
      expect(again.body.replayed).toBe(true);
      expect(again.body.id).toBe(first.body.id);
      expect(await db.query('SELECT 1 FROM billing_day_requests')).toHaveLength(1);
    });

    it('rejects a reused Idempotency-Key with different items (422) instead of replaying', async () => {
      const key = randomUUID();
      await api().post('/api/v1/billing-day-requests').set('Idempotency-Key', key).send(body()).expect(201);
      const res = await api()
        .post('/api/v1/billing-day-requests')
        .set('Idempotency-Key', key)
        .send({ items: [{ mortgageId: m2.id, newBillingDay: otherDay(m2.billingDay) }] })
        .expect(422);
      expect(res.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
      expect(await db.query('SELECT 1 FROM billing_day_requests')).toHaveLength(1);
    });

    it('refuses a second open request for the same mortgage (409)', async () => {
      await api().post('/api/v1/billing-day-requests').set('Idempotency-Key', randomUUID()).send(body()).expect(201);
      const res = await api().post('/api/v1/billing-day-requests').set('Idempotency-Key', randomUUID()).send(body()).expect(409);
      expect(res.body.code).toBe('REQUEST_ALREADY_OPEN');
      expect(await db.query('SELECT 1 FROM billing_day_requests')).toHaveLength(1);
    });

    it('two simultaneous submissions with the same key end up as one request', async () => {
      const key = randomUUID();
      const [a, b] = await Promise.all([
        api().post('/api/v1/billing-day-requests').set('Idempotency-Key', key).send(body()),
        api().post('/api/v1/billing-day-requests').set('Idempotency-Key', key).send(body()),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 201]);
      expect(a.body.id).toBe(b.body.id);
      expect(await db.query('SELECT 1 FROM billing_day_requests')).toHaveLength(1);
    });

    it('two simultaneous submissions for the same mortgage with different keys: one wins, one gets 409', async () => {
      const [a, b] = await Promise.all([
        api().post('/api/v1/billing-day-requests').set('Idempotency-Key', randomUUID()).send(body()),
        api().post('/api/v1/billing-day-requests').set('Idempotency-Key', randomUUID()).send(body()),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(await db.query('SELECT 1 FROM billing_day_requests')).toHaveLength(1);
    });

    it('is readable back by id, and only for the owning customer', async () => {
      const created = await api().post('/api/v1/billing-day-requests').set('Idempotency-Key', randomUUID()).send(body()).expect(201);
      await api().get(`/api/v1/billing-day-requests/${created.body.id}`).expect(200);
      await api().get(`/api/v1/billing-day-requests/${randomUUID()}`).expect(404);
    });
  });

  describe('customers only see and change their own mortgages', () => {
    // A second customer with one mortgage, inserted straight into the DB (the seed has one customer)
    const other = { customerId: '', mortgageId: '', requestId: '' };

    beforeAll(async () => {
      await db.transaction(async (client) => {
        const customer = await client.query<{ id: string }>(
          `INSERT INTO customers (account_number, first_name, last_name, phone)
           VALUES ('999-000001', 'לקוח', 'אחר', '0500000001') RETURNING id`,
        );
        other.customerId = customer.rows[0].id;
        const property = await client.query<{ id: string }>(
          `INSERT INTO properties (customer_id, street, city) VALUES ($1, 'רחוב אחר 1', 'חיפה') RETURNING id`,
          [other.customerId],
        );
        const mortgage = await client.query<{ id: string }>(
          `INSERT INTO mortgages (property_id, mortgage_number, product_name, original_amount, remaining_balance,
                                  monthly_payment, interest_rate, monthly_interest, billing_day, start_date, end_date)
           VALUES ($1, '9990000001', 'משכנתה של מישהו אחר', 100000, 90000, 500, 5, 375, 10, '2020-01-01', '2040-01-01')
           RETURNING id`,
          [property.rows[0].id],
        );
        other.mortgageId = mortgage.rows[0].id;
        const req = await client.query<{ id: string }>(
          `INSERT INTO billing_day_requests (customer_id, idempotency_key, effective_from, fee_per_mortgage, total_fee, terms_accepted_at, notify_phone)
           VALUES ($1, $2, '2030-01-01', 5.44, 5.44, now(), '0500000001') RETURNING id`,
          [other.customerId, randomUUID()],
        );
        other.requestId = req.rows[0].id;
        await client.query(
          `INSERT INTO billing_day_request_items (request_id, mortgage_id, previous_billing_day, new_billing_day, fee)
           VALUES ($1, $2, 10, 1, 5.44)`,
          [other.requestId, other.mortgageId],
        );
      });
    });

    afterAll(async () => {
      // requests cascade to items; mortgages/properties are removed explicitly (ON DELETE RESTRICT)
      await db.query('DELETE FROM billing_day_requests WHERE customer_id = $1', [other.customerId]);
      await db.query('DELETE FROM mortgages WHERE id = $1', [other.mortgageId]);
      await db.query('DELETE FROM properties WHERE customer_id = $1', [other.customerId]);
      await db.query('DELETE FROM customers WHERE id = $1', [other.customerId]);
    });

    it('the lobby lists only the demo customer’s mortgages', async () => {
      const lobby = (await api().get('/api/v1/lobby').expect(200)).body as LobbyDto;
      const ids = lobby.properties.flatMap((p) => p.mortgages.map((m) => m.id));
      expect(ids).not.toContain(other.mortgageId);
      expect(lobby.customer.id).toBe(customerId);
    });

    it('a request for someone else’s mortgage is refused (403), on preview and on create', async () => {
      const items = [{ mortgageId: other.mortgageId, newBillingDay: 1 }];
      const preview = await api().post('/api/v1/billing-day-requests/preview').send({ items }).expect(403);
      expect(preview.body.code).toBe('MORTGAGE_NOT_OWNED');
      await api().post('/api/v1/billing-day-requests').set('Idempotency-Key', randomUUID()).send({ items }).expect(403);
      expect(await db.query('SELECT 1 FROM billing_day_requests WHERE customer_id = $1', [customerId])).toHaveLength(0);
    });

    it('mixing an own mortgage with a foreign one is refused as a whole', async () => {
      await api()
        .post('/api/v1/billing-day-requests/preview')
        .send({ items: [{ mortgageId: m1.id, newBillingDay: otherDay(m1.billingDay) }, { mortgageId: other.mortgageId, newBillingDay: 1 }] })
        .expect(403);
    });

    it('someone else’s request cannot be read by id (404, not 403: existence is not revealed)', async () => {
      await api().get(`/api/v1/billing-day-requests/${other.requestId}`).expect(404);
    });
  });

  describe('demo reset', () => {
    it('refuses without the token (403) and deletes the customer’s requests with it', async () => {
      await api().post('/api/v1/billing-day-requests').set('Idempotency-Key', randomUUID())
        .send({ items: [{ mortgageId: m1.id, newBillingDay: otherDay(m1.billingDay) }] }).expect(201);

      await api().post('/api/v1/demo/reset').expect(403);
      await api().post('/api/v1/demo/reset').set('X-Demo-Reset-Token', 'wrong').expect(403);

      const res = await api().post('/api/v1/demo/reset').set('X-Demo-Reset-Token', 'test-reset-token').expect(200);
      expect(res.body).toEqual({ deletedRequests: 1 });
      expect(await db.query('SELECT 1 FROM billing_day_requests WHERE customer_id = $1', [customerId])).toHaveLength(0);

      // the lobby cache was dropped: the mortgage is selectable again
      const lobby = (await api().get('/api/v1/lobby').expect(200)).body as LobbyDto;
      const mortgage = lobby.properties.flatMap((p) => p.mortgages).find((m) => m.id === m1.id)!;
      expect(mortgage.pendingBillingDayRequest).toBeNull();
    });
  });

  describe('the database protects the rules on its own', () => {
    it('refuses a second pending item for a mortgage even when inserted directly', async () => {
      await api()
        .post('/api/v1/billing-day-requests')
        .set('Idempotency-Key', randomUUID())
        .send({ items: [{ mortgageId: m1.id, newBillingDay: otherDay(m1.billingDay) }] })
        .expect(201);

      await expect(
        db.transaction(async (client) => {
          const { rows } = await client.query<{ id: string }>(
            `INSERT INTO billing_day_requests (customer_id, idempotency_key, effective_from, fee_per_mortgage, total_fee, terms_accepted_at, notify_phone)
             VALUES ($1, $2, '2030-01-01', 5.44, 5.44, now(), '0500000000') RETURNING id`,
            [customerId, randomUUID()],
          );
          await client.query(
            `INSERT INTO billing_day_request_items (request_id, mortgage_id, previous_billing_day, new_billing_day, fee, status)
             VALUES ($1, $2, $3, $4, 5.44, 'pending')`,
            [rows[0].id, m1.id, m1.billingDay, otherDay(m1.billingDay)],
          );
        }),
      ).rejects.toMatchObject({ code: '23505', constraint: 'billing_day_request_items_one_open_per_mortgage' });
    });

    it('refuses a billing day outside 1/10/15 and an unchanged day at the column level', async () => {
      const insertItem = (previous: number, next: number) =>
        db.transaction(async (client) => {
          const { rows } = await client.query<{ id: string }>(
            `INSERT INTO billing_day_requests (customer_id, idempotency_key, effective_from, fee_per_mortgage, total_fee, terms_accepted_at, notify_phone)
             VALUES ($1, $2, '2030-01-01', 5.44, 5.44, now(), '0500000000') RETURNING id`,
            [customerId, randomUUID()],
          );
          await client.query(
            `INSERT INTO billing_day_request_items (request_id, mortgage_id, previous_billing_day, new_billing_day, fee)
             VALUES ($1, $2, $3, $4, 5.44)`,
            [rows[0].id, m2.id, previous, next],
          );
        });
      await expect(insertItem(10, 5)).rejects.toMatchObject({ code: '23514' }); // check_violation
      await expect(insertItem(10, 10)).rejects.toMatchObject({ code: '23514' });
    });
  });
});
