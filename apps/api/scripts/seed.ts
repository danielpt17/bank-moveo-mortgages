/*
 * Seeds the single demo customer with the portfolio shown in the Figma lobby.
 * Idempotent: safe to run on every container start. It upserts by natural keys
 * (account number, address, mortgage number) and never touches request tables.
 */
import { Pool } from 'pg';

const DEMO_CUSTOMER_ID = process.env.DEMO_CUSTOMER_ID ?? '11111111-1111-4111-8111-111111111111';

interface SeedMortgage {
  number: string;
  product: string;
  balance: number;
  earlyRepaymentFee: number;
  payment: number;
  billingDay: number;
  start: string;
  end: string;
  delays?: boolean;
}

interface SeedProperty {
  street: string;
  city: string;
  mortgages: SeedMortgage[];
}

// The Figma shows unrelated borrower names; the demo customer is a borrower on her own mortgages.
const BORROWERS = ['אביגיל רוזנבלום', 'יוסי רוזנבלום'];
const INTEREST_RATE = 5.75;
const MONTHLY_INTEREST = 173.98;

const PROPERTIES: SeedProperty[] = [
  {
    street: 'רבי יוחנן הלוי 23',
    city: 'ירושלים',
    mortgages: [
      { number: '2392345632', product: 'רכישת דירה יד שניה', balance: 1100500, earlyRepaymentFee: 540, payment: 1521.24, billingDay: 10, start: '2020-01-10', end: '2045-01-10' },
      { number: '2332349232', product: 'מיחזור בבנק- לדיור', balance: 29534.33, earlyRepaymentFee: 36, payment: 1234.43, billingDay: 1, start: '2023-06-01', end: '2027-06-01', delays: true },
    ],
  },
  {
    street: "זאב ז'בוטינסקי 123",
    city: 'אשדוד',
    mortgages: [
      { number: '2345679232', product: 'רכישת דירה יד שניה', balance: 1100500, earlyRepaymentFee: 540, payment: 2501.21, billingDay: 10, start: '2019-03-10', end: '2045-01-10' },
      { number: '2392356782', product: 'מיחזור בבנק- לדיור', balance: 940553, earlyRepaymentFee: 220, payment: 1901.21, billingDay: 15, start: '2021-02-15', end: '2032-02-15' },
      { number: '2392367892', product: 'הלוואה לשיפוץ', balance: 230432, earlyRepaymentFee: 80, payment: 1654.53, billingDay: 1, start: '2022-09-01', end: '2029-09-01' },
      { number: '2356789232', product: 'רכישת דירה יד שניה', balance: 140543, earlyRepaymentFee: 40, payment: 1354.52, billingDay: 15, start: '2020-11-15', end: '2028-11-15' },
    ],
  },
];

/** Last/next charge dates derived from the billing day around the design's "as of" date (Feb 2025). */
function chargeDates(billingDay: number): { last: string; next: string } {
  const dd = String(billingDay).padStart(2, '0');
  return { last: `2025-01-${dd}`, next: `2025-02-${dd}` };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO customers (id, account_number, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (account_number) DO UPDATE
         SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, phone = EXCLUDED.phone`,
      [DEMO_CUSTOMER_ID, '401-123456', 'אביגיל', 'רוזנבלום', '0501234122'],
    );

    for (const [propertyIndex, property] of PROPERTIES.entries()) {
      const {
        rows: [{ id: propertyId }],
      } = await client.query<{ id: string }>(
        `INSERT INTO properties (customer_id, street, city, display_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (customer_id, street, city) DO UPDATE SET display_order = EXCLUDED.display_order
         RETURNING id`,
        [DEMO_CUSTOMER_ID, property.street, property.city, propertyIndex],
      );

      for (const [mortgageIndex, m] of property.mortgages.entries()) {
        const { last, next } = chargeDates(m.billingDay);
        const {
          rows: [{ id: mortgageId }],
        } = await client.query<{ id: string }>(
          `INSERT INTO mortgages
             (property_id, mortgage_number, product_name, original_amount, remaining_balance,
              early_repayment_fee, monthly_payment, interest_rate, monthly_interest, billing_day,
              start_date, end_date, last_charge_date, last_charge_amount, next_charge_date,
              next_charge_amount, has_payment_delays, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
           ON CONFLICT (mortgage_number) DO UPDATE SET
             product_name = EXCLUDED.product_name,
             remaining_balance = EXCLUDED.remaining_balance,
             early_repayment_fee = EXCLUDED.early_repayment_fee,
             monthly_payment = EXCLUDED.monthly_payment,
             interest_rate = EXCLUDED.interest_rate,
             monthly_interest = EXCLUDED.monthly_interest,
             start_date = EXCLUDED.start_date,
             end_date = EXCLUDED.end_date,
             has_payment_delays = EXCLUDED.has_payment_delays,
             display_order = EXCLUDED.display_order
           RETURNING id`,
          [
            propertyId,
            m.number,
            m.product,
            Math.round(m.balance * 1.35),
            m.balance,
            m.earlyRepaymentFee,
            m.payment,
            INTEREST_RATE,
            MONTHLY_INTEREST,
            m.billingDay,
            m.start,
            m.end,
            last,
            m.payment,
            next,
            m.payment,
            m.delays ?? false,
            mortgageIndex,
          ],
        );

        for (const [index, name] of BORROWERS.entries()) {
          await client.query(
            `INSERT INTO mortgage_borrowers (mortgage_id, position, full_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (mortgage_id, position) DO UPDATE SET full_name = EXCLUDED.full_name`,
            [mortgageId, index + 1, name],
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log(`seed: demo customer ${DEMO_CUSTOMER_ID} with ${PROPERTIES.flatMap((p) => p.mortgages).length} mortgages`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
