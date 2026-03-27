# School Payout (B2C) — Design Spec
**Date:** 2026-03-23
**Status:** Approved

---

## Overview

Schools collect tuition fees from parents via SerdiPay C2B (mobile money). Accumulated funds need to be disbursed back to school owners via SerdiPay B2C (`payment-client`). This feature adds a request-and-approve payout flow: the school owner submits a withdrawal request, the operator (Minerval admin) reviews and approves it, triggering an immediate B2C transfer. The school owner receives an email on completion or failure.

---

## Goals

- School owner can request a withdrawal of available balance to their mobile money number
- Operator reviews and approves pending requests via an admin panel
- Approval immediately triggers SerdiPay B2C call via proxy
- School owner notified by email on success or failure
- Available balance is calculated live (no drift risk)

---

## Non-Goals

- Automatic/instant withdrawals without operator approval
- Bank account transfers (mobile money only)
- Multi-currency payouts (school currency only)
- Batch scheduled payouts

---

## Architecture

```
School owner submits withdrawal form
         ↓
POST /api/dashboard/payouts/request
  → owner-role check
  → atomic balance check + INSERT (advisory lock prevents double-request)
  → INSERT school_payouts (status: pending)
         ↓
Operator sees request at /dashboard/admin/payouts
         ↓
POST /api/admin/payouts/[id]/approve
  → SUPER_ADMIN_EMAIL guard
  → atomic UPDATE status pending→processing (re-entrancy guard)
  → callProxyPayout() → proxy POST /payout → SerdiPay payment-client
  → proxy throw: status → failed, email owner
         ↓
POST /api/serdipay/payout-callback
  → verify reference matches payout id
  → status → completed or failed
  → send email to school owner (requested_by)
```

**Status flow:** `pending → processing → completed | failed`

---

## Database Schema

### New table: `school_payouts`

Migration file: `supabase/migrations/013_school_payouts.sql`

```sql
CREATE TABLE school_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES profiles(id),
  amount INT NOT NULL CHECK (amount > 0),
  phone TEXT NOT NULL,
  telecom TEXT NOT NULL CHECK (telecom IN ('AM', 'OM', 'MP', 'AF')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  serdipay_ref TEXT,
  serdipay_transaction_id TEXT,
  failure_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_school_payouts_school_id ON school_payouts(school_id);
CREATE INDEX idx_school_payouts_status ON school_payouts(school_id, status, created_at DESC);

-- RLS
ALTER TABLE school_payouts ENABLE ROW LEVEL SECURITY;

-- School members can read their own school's payouts
CREATE POLICY "school_members_read_payouts" ON school_payouts
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM school_memberships
      WHERE profile_id = auth.uid() AND active = true
    )
  );

-- Only service role can insert/update (all writes go through admin client)
-- No INSERT/UPDATE policies needed for anon/authenticated roles
```

### Available balance query (live, per school)

```sql
SELECT
  COALESCE(SUM(pr.amount - pr.fee_amount), 0)
  - COALESCE((
      SELECT SUM(amount) FROM school_payouts
      WHERE school_id = $1 AND status IN ('pending', 'processing')
    ), 0) AS available
FROM payment_requests pr
WHERE pr.school_id = $1 AND pr.status = 'success'
```

Only `pending` and `processing` payouts are reserved from the balance. `completed` payouts are already reflected in the C2B payment totals and must not be double-counted.

### Minimum payout amount

Enforce a minimum of **1,000** (in school currency units) at the API layer. Mobile money operators reject sub-threshold transfers; catching this at request time gives a clear error rather than a silent `failed` status from SerdiPay.

---

## Proxy Changes (`serdipay-proxy/index.js`)

### New function: `parsePayoutPayload(body)`
Validates: `amount` (positive number, ≥ 1000), `phone` (9–15 digits), `reference` (non-empty string), `telecom` (AM/OM/MP/AF).

### New function: `processPayout(config, payload)`
1. `getAccessToken(config)` — reuse existing function
2. POST to `${config.baseUrl}/merchant/payment-client` with Bearer token
3. Body: `{ api_id, api_password, merchantCode, merchant_pin, clientPhone: payload.phone, amount: payload.amount, currency: config.currency, telecom: payload.telecom, message: payload.reference, reference: payload.reference }`
4. Throw `SerdiPayError` on non-OK response

### New endpoint: `POST /payout`
- Same `x-proxy-secret` auth as `/pay`
- Same config validation as `/pay`
- Calls `parsePayoutPayload()` then `processPayout()`
- Same error handling shape as `/pay`

---

## Minerval Changes

### `lib/proxy.ts`
Add `callProxyPayout(payload: ProxyPayload): Promise<ProxyResponse>` — calls `PROXY_URL/payout` with same auth headers and timeout as `callProxy`. Always passes `callback_url: process.env.NEXT_PUBLIC_APP_URL + '/api/serdipay/payout-callback'` so SerdiPay B2C can deliver the async result.

### Migration: `supabase/migrations/013_school_payouts.sql`
Schema from above (table + indexes + RLS).

### `app/api/dashboard/payouts/request/route.ts` (new)
- `POST` only
- `getTenantContext()` — owner role check (403 otherwise)
- Parse + validate body: `amount` (≥ 1000), `phone`, `telecom`
- **Atomic balance check**: use `SELECT pg_advisory_xact_lock(school_id_hash)` then run balance query inside a transaction. If `amount > available`, return 422 "Insufficient balance". Otherwise INSERT `school_payouts` row with status `pending`. Lock is released at transaction end.
- Return `{ id, status: 'pending' }`

### `app/api/admin/payouts/[id]/approve/route.ts` (new)
- `POST` only
- Guard: authenticated user email must equal `SUPER_ADMIN_EMAIL` env var (403 otherwise)
- **Atomic re-entrancy guard**: `UPDATE school_payouts SET status='processing', approved_at=now(), approved_by=<email> WHERE id=$1 AND status='pending' RETURNING id` — if no row returned, payout is already processing/completed/failed; return 409.
- Call `callProxyPayout({ amount, phone, telecom, reference: payout.id, callback_url })`
- On `ProxyError`: UPDATE status → `failed`, set `failure_reason`; send failure email to `requested_by` owner
- Return updated payout

### `app/api/serdipay/payout-callback/route.ts` (new)
- `POST` only
- **Callback authentication**: verify `x-serdipay-secret` header matches `SERDIPAY_CALLBACK_SECRET` env var (401 if missing/wrong). If SerdiPay does not support a callback secret, document this as an accepted risk (obscure URL + idempotency mitigate replay risk).
- Parse body: `message` (payout id), `payment.status`, `payment.transactionId`
- Fetch `school_payouts` by id — if not found, return 200 (ignore unknown reference)
- On success: UPDATE status → `completed`, set `completed_at`, `serdipay_transaction_id`; send success email to `requested_by` owner email
- On failure: UPDATE status → `failed`, set `failure_reason`; send failure email to `requested_by` owner email
- Return 200 always (idempotent)

---

## UI

### `app/dashboard/payouts/page.tsx` (update)
- Add **Available Balance** card at top (live query)
- Add **WithdrawForm** component below balance card (owner-only — hidden for admin/finance/viewer)
- Add **Payout History** table below the form: shows owner's own payout requests with status (pending/processing/completed/failed), amount, phone, date — so owners can track their requests without waiting for email
- Existing settled C2B payments table remains unchanged

### `app/dashboard/payouts/WithdrawForm.tsx` (new)
- Fields: Amount (number, min 1000), Phone (text), Telecom (select: AM/OM/MP/AF)
- Show available balance as helper text; disable submit if amount > available or amount < 1000
- On submit: POST `/api/dashboard/payouts/request`
- On success: show "Withdrawal request submitted" and refresh page
- On 422: show "Insufficient balance"

### `app/dashboard/admin/payouts/page.tsx` (new)
- Gated: only visible if `session.user.email === SUPER_ADMIN_EMAIL`
- List all `pending` payouts across all schools: school name, amount, phone, telecom, requested at, requested by
- Each row has an **Approve** button → POST `/api/admin/payouts/[id]/approve`
- Show `processing`, `completed`, `failed` payouts below for history

---

## Email Notifications (Resend)

Two new email templates using existing Resend setup. Recipient is always the **profile who submitted the request** (`requested_by` → profiles.email), not a generic school owner lookup.

### Payout completed
- To: `requested_by` email
- Subject: "Your withdrawal has been sent"
- Body: "{amount} {currency} has been sent to {phone} ({telecom}). It should arrive shortly."

### Payout failed
- To: `requested_by` email
- Subject: "Your withdrawal could not be processed"
- Body: "Your withdrawal request of {amount} {currency} failed. Please contact support."

---

## Environment Variables

New variable required:
- `SERDIPAY_CALLBACK_SECRET` — shared secret for authenticating SerdiPay B2C callbacks (set if SerdiPay supports it)

Existing variables used:
- `PROXY_URL` / `PROXY_SECRET` — proxy auth
- `NEXT_PUBLIC_APP_URL` — used to build the callback URL
- `SUPER_ADMIN_EMAIL` — operator guard (must be set in production)
- Resend key — already configured

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Amount < 1,000 | 422 at request time, "Amount too low" |
| Amount > available balance | 422 at request time, "Insufficient balance" |
| Concurrent duplicate request (race condition) | Advisory lock ensures only one passes balance check |
| Non-owner tries to request | 403 |
| Non-super-admin tries to approve | 403 |
| Approve called twice (double-click) | 409 — atomic guard prevents double B2C call |
| SerdiPay B2C call fails | status → failed, failure email sent |
| Callback arrives for unknown payout id | 200 (ignored) |
| Duplicate callback | 200 (idempotent UPDATE) |
| Invalid callback secret | 401 |

---

## Testing

- Unit: balance calculation — zero collected, pending payouts reserved, completed not double-counted
- Unit: `parsePayoutPayload` validation — amount floor, phone format, telecom values
- Unit: race condition — concurrent requests against same school, only one succeeds
- Integration: `/api/dashboard/payouts/request` — insufficient balance, non-owner role, amount below minimum
- Integration: `/api/admin/payouts/[id]/approve` — proxy success path, proxy failure path, double-approve returns 409
- Integration: `/api/serdipay/payout-callback` — success and failure callbacks, unknown id ignored
- E2E smoke: owner submits request → appears in admin panel → approve → callback → status completed → email sent
