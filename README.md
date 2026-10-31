# Bank Moveo – Managed Mortgages

Home assignment for a Full-Stack Engineer role: the mortgage **lobby** and one request flow,
**changing the mortgage billing date**, end to end. Hebrew, RTL, desktop and mobile, WCAG 2.2 AA.

- Web: React 19 + TypeScript (Vite, react-router 7, TanStack Query), plain CSS.
- API: NestJS 11 + TypeScript, PostgreSQL (SQL migrations + seed), Redis (lobby cache), OpenAPI.
- Tests: Vitest (API rules, services, DTOs; web wizard logic and step 1), an API integration suite
  against real Postgres + Redis, and a Playwright happy path with axe on desktop and 320px.

**Live:** web `<vercel-url>` · API `<railway-url>/api/v1` · docs `<railway-url>/api/docs`
*(filled in after deployment)*

---

## Run it

### Everything in Docker

```bash
cp .env.example .env            # host ports only; edit if 5432/6379/3000 are taken
docker compose up --build
```

Open http://localhost:8080. The API container runs the migrations and the idempotent seed on
start, then listens on `http://localhost:${API_PORT:-3000}/api/v1` (Swagger at `/api/docs`).
nginx serves the built web app and proxies `/api` to the API, so there is a single origin and no CORS.

### Local development

```bash
pnpm install
docker compose up -d postgres redis

cd apps/api
cp .env.example .env            # DATABASE_URL, REDIS_URL, CORS_ORIGINS…
pnpm exec tsx scripts/migrate.ts
pnpm exec tsx scripts/seed.ts
pnpm dev                        # http://localhost:3000/api/v1, docs at /api/docs

cd ../web
pnpm dev                        # http://localhost:5173, proxies /api to the API
```

The web app needs no `.env` in development; `VITE_API_BASE_URL` defaults to `/api/v1` on the same
origin. Set it to the full API URL only when the API is hosted elsewhere (see Deployment).

### Tests

| What | Where | Command | Needs |
|---|---|---|---|
| Business rules, services, DTO validation (39) | `apps/api` | `pnpm test` | nothing |
| API integration (18): HTTP → Nest → Postgres + Redis | `apps/api` | `pnpm test:integration` | `docker compose up -d postgres redis` + `.env` |
| Wizard state, step routing, step 1 behaviour, formatting (17) | `apps/web` | `pnpm test` | nothing |
| Happy path lobby → done, axe on every screen, desktop + 320px | `apps/web` | `pnpm e2e` | API + DB running; `pnpm e2e:reset` between runs |

`pnpm e2e:reset` deletes the demo requests and flushes the lobby cache; the e2e submits real
requests, and a mortgage with an open request cannot be selected again (that is one of the rules).
Point the e2e at a deployed instance with `E2E_BASE_URL=https://… pnpm e2e`.

---

## What is in scope

**Lobby** – portfolio summary, mortgage timeline, "how can we help" (only *שינוי מועד חיוב*
works), mortgages grouped by property, banker and tip cards.

**Flow** – (1) select mortgages → (2) choose a new billing day per mortgage → (3) summary and
terms → (4) done, with a reference number. Focus moves to the step heading on every step change.

**Rules** (from the brief) and where each one is enforced:

| Rule | Web | API | Database |
|---|---|---|---|
| Allowed days are 1, 10, 15 | only those are offered | DTO `@IsIn`, 400 | `CHECK (new_billing_day IN (1,10,15))` |
| …but not the mortgage's current day | current day is not offered | 422 `INVALID_BILLING_DAY` | `CHECK (new <> previous)` |
| Submitted by the 23rd → next month, later → the month after | displays what the API returns | computed in `Asia/Jerusalem`, stored on the request | `effective_from` is always the 1st |
| ₪5.44 per mortgage | displays what the API returns | constant, snapshotted per item | stored per item |
| Customers only change their own mortgages | lobby shows only theirs | ownership join, 403 `MORTGAGE_NOT_OWNED` (same answer for "does not exist") | FK chain customer → property → mortgage |
| One open request per mortgage | checkbox blocked with an explanation | 409 `REQUEST_ALREADY_OPEN` | **partial unique index** on items `WHERE status = 'pending'` |
| Submitting twice must not create two requests | one `Idempotency-Key` per attempt, kept across refresh | same key → 200 `replayed: true`; same key + other items → 422 | `UNIQUE (customer_id, idempotency_key)` |

The code gives good error messages; the database gives the guarantee. Two concurrent submissions
can both pass the service checks, so the unique violations from Postgres are translated into the
same 200-replay / 409 answers (covered by the integration tests with real parallel requests).

---

## Architecture

```
apps/web  (Vite + React)            apps/api  (NestJS)
┌──────────────────────┐   HTTP     ┌────────────────────────────┐     ┌──────────┐
│ lobby page           │ ────────▶ │ /lobby                      │ ──▶ │ Redis    │ lobby:v1:<customer>
│ request flow (4 steps)│          │ /billing-day-requests/preview│     └──────────┘
│ sessionStorage wizard │          │ /billing-day-requests (+ :id)│ ──▶ ┌──────────┐
│ TanStack Query cache  │          │ /health                      │     │ Postgres │ migrations + seed
└──────────────────────┘            └────────────────────────────┘     └──────────┘
```

**API layers.** Controller (DTO validation, OpenAPI) → service (business rules, error codes) →
repository (parameterised SQL with `pg`). No ORM: the schema and the constraints are the design,
and the SQL is short enough to read. `domain/billing-day.rules.ts` holds the pure rules
(allowed days, fee, effective month) and is unit-tested in isolation.

**Caching.** Cache-aside for the lobby: Redis first, Postgres on a miss, write back with
`LOBBY_CACHE_TTL_SECONDS`. The key is `lobby:v1:<customerId>` (versioned so a shape change never
serves a stale object). Creating a request deletes the key, so the next lobby read shows the open
request. The lobby response carries `fromCache` so this is observable. Redis failures degrade to
Postgres: the cache can never take the lobby down. Known limit: a lobby read that started before a
submit committed can write a stale snapshot after the invalidation, for at most one TTL. Acceptable
for this scope; the fix would be a short delayed second delete or a version check.

**Wizard state** lives in `sessionStorage` for the duration of the flow: a refresh keeps the
selection *and the Idempotency-Key*, so refresh-and-resubmit cannot create a duplicate. Leaving the
flow (exit link, nav, browser back) clears it; the next entry starts fresh with a new key.

**Server-side quote.** Step 3 asks `POST /billing-day-requests/preview` for the exact fee and
effective month the API will apply. The client never computes money or dates; there is one source
of truth.

### Authentication: none, by design

The brief asks for a single demo customer and no real authentication. Instead of hard-coding
"whose mortgages" inside the business logic, one middleware answers the question *who is making
this request*:

```
DemoCustomerMiddleware   req.customerId = DEMO_CUSTOMER_ID      (apps/api/src/common/demo-customer.middleware.ts)
@CurrentCustomer()       reads req.customerId in every controller
services / repository    receive customerId and scope every query by it
```

Nothing below the controllers knows the id is fixed. Ownership (403), one open request per
mortgage, idempotency and the lobby cache key are all per customer already, which the integration
suite proves by inserting a second customer with its own mortgage and request. Replacing the
middleware with a JWT guard that sets `req.customerId` from the token is a one-file change.

---

## Data model

Six tables, two enums, one sequence, one trigger — `apps/api/migrations/*.sql`.

- **customers** – account number, name, phone (stored in full, masked when rendered).
- **properties** – belong to a customer. This is the ownership edge: "my mortgages" is always a
  join through `properties.customer_id`. Unique on (customer, street, city); `display_order` keeps
  the Figma order.
- **mortgages** – everything the lobby shows (balances, payments, rate, billing day, charges,
  delays), with `CHECK`s on every amount and on `billing_day`. Status enum for "active only".
- **mortgage_borrowers** – one row per borrower, ordered, instead of a comma-joined string.
- **billing_day_requests** – one row per submission: 7-digit reference from a sequence,
  `idempotency_key` with `UNIQUE (customer_id, idempotency_key)`, status enum, `effective_from`
  (checked to be a 1st of month), fee snapshot, `terms_accepted_at`, notification phone.
- **billing_day_request_items** – one row per mortgage in the request: previous day, new day,
  fee. `status` is **mirrored** from the parent so that the rule "one *open* request per mortgage"
  can be a partial unique index on this table alone: `(mortgage_id) WHERE status = 'pending'`.
  A trigger keeps the mirror in sync when the request status changes.

Indexes on every foreign key used by the lobby and request queries.

---

## Front-end decisions

- **Plain CSS, px, tokens from Figma.** Colours and the type scale (`--font-size-xl/l/m/s/xs`)
  are the Figma variables; typography is applied with classes named after them (`text-xl`,
  `text-s-medium`, …). A `text-*` class is never overridden: an element that needs two sizes
  (mobile vs desktop) gets its own class declaring both, so what you read is what renders.
- **One responsive switch at 1024px.** Figma defines two frames, 1920 and 390. Below 1024px the
  mobile design is stretched; from 1024px the desktop design shrinks fluidly, pixel-exact at 1920.
  1024 is the classic tablet line: a tablet in portrait (768–834) gets the phone layout, which is
  one roomy column; in landscape (1024+) it gets the desktop. Two things are deliberately not
  stretched on wide phone layouts: the account pill keeps a phone-like width and the wave keeps
  its height. The nav bar tightens below 1500px and scrolls horizontally below ~1200px.
  Tables keep their Figma column ratios as percentage shares; on mobile a row collapses to the
  file number and loan name with a chevron that reveals the rest (the mobile frame shows only the
  collapsed state; the open state is our reading).
- **Accessibility.** Real `<table>`s with column headers, `fieldset`/`legend` for the day choice,
  focus to the step heading on each step, tooltips tied with `aria-describedby`, tablists with
  roving `tabindex` and arrow keys. A blocked action is `aria-disabled` rather than `disabled`:
  it stays focusable and explains itself (hover/focus, always visible on touch). Zero axe
  violations on every screen in the e2e. Links inside running text are underlined.
- **Header height is fixed at 97px** on both screens. The two Figma frames hug their content
  (92 vs 70) because the lobby chip is two lines; a shell that changes height between pages reads
  as a bug, so the lobby value is used everywhere.
- **Mobile browser chrome.** `theme-color` follows the screen (coral on the lobby, white in the
  flow) so the phone's own bar continues the wave as in the mockup. Drawing under the status bar
  itself needs an installed app and is out of scope.

### Deliberate deviations from the Figma

- Demo numbers in the design do not add up (per-mortgage figures vs totals) and the names are
  inconsistent (account holder vs borrowers vs the flow header). We seed the per-mortgage data
  from the lobby cards, compute totals from the database, and make the demo customer a borrower
  on her own mortgages.
- Step 3 and the done screen show exactly what the frames show: the fee per mortgage in the
  table, the terms under it, reference number and submission time. The effective month and the
  total fee are computed and stored but not displayed, because they are not in the design.
- Out-of-scope controls (account switcher, language, bell, WhatsApp, other nav items) look like
  the design but do nothing.
- The mobile frame of the request flow replaces the service card with a floating headset button;
  what it opens is not designed, so on mobile the service card simply follows the content.

---

## Trade-offs

- **Demo customer via middleware, not a constant in the services.** One more file, but the
  business code is already multi-tenant and the switch to real auth touches one place.
- **No ORM.** Faster to write and read at this size, and the constraints *are* the model. The cost
  is hand-written row types; the integration suite guards the SQL.
- **Idempotency by header, not by payload hash.** The client owns the key per attempt (survives
  refresh). A reused key with different items is rejected (422) instead of hashed and compared.
- **Separate web container (nginx).** The brief asks for a Dockerfile per service; nginx only
  serves the static build and proxies `/api` for a single origin in compose. In development Vite
  does that job, in production Vercel does.
- **Fluid between the two frames.** No intermediate designs were invented; widths between 390 and
  1920 scale the nearest frame. Verified for horizontal overflow at 320, 390, 768, 1024, 1280,
  1440 and 1920.

## What I would do next

- Real authentication (JWT guard replacing the demo middleware) and per-customer rate limits.
- A request detail page and a "cancel open request" action (the status enum and trigger already
  support it).
- Visual regression on the two Figma frames, and axe in CI.
- Pixel values still marked `Figma?` in CSS (a handful of chip and card sizes read off exports).
- Observability: request ids in logs, metrics for cache hit ratio.

## Deployment

- **API**: Railway (or any Docker host) with Postgres and Redis add-ons. Set `DATABASE_URL`,
  `REDIS_URL`, `CORS_ORIGINS=<web url>`, `BUSINESS_TIMEZONE=Asia/Jerusalem`. The image runs
  migrations and the seed on start.
- **Web**: Vercel, root `apps/web`, build `pnpm build`, output `dist`, env
  `VITE_API_BASE_URL=<api url>/api/v1`. `vercel.json` adds the SPA fallback.

## How AI tools were used

Built with Claude Code (Anthropic) as a pair programmer throughout. Claude wrote most of the code,
tests and this README; the design values were dictated from the Figma inspector by me, every
change was reviewed in the browser, and the architecture, data model and scope decisions were
mine. A separate Claude review pass over the finished code produced the fixes in PR #2 (container
start-up, idempotency payload check, accessibility, dead code). Commits carry a co-author trailer.
