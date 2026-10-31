import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface CustomerRow {
  id: string;
  account_number: string;
  first_name: string;
  last_name: string;
  phone: string;
}

export interface MortgageRow {
  id: string;
  property_id: string;
  street: string;
  city: string;
  mortgage_number: string;
  product_name: string;
  remaining_balance: string;
  early_repayment_fee: string;
  monthly_payment: string;
  interest_rate: string;
  monthly_interest: string;
  billing_day: number;
  start_date: string;
  end_date: string;
  last_charge_date: string | null;
  last_charge_amount: string | null;
  next_charge_date: string | null;
  next_charge_amount: string | null;
  has_payment_delays: boolean;
  borrowers: string[];
  pending_request_id: string | null;
  pending_reference_number: string | null;
  pending_new_billing_day: number | null;
  pending_effective_from: string | null;
}

@Injectable()
export class LobbyRepository {
  constructor(private readonly db: DatabaseService) {}

  findCustomer(customerId: string): Promise<CustomerRow[]> {
    return this.db.query<CustomerRow>(
      `SELECT id, account_number, first_name, last_name, phone FROM customers WHERE id = $1`,
      [customerId],
    );
  }

  /** All active mortgages of a customer with their property, borrowers and open request (if any). */
  findActiveMortgages(customerId: string): Promise<MortgageRow[]> {
    return this.db.query<MortgageRow>(
      `SELECT
         m.id, m.property_id, p.street, p.city,
         m.mortgage_number, m.product_name,
         m.remaining_balance, m.early_repayment_fee, m.monthly_payment,
         m.interest_rate, m.monthly_interest, m.billing_day,
         to_char(m.start_date, 'YYYY-MM-DD') AS start_date,
         to_char(m.end_date, 'YYYY-MM-DD') AS end_date,
         to_char(m.last_charge_date, 'YYYY-MM-DD') AS last_charge_date,
         m.last_charge_amount,
         to_char(m.next_charge_date, 'YYYY-MM-DD') AS next_charge_date,
         m.next_charge_amount,
         m.has_payment_delays,
         COALESCE(
           (SELECT array_agg(b.full_name ORDER BY b.position) FROM mortgage_borrowers b WHERE b.mortgage_id = m.id),
           '{}'
         ) AS borrowers,
         r.id AS pending_request_id,
         r.reference_number AS pending_reference_number,
         i.new_billing_day AS pending_new_billing_day,
         to_char(r.effective_from, 'YYYY-MM-DD') AS pending_effective_from
       FROM mortgages m
       JOIN properties p ON p.id = m.property_id
       LEFT JOIN billing_day_request_items i ON i.mortgage_id = m.id AND i.status = 'pending'
       LEFT JOIN billing_day_requests r ON r.id = i.request_id
       WHERE p.customer_id = $1 AND m.status = 'active'
       ORDER BY p.display_order, p.id, m.display_order, m.mortgage_number`,
      [customerId],
    );
  }
}
