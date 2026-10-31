#!/usr/bin/env sh
# Puts the local demo back to its seeded state: no billing-day requests, empty lobby cache.
# The e2e submits real requests, so run this between runs (pnpm e2e:reset).
set -e
docker exec bank-moveo-mortgages-postgres-1 psql -U moveo -d moveo -c "DELETE FROM billing_day_requests;"
docker exec bank-moveo-mortgages-redis-1 redis-cli FLUSHALL
