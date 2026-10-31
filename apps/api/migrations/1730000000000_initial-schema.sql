-- Up Migration

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
CREATE TABLE customers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number  text        NOT NULL UNIQUE,            -- e.g. 401-123456 (shown in the header)
  first_name      text        NOT NULL,
  last_name       text        NOT NULL,
  phone           text        NOT NULL,                   -- E.164-ish, masked when rendered
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Properties: a customer owns N properties, each property carries N mortgages.
-- ---------------------------------------------------------------------------
CREATE TABLE properties (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid        NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  street        text        NOT NULL,
  city          text        NOT NULL,
  display_order smallint    NOT NULL DEFAULT 0,       -- stable UI ordering independent of insert time
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, street, city)
);
CREATE INDEX properties_customer_id_idx ON properties (customer_id);

-- ---------------------------------------------------------------------------
-- Mortgages
-- ---------------------------------------------------------------------------
CREATE TYPE mortgage_status AS ENUM ('active', 'closed');

CREATE TABLE mortgages (
  id                   uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id          uuid            NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  mortgage_number      text            NOT NULL UNIQUE,   -- bank-facing identifier shown in the UI
  product_name         text            NOT NULL,          -- e.g. "רכישת דירה יד שניה"
  status               mortgage_status NOT NULL DEFAULT 'active',
  original_amount      numeric(14,2)   NOT NULL CHECK (original_amount > 0),
  remaining_balance    numeric(14,2)   NOT NULL CHECK (remaining_balance >= 0),
  -- Fees that would be added on full early repayment ("הסך הנותר להחזר עם עמלות").
  early_repayment_fee  numeric(12,2)   NOT NULL DEFAULT 0 CHECK (early_repayment_fee >= 0),
  monthly_payment     numeric(12,2)   NOT NULL CHECK (monthly_payment > 0),
  interest_rate        numeric(5,2)    NOT NULL CHECK (interest_rate >= 0),
  monthly_interest     numeric(12,2)   NOT NULL CHECK (monthly_interest >= 0),
  billing_day          smallint        NOT NULL CHECK (billing_day BETWEEN 1 AND 28),
  start_date           date            NOT NULL,
  end_date             date            NOT NULL CHECK (end_date > start_date),
  last_charge_date     date,
  last_charge_amount   numeric(12,2)   CHECK (last_charge_amount >= 0),
  next_charge_date     date,
  next_charge_amount   numeric(12,2)   CHECK (next_charge_amount >= 0),
  has_payment_delays   boolean         NOT NULL DEFAULT false,
  display_order        smallint        NOT NULL DEFAULT 0,
  created_at           timestamptz     NOT NULL DEFAULT now()
);
CREATE INDEX mortgages_property_id_idx ON mortgages (property_id);

-- Borrowers are modelled as their own rows rather than a text column so a
-- mortgage can have any number of them and names are not duplicated.
CREATE TABLE mortgage_borrowers (
  mortgage_id  uuid     NOT NULL REFERENCES mortgages(id) ON DELETE CASCADE,
  position     smallint NOT NULL CHECK (position >= 1),
  full_name    text     NOT NULL,
  PRIMARY KEY (mortgage_id, position)
);

-- ---------------------------------------------------------------------------
-- Billing-day change requests
--
-- One request groups the per-mortgage changes a customer submitted together.
-- Each item snapshots previous/new day and the fee so history stays correct
-- even if the fee or the mortgage changes later.
-- ---------------------------------------------------------------------------
CREATE TYPE request_status AS ENUM ('pending', 'applied', 'rejected', 'cancelled');

-- Reference numbers start at a 7-digit value to match the design (e.g. 6565765).
CREATE SEQUENCE billing_day_request_reference_seq START WITH 6565765;

CREATE TABLE billing_day_requests (
  id                 uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        uuid           NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  reference_number   text           NOT NULL UNIQUE
                                    DEFAULT nextval('billing_day_request_reference_seq')::text,
  -- Idempotency: the client generates one key per flow attempt. A retry with the
  -- same key must return the original request instead of creating a new one.
  idempotency_key    uuid           NOT NULL,
  status             request_status NOT NULL DEFAULT 'pending',
  submitted_at       timestamptz    NOT NULL DEFAULT now(),
  -- First month in which the new billing day applies (always the 1st of a month).
  effective_from     date           NOT NULL CHECK (EXTRACT(DAY FROM effective_from) = 1),
  fee_per_mortgage   numeric(8,2)   NOT NULL CHECK (fee_per_mortgage >= 0),
  total_fee          numeric(10,2)  NOT NULL CHECK (total_fee >= 0),
  terms_accepted_at  timestamptz    NOT NULL,
  notify_phone       text           NOT NULL,
  UNIQUE (customer_id, idempotency_key)
);
CREATE INDEX billing_day_requests_customer_id_idx ON billing_day_requests (customer_id);

CREATE TABLE billing_day_request_items (
  id                    uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id            uuid           NOT NULL REFERENCES billing_day_requests(id) ON DELETE CASCADE,
  mortgage_id           uuid           NOT NULL REFERENCES mortgages(id) ON DELETE RESTRICT,
  previous_billing_day  smallint       NOT NULL CHECK (previous_billing_day BETWEEN 1 AND 28),
  new_billing_day       smallint       NOT NULL CHECK (new_billing_day IN (1, 10, 15)),
  fee                   numeric(8,2)   NOT NULL CHECK (fee >= 0),
  -- Mirrors the parent request status so the partial unique index below can
  -- express "one OPEN request per mortgage" entirely inside the database.
  status                request_status NOT NULL DEFAULT 'pending',
  CONSTRAINT billing_day_request_items_day_must_change CHECK (new_billing_day <> previous_billing_day),
  UNIQUE (request_id, mortgage_id)
);
CREATE INDEX billing_day_request_items_request_id_idx ON billing_day_request_items (request_id);
CREATE INDEX billing_day_request_items_mortgage_id_idx ON billing_day_request_items (mortgage_id);

-- Business rule: at most one open (pending) request per mortgage.
CREATE UNIQUE INDEX billing_day_request_items_one_open_per_mortgage
  ON billing_day_request_items (mortgage_id)
  WHERE status = 'pending';

-- Keep item status in sync with the parent request status.
CREATE FUNCTION sync_request_item_status() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE billing_day_request_items SET status = NEW.status WHERE request_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_day_requests_sync_item_status
  AFTER UPDATE OF status ON billing_day_requests
  FOR EACH ROW EXECUTE FUNCTION sync_request_item_status();

-- Down Migration
DROP TRIGGER IF EXISTS billing_day_requests_sync_item_status ON billing_day_requests;
DROP FUNCTION IF EXISTS sync_request_item_status();
DROP TABLE IF EXISTS billing_day_request_items;
DROP TABLE IF EXISTS billing_day_requests;
DROP SEQUENCE IF EXISTS billing_day_request_reference_seq;
DROP TYPE IF EXISTS request_status;
DROP TABLE IF EXISTS mortgage_borrowers;
DROP TABLE IF EXISTS mortgages;
DROP TYPE IF EXISTS mortgage_status;
DROP TABLE IF EXISTS properties;
DROP TABLE IF EXISTS customers;
