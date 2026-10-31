# Deployment

Free tier, no credit card: **API on Render** (Docker), **Postgres on Neon**, **Redis on Upstash**,
**web on Vercel**. Everything deploys from this GitHub repository; pushing to `main` redeploys.

Known trade-off: Render's free web service sleeps after 15 minutes without traffic and takes
~30 s to wake. Open the live URL a minute before a demo, or `curl` the health endpoint.

## 1. Postgres on Neon

1. https://neon.tech → New project `bank-moveo-mortgages`, region EU (Frankfurt).
2. Copy the **connection string** (pooled is fine), it looks like
   `postgresql://…@….neon.tech/neondb?sslmode=require`.

Nothing else: the API image runs the migrations and the idempotent seed on every start.

## 2. Redis on Upstash

1. https://console.upstash.com → Create database `bank-moveo-lobby`, region EU (Ireland), free.
2. Copy the **ioredis** connection string: `rediss://default:…@….upstash.io:6379` (TLS).

## 3. API on Render

1. https://dashboard.render.com → **New → Blueprint**, pick this repository. `render.yaml` at the
   root defines the service: Docker build from `apps/api/Dockerfile` with the repo root as context,
   health check `/api/v1/health`, region Frankfurt, free plan.
2. When asked, fill the three secrets: `DATABASE_URL` (Neon), `REDIS_URL` (Upstash),
   `CORS_ORIGINS` (leave `https://placeholder.vercel.app` for now, updated in step 5).
3. Deploy. The URL is `https://bank-moveo-api.onrender.com`; check
   `https://bank-moveo-api.onrender.com/api/v1/health` →
   `{"status":"ok","database":"up","redis":"up"}` and the docs at `/api/docs`.

## 4. Web on Vercel

```bash
npm i -g vercel
vercel login
cd apps/web
vercel link                                   # new project: bank-moveo-mortgages
vercel env add VITE_API_BASE_URL production   # https://bank-moveo-api.onrender.com/api/v1
vercel --prod
```

`apps/web/vercel.json` holds the build settings and the SPA fallback. In the Vercel dashboard set
**Root Directory** to `apps/web` (*Settings → General*) so Git pushes build the right app.

## 5. Close the loop

1. Render → bank-moveo-api → *Environment*: set `CORS_ORIGINS` to the Vercel URL
   (comma-separated if you also want preview URLs). Render redeploys.
2. Smoke test: open the Vercel URL, complete one request end to end.
3. From `apps/web`: `E2E_BASE_URL=https://<web>.vercel.app pnpm e2e`.
4. Put both URLs in the README header, then `git tag v1.0.0 && git push --tags`.

## Resetting the demo

Each submitted request blocks its mortgage for further requests (one open request per mortgage).
To let reviewers start over: Neon → SQL editor → `DELETE FROM billing_day_requests;`, then
Upstash → CLI → `FLUSHALL`. Locally: `pnpm --filter @moveo/web e2e:reset`.
