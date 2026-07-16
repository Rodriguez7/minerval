# Minerval

School fee payment platform for Congo. Parents pay school fees via mobile money (Airtel, Orange, Vodacom-Mpesa, Afrimoney) using SerdiPay.

## Architecture

```
Browser → Railway (Next.js) → Hetzner proxy (proxy.minerval.org) → SerdiPay
                    ↕
              Supabase (Postgres)
```

Automatic reminders use an independent notification path:

```
GitHub scheduler → Railway reminder worker → Meta WhatsApp Cloud API
                              ↕
                        Supabase outbox
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
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile public site key; leave empty until Supabase CAPTCHA is configured |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | Set to `true` only after the Supabase Google provider is configured |
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

The scheduled GitHub Actions monitor calls that deep endpoint every ten minutes. Keep Railway's `HEALTHCHECK_SECRET` and the repository secret `MINERVAL_HEALTHCHECK_SECRET` identical. A non-200 response or any degraded dependency fails the monitor and triggers the repository's configured Actions failure notifications.

The public legal pages are `/privacy`, `/terms`, and `/refunds` (with `/fr` and `/en` locale prefixes). Production must set `LEGAL_ENTITY_NAME`, `LEGAL_CONTACT_EMAIL`, and `PRIVACY_CONTACT_EMAIL`. `LEGAL_ENTITY_ADDRESS` is optional and is displayed only when configured. The deep health check reports a degraded state when a required legal value is missing. Account creation records the accepted legal version in the user's authentication metadata.

Before enabling production email, verify `EMAIL_DOMAIN` in Resend (including its DNS records), set `EMAIL_FROM` to a mailbox on that domain, and create or route the public support and privacy addresses. The deep health check rejects malformed or split-domain sender/contact configuration, but DNS verification and inbox delivery still require a real delivery test.

**Railway env vars to set:**
- All variables listed above that apply to the deployed service
- `NIXPACKS_NODE_VERSION=22`

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

## Automatic WhatsApp Reminders

The implementation replaces the unfinished manual WhatsApp reminder experiment with automatic payment reminders through Meta's WhatsApp Cloud API. Production sending remains gated on applying migration `023`, creating and approving the Meta templates, configuring secrets, extending the Cloudflare server-to-server bypass rule, and completing the pilot rollout.

- A parent or guardian name, WhatsApp number, relationship, and consent record will be required when a school adds or imports a student. WhatsApp messages are French-only in the first release.
- Every unpaid balance with a due date will enter a fixed reminder sequence automatically. Schools will not create campaigns or select students.
- Minerval will initially send French-only approved utility templates from one verified Minerval WhatsApp Business number.
- Each message will contain a secure, revocable `Payer maintenant` link that loads the student's current balance and existing SerdiPay payment form.
- Meta webhooks will record sent, delivered, read, and failed states.
- A successful SerdiPay callback will cancel remaining reminders immediately.
- Schools will be able to pause automation globally or for one student, while automatic enrollment remains the default.
- The WhatsApp channel will use Meta directly. Twilio, SMS, email fallback, and unofficial WhatsApp libraries are outside this phase.

The implementation sequence, schema, security requirements, recovered work assessment, tests, and rollout gates are documented in [`docs/superpowers/plans/2026-07-16-automatic-whatsapp-payment-reminders.md`](docs/superpowers/plans/2026-07-16-automatic-whatsapp-payment-reminders.md).

Production requires these server-side values:

| Variable | Description |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Meta permanent system-user access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Minerval WhatsApp sending-number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Minerval WhatsApp Business Account ID |
| `WHATSAPP_APP_SECRET` | Secret used to verify webhook signatures |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Token used for Meta webhook subscription verification |
| `WHATSAPP_GRAPH_API_VERSION` | Explicit supported Meta Graph API version |
| `WHATSAPP_REMINDER_CRON_SECRET` | Secret authenticating the scheduled reminder worker |

## Database Schema

```sql
schools         — id, name, code (unique), admin_email
                — payment_access_token (unique, revocable public payment token)
students        — id, school_id, external_id, full_name, class_name, amount_due
                — balance_due_at, reminder_cycle_id, reminders_paused_until, reminder_stop_reason
guardians       — school-scoped responsible payer, normalized WhatsApp number, French-only messaging and consent/opt-out state
student_guardians — primary guardian relationship for each student
student_payment_links — hashed, expiring and revocable personalized payment-link tokens
school_whatsapp_settings — automatic reminder switch, local send hour and maximum attempts
whatsapp_messages — durable Meta outbox, delivery state, errors and audit history
fees            — id, school_id, title, type (recurring/special), amount, active
payment_requests — id, student_id, school_id, amount, phone, telecom, status, serdipay_ref, settled_at
                — reconciliation_status, reconciliation_note, reconciliation_updated_at, reconciliation_updated_by
payment_events  — id, payment_request_id, event_type, payload (audit log)
```

Migration `023_automatic_whatsapp_reminders.sql` adds the reminder schema. Existing unpaid students receive a balance-cycle ID but remain ineligible until the school supplies a guardian, consent record, and due date.

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

- Dashboard data operations run through the service-role client; RLS (migrations 007/023/024) protects the Data API surface, but school scoping in server code must come from `getTenantContext()`, never from request input
- No email receipts
- No refunds
- No provider-side settlement import yet (reconciliation is still managed from the dashboard)
- Single admin per school
- No Excel import (CSV only)
- Automatic WhatsApp reminders are implemented but not production-enabled until Meta templates, secrets, Cloudflare bypasses, migration `023`, and the pilot are complete
