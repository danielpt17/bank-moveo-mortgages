# Bank Moveo – Managed Mortgages (home assignment)

Full-stack home assignment for a Full-Stack Engineer interview (React · NestJS). Daniel must
submit it (repo link + live URLs) and then **present it live**, so every decision needs a
one-line reason he can say out loud. Keep explanations in the README in that spirit.

## The brief (from the PDF in `~/Downloads/Bank-Moveo-Home-Assignment-Short.pdf`)

- Build the mortgage **lobby** and one request flow, **changing the mortgage billing date**, end to end.
  Figma is the spec: Hebrew, RTL, desktop + mobile for every screen.
- Lobby: portfolio summary + mortgages grouped by property. In "איך נוכל לעזור לך?" only
  "שינוי מועד חיוב" has to work.
- Flow: (1) select mortgages → (2) new billing day per mortgage → (3) summary, accept terms,
  confirm → (4) done with a reference number.
- Rules: allowed days 1, 10, 15 (not the current one); submitted by the 23rd → effective next
  month, later → the month after; ₪5.44 fee per mortgage; customers can only change their own
  mortgages; one open request per mortgage; submitting twice must not create two requests.
- No real auth: one demo customer. Use the demo data shown in the design.
- Tech: React + TS; NestJS + TS with validated DTOs + OpenAPI; PostgreSQL with migrations + seed;
  Redis caching the lobby, invalidated on submit; Dockerfile per service + `docker compose up`;
  deploy anywhere and send live URLs; unit tests for business rules + one e2e happy path.
- Data model is ours to design: normalized schema (customers, properties, mortgages, requests +
  per-mortgage items) with keys/constraints/indexes so the DB protects the rules. Explain in README.
- **Hard requirement**: works 320px–1920px, WCAG 2.2 AA (IS 5568), zero axe violations on every
  screen, full keyboard + screen-reader support, focus moved to the step heading on each step change.
- Handover: GitHub repo, PRs + meaningful commits, never commit secrets (`.env.example` only),
  **tag the submitted commit `v1.0.0`**. README: how to run, architecture + caching decisions,
  trade-offs, what next, and how AI tools were used.

## Design assets

Figma is view-only (no MCP access). Exports live in `/Users/daniel/dev/moveo-design/`:
the five desktop screens (JPG), a giant overview PNG with the mobile lobby, the design tokens frame,
logos (`… (1)/Bank Moveo / Logo / *.svg`), `Gal.png` (the coral wave, 1920×300, drawn from the page
top), `Avatar.png` (header avatar, 30×30), `Icons.png` (accessibility symbol reference).
Daniel reads exact sizes from Figma's inspector and dictates them; apply them as given.

## Decisions already made (do not re-litigate)

- Monorepo with pnpm workspaces: `apps/api` (NestJS 11, `pg` + SQL migrations via node-pg-migrate,
  ioredis) and `apps/web` (Vite + React 19 + react-router 7 + TanStack Query).
- Schema in `apps/api/migrations/*.sql`. "One open request per mortgage" = partial unique index on
  `billing_day_request_items(mortgage_id) WHERE status='pending'` (status mirrored onto items for
  that reason). Idempotency = `Idempotency-Key` header (UUID) + `UNIQUE(customer_id, idempotency_key)`;
  replay returns the original with HTTP 200 and `replayed: true`. Fee and previous day are snapshotted
  on items. Effective month computed in `Asia/Jerusalem`.
- Lobby cache: cache-aside in Redis, key `lobby:v1:<customerId>`, TTL from env, deleted after a
  successful submit. Redis failures degrade to Postgres (never take the lobby down).
- Demo numbers in the Figma are internally inconsistent; we seed the per-mortgage data from the lobby
  cards and compute the summary from the DB. Say so in the README.
- **CSS**: plain CSS, px units only (no rem), tokens in `apps/web/src/styles/tokens.css`
  (colors + type scale `--fs-h1..--fs-caption` with `--fw-*` weights, straight from the Figma tokens
  frame). Shared styles in `src/styles/*.css`; component CSS lives next to its component and is
  imported by it. Typography is applied with classes (`h1`, `h2`, `h3`, `body`, `caption`); the tag
  carries semantics (e.g. lobby title is `<h1 className="h3">`).
- **Icons**: `@mui/icons-material` outlined variants, deep-imported directly where used
  (`import X from '@mui/icons-material/X'`), no wrapper component. Directional glyphs are mirrored
  for RTL with `scaleX(-1)`. Unread mail dot = MUI `Badge`. Accessibility icon is composed
  (`AccessibilityNewOutlined` inside a circle).
- Lobby title is not focused on mount; only the four wizard steps move focus to their heading.
- Header (desktop): stacked logo 48px, 40px side padding, 40px gap logo→account chip, tool buttons
  44×36 with 28px icons and 8px gap, divider between the two icon groups, chip text 16px/400.
  Nav: 56px bar, 2px flat underline on the current item, chevrons on menu items, favourites pushed to
  the end. Wave band 208px on desktop, nav 22px into it, title 70px below the nav.
- Breakpoints: 720 (tablet), 900 (flow rows become table-like), 1024 (lobby sidebar), 1200 (desktop
  proportions: 80px gutters, 208px band), ≤1499 nav text steps down to 14px.

## Running locally

- `docker compose up -d postgres redis` (host ports via root `.env`: `POSTGRES_PORT=5434`, because
  5432/5433 are taken on this Mac). API `.env` points at 5434.
- API: `cd apps/api && pnpm migrate:run`-equivalent is `pnpm exec tsx scripts/migrate.ts`, then
  `pnpm exec tsx scripts/seed.ts`, then `pnpm build && pnpm start` → **http://localhost:3001**
  (3000 is taken by an Excalidraw MCP server). Swagger at `/api/docs`.
- Web: `cd apps/web && pnpm dev` → **http://localhost:5173** (proxies `/api` to 3001).
- Tests: `pnpm test` in each app; e2e `pnpm e2e` in `apps/web` (Playwright + axe, desktop + 320px
  mobile projects; needs API + DB running). Reset demo state before a run:
  `docker exec bank-moveo-mortgages-postgres-1 psql -U moveo -d moveo -c "DELETE FROM billing_day_requests;"`
  and `docker exec bank-moveo-mortgages-redis-1 redis-cli FLUSHALL`.

## Status / what is left

Done: API (lobby, preview, create with idempotency, get by id, health), schema + seed, Redis cache,
web lobby + 4-step flow, focus management, unit tests (API rules, web formatting), Playwright happy
path with axe (written, last full run before the CSS split passed the walk-through; re-run it),
Dockerfiles + nginx + compose (written, **not yet built/verified**).

Still to do, in order:
1. Finish the Figma fidelity pass with Daniel (he dictates sizes). Known open item: the flow-screen
   header chip (400px wide with only the name) looks wrong; mobile screens not reviewed closely.
2. `docker compose up --build` end to end and fix whatever breaks.
3. `pnpm e2e` green on both projects.
4. README (run, architecture, caching, schema rationale, trade-offs, next steps, AI usage).
5. Git: first commit, feature-branch PRs, tag `v1.0.0`. Never commit `.env`.
6. Deploy: Railway (Postgres, Redis, API from Dockerfile) + Vercel (web, `VITE_API_BASE_URL` set to
   the API URL, API `CORS_ORIGINS` set to the Vercel URL). Both free for the demo window.

## Working style Daniel wants

- Small, explicit changes; he reviews each one in the browser. Ask before large refactors.
- No "clever" calculations in CSS when a Figma number exists; use the number.
- No wrapper abstractions for the sake of it (he removed the Icon wrapper).
- He pushes back when something is over-engineered; explain the trade-off in one or two sentences.
