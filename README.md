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

## Deployment

Push to `main` → Railway auto-deploys via GitHub integration.

**Railway env vars to set:**
- All 6 variables above
- `NIXPACKS_NODE_VERSION=20`

## How Payments Work

1. School generates payment URL: `https://www.minerval.org/pay/[school-code]`
2. Parent visits URL, enters student ID → sees student info + payment form
3. Parent enters phone + selects mobile money provider → submits
4. App calls proxy (`POST /pay`) which initiates SerdiPay C2B push
5. Parent receives USSD prompt on phone → confirms payment
6. SerdiPay calls `POST /api/serdipay/callback` → app records success, decrements `amount_due`
7. Parent is redirected to receipt page

## Database Schema

```sql
schools         — id, name, code (unique), admin_email
students        — id, school_id, external_id, full_name, class_name, amount_due
fees            — id, school_id, title, type (recurring/special), amount, active
payment_requests — id, student_id, school_id, amount, phone, telecom, status, serdipay_ref, settled_at
payment_events  — id, payment_request_id, event_type, payload (audit log)
```

## Running Tests

```bash
npm test
```

## Current Limitations (Phase 1)

- No multi-school data isolation (all schools share the same RLS-less DB)
- No email receipts
- No refunds
- No automated reconciliation (stale payments resolved manually in dashboard)
- Single admin per school
- No Excel import (CSV only)
