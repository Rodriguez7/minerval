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
| `SERDIPAY_CALLBACK_SECRET` | Shared secret authenticating SerdiPay callbacks |
| `HEALTHCHECK_SECRET` | Bearer token for `GET /api/health?deep=1` |
| `OPERATIONS_ALERT_EMAIL` | Recipient for critical financial and webhook alerts |
| `RESEND_API_KEY` / `EMAIL_FROM` | Transactional email delivery configuration |
| `EMAIL_DOMAIN` | Verified Resend sender domain; public support/privacy addresses must use it |

Get keys from: **Supabase Dashboard → Settings → API**

An example app env file now exists in [`.env.local.example`](/Users/rod/20%20Apps/Minerval/minerval/.env.local.example).

## Deployment

Push to `main` → Railway auto-deploys via GitHub integration.

Railway config is checked in via [`railway.toml`](/Users/rod/20%20Apps/Minerval/minerval/railway.toml). The configured liveness check is `GET /api/health`. External monitoring should call `GET /api/health?deep=1` with `Authorization: Bearer $HEALTHCHECK_SECRET` to verify Supabase, the SerdiPay proxy, and production configuration.

The public legal pages are `/privacy`, `/terms`, and `/refunds` (with `/fr` and `/en` locale prefixes). Production must set `LEGAL_ENTITY_NAME`, `LEGAL_ENTITY_ADDRESS`, `LEGAL_CONTACT_EMAIL`, and `PRIVACY_CONTACT_EMAIL`; the deep health check reports a degraded state when any are missing. Account creation records the accepted legal version in the user's authentication metadata.

Before enabling production email, verify `EMAIL_DOMAIN` in Resend (including its DNS records), set `EMAIL_FROM` to a mailbox on that domain, and create or route the public support and privacy addresses. The deep health check rejects malformed or split-domain sender/contact configuration, but DNS verification and inbox delivery still require a real delivery test.

**Railway env vars to set:**
- All variables listed above that apply to the deployed service
- `NIXPACKS_NODE_VERSION=20`

### Fixed-IP Proxy

The fixed-IP SerdiPay proxy now lives in [`serdipay-proxy/`](/Users/rod/20%20Apps/Minerval/minerval/serdipay-proxy). It includes:

- a deployable Express service
- PM2 config for Hetzner
- a dedicated env example in [`serdipay-proxy/.env.example`](/Users/rod/20%20Apps/Minerval/minerval/serdipay-proxy/.env.example)

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
