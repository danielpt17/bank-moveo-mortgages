import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';

export interface OwnedMortgageRow {
  id: string;
  mortgage_number: string;
  product_name: string;
  billing_day: number;
  interest_rate: string;
  monthly_interest: string;
  street: string;
  city: string;
  borrowers: string[];
  has_pending_request: boolean;
}

export interface RequestRow {
  id: string;
  customer_id: string;
  reference_number: string;
  status: string;
  submitted_at: Date;
  effective_from: string;
  fee_per_mortgage: string;
  total_fee: string;
  notify_phone: string;
}

export interface RequestItemRow {
  mortgage_id: string;
  mortgage_number: string;
  product_name: string;
  borrowers: string[];
  interest_rate: string;
  monthly_interest: string;
  street: string;
  city: string;
  previous_billing_day: number;
  new_billing_day: number;
  fee: string;
}

export interface NewRequest {
  customerId: string;
  idempotencyKey: string;
  effectiveFrom: string;
  feePerMortgage: number;
  totalFee: number;
  notifyPhone: string;
  submittedAt: Date;
  items: { mortgageId: string; previousBillingDay: number; newBillingDay: number; fee: number }[];
}

@Injectable()
export class BillingDayRequestsRepository {
  constructor(private readonly db: DatabaseService) {}

  /** Only mortgages that belong to the customer are returned: ownership is enforced by the join. */
  findOwnedMortgages(customerId: string, mortgageIds: string[]): Promise<OwnedMortgageRow[]> {
    return this.db.query<OwnedMortgageRow>(
      `SELECT m.id, m.mortgage_number, m.product_name, m.billing_day, m.interest_rate, m.monthly_interest,
              p.street, p.city,
              COALESCE((SELECT array_agg(b.full_name ORDER BY b.position)
                        FROM mortgage_borrowers b WHERE b.mortgage_id = m.id), '{}') AS borrowers,
              EXISTS (SELECT 1 FROM billing_day_request_items i
                      WHERE i.mortgage_id = m.id AND i.status = 'pending') AS has_pending_request
       FROM mortgages m
       JOIN properties p ON p.id = m.property_id
       WHERE p.customer_id = $1 AND m.status = 'active' AND m.id = ANY($2::uuid[])`,
      [customerId, mortgageIds],
    );
  }

  findCustomerPhone(customerId: string): Promise<{ phone: string }[]> {
    return this.db.query<{ phone: string }>(`SELECT phone FROM customers WHERE id = $1`, [customerId]);
  }

  findByIdempotencyKey(customerId: string, key: string): Promise<RequestRow[]> {
    return this.db.query<RequestRow>(
      `${SELECT_REQUEST} WHERE customer_id = $1 AND idempotency_key = $2`,
      [customerId, key],
    );
  }

  findById(customerId: string, id: string): Promise<RequestRow[]> {
    return this.db.query<RequestRow>(`${SELECT_REQUEST} WHERE customer_id = $1 AND id = $2`, [
      customerId,
      id,
    ]);
  }

  findItems(requestId: string): Promise<RequestItemRow[]> {
    return this.db.query<RequestItemRow>(
      `SELECT i.mortgage_id, m.mortgage_number, m.product_name, m.interest_rate, m.monthly_interest,
              p.street, p.city,
              COALESCE((SELECT array_agg(b.full_name ORDER BY b.position)
                        FROM mortgage_borrowers b WHERE b.mortgage_id = m.id), '{}') AS borrowers,
              i.previous_billing_day, i.new_billing_day, i.fee
       FROM billing_day_request_items i
       JOIN mortgages m ON m.id = i.mortgage_id
       JOIN properties p ON p.id = m.property_id
       WHERE i.request_id = $1
       ORDER BY p.display_order, p.id, m.display_order, m.mortgage_number`,
      [requestId],
    );
  }

  /** Inserts the request and its items atomically. Unique-violations bubble up to the service. */
  insert(request: NewRequest): Promise<RequestRow> {
    return this.db.transaction(async (client: PoolClient) => {
      const {
        rows: [row],
      } = await client.query<RequestRow>(
        `INSERT INTO billing_day_requests
           (customer_id, idempotency_key, submitted_at, effective_from, fee_per_mortgage, total_fee,
            terms_accepted_at, notify_phone)
         VALUES ($1, $2, $3, $4, $5, $6, $3, $7)
         RETURNING id, customer_id, reference_number, status, submitted_at,
                   to_char(effective_from, 'YYYY-MM-DD') AS effective_from,
                   fee_per_mortgage, total_fee, notify_phone`,
        [
          request.customerId,
          request.idempotencyKey,
          request.submittedAt,
          request.effectiveFrom,
          request.feePerMortgage,
          request.totalFee,
          request.notifyPhone,
        ],
      );

      for (const item of request.items) {
        await client.query(
          `INSERT INTO billing_day_request_items
             (request_id, mortgage_id, previous_billing_day, new_billing_day, fee)
           VALUES ($1, $2, $3, $4, $5)`,
          [row.id, item.mortgageId, item.previousBillingDay, item.newBillingDay, item.fee],
        );
      }
      return row;
    });
  }
}

const SELECT_REQUEST = `
  SELECT id, customer_id, reference_number, status, submitted_at,
         to_char(effective_from, 'YYYY-MM-DD') AS effective_from,
         fee_per_mortgage, total_fee, notify_phone
  FROM billing_day_requests`;
