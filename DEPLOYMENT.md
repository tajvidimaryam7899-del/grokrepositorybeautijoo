# Beautijoo — Production Deployment Guide

Two independent production packages (backend ZIP + frontend ZIP) are uploaded manually to Liara (or any Node + PostgreSQL host). Do **not** put real secrets in the repository.

## Architecture (unchanged)

| Component | Stack |
|-----------|--------|
| Backend | NestJS + Prisma + PostgreSQL (`/api/v1`) |
| Frontend | Next.js App Router (RTL Persian) |
| Auth | JWT access + refresh rotation, OTP (SMS provider abstraction) |
| Payments / SMS / Storage | Provider interfaces (mock in dev; real providers via env) |

---

## 1. PostgreSQL

1. Create a PostgreSQL instance (Liara DB or external).
2. Copy the connection string as `DATABASE_URL` (include `?schema=public` if required).
3. Backend must be able to reach the DB from the app host.

---

## 2. Backend deploy

### Build (on CI or locally before ZIP)

```bash
cd backend
npm ci
npx prisma generate
npm run build
```

`postinstall` runs `prisma generate`. Production start uses compiled output:

```bash
npm run start:prod   # node dist/main
```

### Migrations (against production DB)

```bash
export DATABASE_URL="postgresql://..."
npx prisma migrate deploy
# Optional one-time seed (change default admin password immediately):
# npm run prisma:seed
```

### Required environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `NODE_ENV` | yes | `production` |
| `PORT` | yes | Platform-assigned port (e.g. Liara) |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | yes | ≥ 32 characters; **no default in production** |
| `JWT_REFRESH_SECRET` | yes | ≥ 32 characters; different from access secret |
| `JWT_ACCESS_TTL` | no | default `15m` |
| `JWT_REFRESH_TTL` | no | default `7d` |
| `CORS_ORIGINS` | yes | Comma-separated frontend origins, e.g. `https://beautijoo.ir` |
| `SMS_PROVIDER` | no | `mock` until Iranian SMS is configured |
| `PAYMENT_PROVIDER` | no | `mock` until real gateway is configured |
| `STORAGE_PROVIDER` | no | `local` or configured provider |
| `STORAGE_LOCAL_PATH` | no | default `./uploads` |
| `OTP_TTL_SECONDS` | no | default `300` |
| `OTP_MAX_ATTEMPTS` | no | default `5` |

Never commit real secrets. Use platform secret store / env UI.

### Health

- `GET /api/v1/health` (public)
- Swagger (if enabled in build): `/api/docs`

---

## 3. Frontend deploy

### Build

```bash
cd frontend
npm ci
# Set public env *before* build (Next inlines NEXT_PUBLIC_* at build time)
export NEXT_PUBLIC_API_URL="https://api.example.com/api/v1"
export NEXT_PUBLIC_APP_URL="https://www.example.com"
export NEXT_PUBLIC_APP_NAME="Beautijoo"
npm run build
npm run start   # respects PORT from the host
```

### Required environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_API_URL` | yes | Backend base including `/api/v1` (no trailing slash required; client strips it) |
| `NEXT_PUBLIC_APP_URL` | yes | Canonical site origin for SEO / OG |
| `NEXT_PUBLIC_APP_NAME` | no | default `Beautijoo` |
| `PORT` | yes | Host-assigned; `next start` reads `PORT` |

Fallback `localhost` values in source are **dev-only**. Production builds must set the variables above before `next build`.

---

## 4. CORS and domain

1. Set backend `CORS_ORIGINS` to the exact frontend origin(s) (scheme + host, no path).
2. Point domain DNS to the frontend host; API subdomain (or path) to the backend host.
3. Enable HTTPS on the platform.

---

## 5. Post-deploy checklist

- [ ] `prisma migrate deploy` succeeded
- [ ] Backend health returns OK
- [ ] Frontend loads and calls API (no CORS errors)
- [ ] Login / OTP path works (SMS still mock until configured)
- [ ] Booking flow: profile → `/booking/[slug]` → slots from API → create booking
- [ ] Rotate seed admin password if seed was run
- [ ] Configure real **payment gateway** and **Iranian SMS** via existing provider abstractions

---

## 6. What this guide does not cover

- Creating Liara projects or uploading ZIP files (manual step by operator)
- Purchasing domain / SSL outside the host
- Provider-specific SMS or payment API keys (set only in host env)
