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
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile public site key. Read at **build** time, so changing it needs a rebuild, not a restart. See [Captcha](#captcha) before changing it |
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

Key columns only — see `supabase/` migrations for the authoritative definition.

```sql
-- Tenancy
schools         — id, name, code (unique), admin_email, currency, timezone
                — payment_access_token (unique, revocable public payment token)
                — student_id_prefix, student_id_seq, education_levels, logo_url
                — verification_status, legal_name, registration_number, director_*
school_memberships — id, school_id, user_id, role, status
                   — role is one of: owner | admin | finance | viewer
school_invites  — pending invitations to join a school
profiles        — per-user profile data

-- Core domain
students        — id, school_id, external_id, full_name, class_name, amount_due
                — balance_due_at, reminder_cycle_id, reminders_paused_until, reminder_stop_reason
guardians       — school-scoped responsible payer, normalized WhatsApp number, French-only messaging and consent/opt-out state
student_guardians — primary guardian relationship for each student
student_payment_links — hashed, expiring and revocable personalized payment-link tokens
school_whatsapp_settings — automatic reminder switch, local send hour and maximum attempts
whatsapp_messages — durable Meta outbox, delivery state, errors and audit history
fees            — id, school_id, title, type (recurring/special), amount, active

-- Payments in
payment_requests — id, student_id, school_id, amount, phone, telecom, status, serdipay_ref, settled_at
                 — reconciliation_status, reconciliation_note, reconciliation_updated_at, reconciliation_updated_by
payment_events   — id, payment_request_id, event_type, payload (audit log)

-- Payouts out
school_payouts  — id, school_id, status, net_amount, phone, telecom
                — approved_at, approved_by, failure_reason
                — status transitions are guarded atomically; see the approve route

-- Billing
plans                   — code, name, monthly_price_usd, capability flags, max_students
school_subscriptions    — school_id, plan_code, status, trial_ends_at, current_period_end
                        — billing_exempt, stripe_customer_id
school_pricing_policies — per-school pricing overrides
billing_events          — Stripe webhook audit log
```

Migration `023_automatic_whatsapp_reminders.sql` adds the reminder schema. Existing unpaid students receive a balance-cycle ID but remain ineligible until the school supplies a guardian, consent record, and due date.

Dashboard queries run through `getAdminClient()` (service key, bypasses RLS) and are scoped in application code by the `school_id` from `getTenantContext()`. RLS migrations 007, 023, and 024 separately protect direct Data API access.

## Admin Operations

- Reconciliation queue with stale pending detection, manual review, and override actions
- Reports dashboard with date filters, daily rollups, reconciliation breakdown, and CSV export
- Audit trail entries written to `payment_events` for reconciliation updates
- Payout approval is restricted to `SUPER_ADMIN_EMAIL` and is re-entrancy guarded: the status
  transition only succeeds while the payout is still `pending`. An ambiguous response from
  SerdiPay leaves the balance reserved for manual verification rather than assuming failure.

## Running Tests

```bash
npm test                    # unit and integration (vitest)
npm run test:e2e            # browser suite against a local dev server
npm run test:e2e:production # browser suite against deployed production
```

The local Playwright suite seeds its own school, student, and payment rows through Supabase service-role access, then verifies login, dashboard, reconciliation, reports, CSV export, and the public payment lookup flow.

`test:e2e:production` is separate ([`playwright.production.mjs`](/Users/rod/20%20Apps/Minerval/minerval/playwright.production.mjs)) and targets a deployed URL, defaulting to production and overridable with `PRODUCTION_URL`. It starts no server and reads no `.env.local`. See [Monitoring](#monitoring).

## Captcha

Cloudflare Turnstile guards `/login`, `/signup`, and `/forgot-password`. Three things must agree, and if any one of them is wrong the failure is **silent**:

1. **`NEXT_PUBLIC_TURNSTILE_SITE_KEY`** (Railway) — when set, the forms disable their submit button until Turnstile issues a token.
2. **The CSP** in [`next.config.ts`](/Users/rod/20%20Apps/Minerval/minerval/next.config.ts) — must permit `https://challenges.cloudflare.com` in `script-src`, `frame-src`, **and** `connect-src`. The widget loads a script, renders an iframe, and calls home; each is blocked by a different directive.
3. **Supabase** — Authentication → Attack Protection → CAPTCHA enabled, provider Turnstile, secret key from the *Minerval* widget (the account has more than one).

Verification is Supabase's job, not ours: [`app/actions/auth.ts`](/Users/rod/20%20Apps/Minerval/minerval/app/actions/auth.ts) forwards `captchaToken` to Supabase Auth, which checks it against the secret. There is no verification endpoint in this app.

### Why order matters

`Turnstile` renders nothing when the site key is unset, and the forms gate their submit button on `captchaRequired && !captchaToken`. So a site key **without** a working widget disables every auth form permanently — the button never enables and no one can sign in or register. Conversely, enabling CAPTCHA in Supabase before tokens flow makes Supabase reject every auth request.

When changing any of the three, go in this order:

1. Deploy the CSP change first.
2. Set the site key in Railway, **rebuild**, and confirm the widget actually renders in a browser.
3. Only then enable CAPTCHA in Supabase.

To disable captcha, reverse it: turn it off in Supabase first, then clear the site key.

This exact ordering was learned the hard way — a site key deployed against a CSP that blocked Turnstile took password login and signup down for about an hour while every server-side signal stayed green. `e2e/production/auth-availability.spec.ts` exists to catch that recurrence.

## Monitoring

Two independent scheduled checks run every ten minutes ([`.github/workflows/production-health.yml`](/Users/rod/20%20Apps/Minerval/minerval/.github/workflows/production-health.yml)):

- **Deep health** — `GET /api/health?deep=1` verifies Supabase, the SerdiPay proxy, and production configuration.
- **Browser availability** — `npm run test:e2e:production` loads the real auth pages and asserts they present a usable submit path.

The second exists because the first cannot see client-side breakage. A CSP that blocks the captcha leaves the server perfectly healthy while no one can log in, so the browser check must keep running even when the health check is green.

It deliberately does **not** assert that a captcha token arrives: Turnstile challenges headless browsers from datacenter IPs, so that would fail from CI while production is fine. It asserts the invariants instead — that the page never ships a script its own CSP forbids, and that `window.turnstile` actually executes.

## Current Limitations

- Dashboard data operations run through the service-role client; RLS (migrations 007/023/024) protects the Data API surface, but school scoping in server code must come from `getTenantContext()`, never from request input
- No email receipts
- No refunds
- No provider-side settlement import yet (reconciliation is still managed from the dashboard)
- No Excel import (CSV only)
- Automatic WhatsApp reminders are implemented but not production-enabled until Meta templates, secrets, Cloudflare bypasses, migration `023`, and the pilot are complete
