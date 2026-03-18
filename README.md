# Minerval

School fee payment platform for Congo. Parents pay school fees via mobile money (Airtel, Orange, Vodacom-Mpesa, Afrimoney) using SerdiPay.

## Architecture

```
Browser → Railway (Next.js) → Hetzner proxy (proxy.minerval.org) → SerdiPay
                    ↕
              Supabase (Postgres)
```

- **Main app**: Next.js 16 on Railway (`www.minerval.org`)
- **Proxy**: Node.js on Hetzner with a fixed IP whitelisted by SerdiPay. Handles token auth and forwards payment requests.
- **Database**: Supabase Postgres (server-side only, service key)
- **Auth**: Supabase Auth with cookie-based sessions (`@supabase/ssr`)

### Two Supabase clients
- `getAdminClient()` — service key, bypasses RLS, used for all data operations
- `createSSRClient()` — anon key + cookies, used only for session management

## Local Setup

```bash
git clone https://github.com/Rodriguez7/minerval.git
cd minerval
npm install
cp .env.local.example .env.local  # fill in values
npm run dev
```

### Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-side only) |
| `SUPABASE_ANON_KEY` | Supabase anon/public key (for auth sessions) |
| `NEXT_PUBLIC_APP_URL` | App base URL (e.g. `https://www.minerval.org`) |
| `PROXY_URL` | Hetzner proxy URL (e.g. `https://proxy.minerval.org`) |
| `PROXY_SECRET` | Shared secret for main app → proxy auth |

Get keys from: **Supabase Dashboard → Settings → API**

An example app env file now exists in [`.env.local.example`](/Users/rod/20%20Apps/Minerval/minerval/.env.local.example).

## Deployment

Push to `main` → Railway auto-deploys via GitHub integration.

Railway config is checked in via [`railway.toml`](/Users/rod/20%20Apps/Minerval/minerval/railway.toml). The configured healthcheck is `GET /api/health`.

**Railway env vars to set:**
- All 6 variables above
- `NIXPACKS_NODE_VERSION=20`

### Fixed-IP Proxy

The fixed-IP SerdiPay proxy now lives in [`proxy/`](/Users/rod/20%20Apps/Minerval/minerval/proxy). It includes:

- a deployable Express service
- PM2 config for Hetzner
- a dedicated env example in [`proxy/.env.example`](/Users/rod/20%20Apps/Minerval/minerval/proxy/.env.example)

## How Payments Work

1. School shares its active QR code or revocable payment URL: `https://www.minerval.org/pay/access/[token]`
2. Parent opens the link, enters student ID → sees student info + payment form
3. Parent enters phone + selects mobile money provider → submits
4. App calls proxy (`POST /pay`) which initiates SerdiPay C2B push
5. Parent receives USSD prompt on phone → confirms payment
6. SerdiPay calls `POST /api/serdipay/callback` → app records success, decrements `amount_due`
7. Parent is redirected to receipt page

## Database Schema

```sql
schools         — id, name, code (unique), admin_email
                — payment_access_token (unique, revocable public payment token)
students        — id, school_id, external_id, full_name, class_name, amount_due
fees            — id, school_id, title, type (recurring/special), amount, active
payment_requests — id, student_id, school_id, amount, phone, telecom, status, serdipay_ref, settled_at
                — reconciliation_status, reconciliation_note, reconciliation_updated_at, reconciliation_updated_by
payment_events  — id, payment_request_id, event_type, payload (audit log)
```

## Admin Operations

- Reconciliation queue with stale pending detection, manual review, and override actions
- Reports dashboard with date filters, daily rollups, reconciliation breakdown, and CSV export
- Audit trail entries written to `payment_events` for reconciliation updates

## Running Tests

```bash
npm test
npm run test:e2e
```

The committed Playwright suite seeds its own school, student, and payment rows through Supabase service-role access, then verifies login, dashboard, reconciliation, reports, CSV export, and the public payment lookup flow.

## Current Limitations (Phase 1)

- No multi-school data isolation (all schools share the same RLS-less DB)
- No email receipts
- No refunds
- No provider-side settlement import yet (reconciliation is still managed from the dashboard)
- Single admin per school
- No Excel import (CSV only)
