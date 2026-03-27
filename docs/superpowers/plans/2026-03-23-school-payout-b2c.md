# School Payout (B2C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow school owners to request withdrawals of their collected balance, approved by the Minerval operator, disbursed via SerdiPay B2C mobile money.

**Architecture:** School owner submits a withdrawal request stored as `pending` in `school_payouts`. Operator approves via admin panel, which atomically flips status to `processing` and calls `proxy POST /payout` → SerdiPay `payment-client`. SerdiPay sends an async callback to confirm completion. School owner receives an email on success or failure.

**Tech Stack:** Next.js 16 App Router, Supabase (admin client + RPC for atomic operations), Vitest, Resend (new dependency), Express proxy service

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/013_school_payouts.sql` | Table, indexes, RLS, atomic request RPC |
| Modify | `serdipay-proxy/index.js` | Add `parsePayoutPayload`, `processPayout`, `POST /payout` |
| Modify | `lib/proxy.ts` | Add `callProxyPayout` |
| Create | `lib/email.ts` | Resend client, payout email helpers |
| Create | `app/api/dashboard/payouts/request/route.ts` | Owner-only payout request API |
| Create | `app/api/admin/payouts/[id]/approve/route.ts` | Operator approval API |
| Create | `app/api/serdipay/payout-callback/route.ts` | B2C callback handler |
| Modify | `app/dashboard/payouts/page.tsx` | Add balance card, WithdrawForm, payout history |
| Create | `app/dashboard/payouts/WithdrawForm.tsx` | Withdrawal form component |
| Create | `app/dashboard/admin/payouts/page.tsx` | Operator admin panel |
| Create | `__tests__/payout-request.test.ts` | Request route tests |
| Create | `__tests__/payout-approve.test.ts` | Approve route tests |
| Create | `__tests__/payout-callback-b2c.test.ts` | Payout callback tests |
| Modify | `vitest.config.ts` | Add test env vars |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/013_school_payouts.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/013_school_payouts.sql

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

CREATE POLICY "school_members_read_payouts" ON school_payouts
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM school_memberships
      WHERE profile_id = auth.uid() AND active = true
    )
  );

-- Atomic payout request function: advisory lock + balance check + insert in one transaction
CREATE OR REPLACE FUNCTION request_school_payout(
  p_school_id UUID,
  p_requested_by UUID,
  p_amount INT,
  p_phone TEXT,
  p_telecom TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available BIGINT;
  v_payout_id UUID;
BEGIN
  -- Advisory lock scoped to this school (prevents concurrent double-requests)
  PERFORM pg_advisory_xact_lock(hashtext(p_school_id::text));

  -- Calculate available balance: collected minus in-flight payouts
  SELECT
    COALESCE(SUM(pr.amount - pr.fee_amount), 0)
    - COALESCE((
        SELECT SUM(sp.amount)
        FROM school_payouts sp
        WHERE sp.school_id = p_school_id AND sp.status IN ('pending', 'processing')
      ), 0)
  INTO v_available
  FROM payment_requests pr
  WHERE pr.school_id = p_school_id AND pr.status = 'success';

  IF p_amount > v_available THEN
    RETURN jsonb_build_object('error', 'insufficient_balance', 'available', v_available);
  END IF;

  INSERT INTO school_payouts (school_id, requested_by, amount, phone, telecom)
  VALUES (p_school_id, p_requested_by, p_amount, p_phone, p_telecom)
  RETURNING id INTO v_payout_id;

  RETURN jsonb_build_object('id', v_payout_id, 'status', 'pending');
END;
$$;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the Supabase MCP tool `apply_migration` with the SQL above. Verify the migration appears in `supabase/migrations/`.

- [ ] **Step 3: Verify table exists**

Run in Supabase SQL Editor or via MCP `execute_sql`:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'school_payouts' ORDER BY ordinal_position;
```
Expected: 14 columns including `id`, `school_id`, `status`, `telecom`, etc.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/013_school_payouts.sql
git commit -m "feat: add school_payouts table with atomic request RPC"
```

---

## Task 2: Proxy B2C Endpoint

**Files:**
- Modify: `serdipay-proxy/index.js`

The proxy already has `parsePaymentPayload`, `processPayment`, and `POST /pay` for C2B. You are adding the B2C mirror: `parsePayoutPayload`, `processPayout`, and `POST /payout`. Follow the exact same pattern.

- [ ] **Step 1: Add `parsePayoutPayload` after `parsePaymentPayload` in `serdipay-proxy/index.js`**

Insert after line 70 (end of `parsePaymentPayload`):

```javascript
function parsePayoutPayload(body) {
  const amount = Number(body?.amount);
  const phone = String(body?.phone || "").trim();
  const reference = String(body?.reference || "").trim();
  const telecom = String(body?.telecom || "").trim().toUpperCase();

  if (!Number.isFinite(amount) || amount < 1000) {
    throw new Error("amount must be a number >= 1000");
  }

  if (!/^\d{9,15}$/.test(phone)) {
    throw new Error("phone must be 9 to 15 digits");
  }

  if (!reference) {
    throw new Error("reference is required");
  }

  if (!VALID_TELECOMS.has(telecom)) {
    throw new Error("telecom must be one of AM, OM, MP, AF");
  }

  return { amount, phone, reference, telecom };
}
```

- [ ] **Step 2: Add `processPayout` after `processPayment`**

Insert after line 145 (end of `processPayment`):

```javascript
async function processPayout(config, payload) {
  const accessToken = await getAccessToken(config);

  const payoutBody = {
    api_id: config.apiId,
    api_password: config.apiPassword,
    merchantCode: config.merchantCode,
    merchant_pin: config.merchantPin,
    clientPhone: payload.phone,
    amount: payload.amount,
    currency: config.currency,
    telecom: payload.telecom,
    message: payload.reference,
    reference: payload.reference,
  };

  const { data, response } = await fetchJson(
    `${config.baseUrl}/merchant/payment-client`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payoutBody),
    }
  );

  if (!response.ok) {
    throw new SerdiPayError(
      data?.message || `SerdiPay payout failed with ${response.status}`,
      response.status,
      data,
      "payment"
    );
  }

  return { data, status: response.status };
}
```

- [ ] **Step 3: Add `POST /payout` endpoint after `POST /pay`**

Insert after line 220 (end of `/pay` handler, before the `app.listen` block):

```javascript
app.post("/payout", async (req, res) => {
  const requestId = crypto.randomUUID();
  const config = getConfig();

  if (req.get("x-proxy-secret") !== config.proxySecret) {
    return res.status(401).json({ error: "Unauthorized", requestId });
  }

  const missingConfigKeys = getMissingConfigKeys(config);
  if (missingConfigKeys.length > 0) {
    return res.status(503).json({
      error: "Proxy is not fully configured",
      missingConfigKeys,
      requestId,
    });
  }

  let payload;
  try {
    payload = parsePayoutPayload(req.body);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid payload",
      requestId,
    });
  }

  try {
    const result = await processPayout(config, payload);
    return res.status(result.status).json(result.data);
  } catch (error) {
    if (error instanceof SerdiPayError) {
      if (error.stage === "payment") {
        return res.status(error.status).json({
          error: error.message,
          details: error.details,
          requestId,
        });
      }

      return res.status(502).json({
        error: "Unable to authenticate with SerdiPay",
        details: error.details,
        requestId,
      });
    }

    console.error("Proxy payout request failed", {
      message: error instanceof Error ? error.message : "Unknown error",
      requestId,
    });

    return res.status(500).json({
      error: "Unexpected proxy error",
      requestId,
    });
  }
});
```

- [ ] **Step 4: Smoke test the proxy health endpoint still works**

```bash
cd "/Users/rod/20 Apps/Minerval/minerval/proxy"
node --input-type=module <<'EOF'
import express from 'express';
console.log('Syntax check passed');
EOF
```

Or just verify the file parses without error:
```bash
node --check "/Users/rod/20 Apps/Minerval/minerval/serdipay-proxy/index.js"
```
Expected: no output (syntax OK).

- [ ] **Step 5: Commit**

```bash
git add serdipay-proxy/index.js
git commit -m "feat: add POST /payout B2C endpoint to proxy"
```

---

## Task 3: `callProxyPayout` in `lib/proxy.ts`

**Files:**
- Modify: `lib/proxy.ts`

- [ ] **Step 1: Add `callProxyPayout` to `lib/proxy.ts`**

Append after the existing `callProxy` function:

```typescript
export async function callProxyPayout(payload: ProxyPayload): Promise<ProxyResponse> {
  const proxyUrl = process.env.PROXY_URL;
  const proxySecret = process.env.PROXY_SECRET;
  if (!proxyUrl || !proxySecret) throw new Error("Missing PROXY_URL or PROXY_SECRET");

  const res = await fetch(`${proxyUrl}/payout`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-proxy-secret": proxySecret,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data?.details?.message || data?.error || `Proxy error: ${res.status}`;
    throw new ProxyError(message, res.status, data);
  }

  return data;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/rod/20 Apps/Minerval/minerval"
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors related to `lib/proxy.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/proxy.ts
git commit -m "feat: add callProxyPayout to lib/proxy.ts"
```

---

## Task 4: Email Utility (`lib/email.ts`)

**Files:**
- Create: `lib/email.ts`

Resend is not yet installed. Install it first, then create a minimal email helper used only for payout notifications.

- [ ] **Step 1: Install Resend**

```bash
cd "/Users/rod/20 Apps/Minerval/minerval"
npm install resend
```

Expected: `resend` appears in `package.json` dependencies.

- [ ] **Step 2: Create `lib/email.ts`**

```typescript
import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY");
  return new Resend(key);
}

export async function sendPayoutCompletedEmail(opts: {
  to: string;
  amount: number;
  currency: string;
  phone: string;
  telecom: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Minerval <no-reply@minerval.app>",
    to: opts.to,
    subject: "Your withdrawal has been sent",
    text: `${opts.amount} ${opts.currency} has been sent to ${opts.phone} (${opts.telecom}). It should arrive shortly.`,
  });
}

export async function sendPayoutFailedEmail(opts: {
  to: string;
  amount: number;
  currency: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Minerval <no-reply@minerval.app>",
    to: opts.to,
    subject: "Your withdrawal could not be processed",
    text: `Your withdrawal request of ${opts.amount} ${opts.currency} failed. Please contact support.`,
  });
}
```

- [ ] **Step 3: Add env vars to `.env` (local dev)**

Add these to `/Users/rod/20 Apps/Minerval/minerval/.env` (do NOT commit `.env`):
```
RESEND_API_KEY=re_...your_key...
EMAIL_FROM=Minerval <no-reply@yourdomain.com>
SERDIPAY_CALLBACK_SECRET=your_secret_here
SUPER_ADMIN_EMAIL=your@email.com
```

- [ ] **Step 4: Commit**

```bash
git add lib/email.ts package.json package-lock.json
git commit -m "feat: add Resend email helpers for payout notifications"
```

---

## Task 5: Payout Request API Route

**Files:**
- Create: `app/api/dashboard/payouts/request/route.ts`
- Create: `__tests__/payout-request.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Add test env vars to `vitest.config.ts`**

In the `env` block of `vitest.config.ts`, add:
```typescript
SUPER_ADMIN_EMAIL: "admin@test.com",
SERDIPAY_CALLBACK_SECRET: "test-callback-secret",
NEXT_PUBLIC_APP_URL: "http://localhost:3000",
```

- [ ] **Step 2: Write the failing tests in `__tests__/payout-request.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({ getAdminClient: vi.fn() }));
vi.mock("../lib/tenant", () => ({ getTenantContext: vi.fn() }));

import { POST } from "../app/api/dashboard/payouts/request/route";
import { NextRequest } from "next/server";
import { getAdminClient } from "../lib/supabase";
import { getTenantContext } from "../lib/tenant";

type AdminClient = ReturnType<typeof getAdminClient>;

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/dashboard/payouts/request", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function asAdminClient(client: { rpc: unknown }) {
  return client as unknown as AdminClient;
}

const mockContext = {
  user: { id: "user-uuid", email: "owner@test.com" },
  school: { id: "school-uuid", name: "Test School", currency: "FC" },
  membership: { role: "owner" },
};

describe("POST /api/dashboard/payouts/request", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 403 if role is not owner", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce({
      ...mockContext,
      membership: { role: "admin" },
    } as never);

    const res = await POST(makeRequest({ amount: 5000, phone: "0812345678", telecom: "OM" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 if amount < 1000", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce(mockContext as never);

    const res = await POST(makeRequest({ amount: 500, phone: "0812345678", telecom: "OM" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 if telecom is invalid", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce(mockContext as never);

    const res = await POST(makeRequest({ amount: 5000, phone: "0812345678", telecom: "ZZ" }));
    expect(res.status).toBe(400);
  });

  it("returns 422 if RPC returns insufficient_balance", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce(mockContext as never);
    const mockRpc = vi.fn().mockResolvedValueOnce({
      data: { error: "insufficient_balance", available: 2000 },
      error: null,
    });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ rpc: mockRpc }));

    const res = await POST(makeRequest({ amount: 5000, phone: "0812345678", telecom: "OM" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/insufficient/i);
  });

  it("returns 201 with payout id on success", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce(mockContext as never);
    const mockRpc = vi.fn().mockResolvedValueOnce({
      data: { id: "payout-uuid", status: "pending" },
      error: null,
    });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ rpc: mockRpc }));

    const res = await POST(makeRequest({ amount: 5000, phone: "0812345678", telecom: "OM" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("payout-uuid");
    expect(body.status).toBe("pending");
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd "/Users/rod/20 Apps/Minerval/minerval"
npx vitest run __tests__/payout-request.test.ts 2>&1 | tail -20
```
Expected: FAIL — `Cannot find module '../app/api/dashboard/payouts/request/route'`

- [ ] **Step 4: Create `app/api/dashboard/payouts/request/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";

const VALID_TELECOMS = new Set(["AM", "OM", "MP", "AF"]);
const MIN_AMOUNT = 1000;

export async function POST(req: NextRequest) {
  const { user, school, membership } = await getTenantContext();

  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Only school owners can request payouts" }, { status: 403 });
  }

  let body: { amount?: unknown; phone?: unknown; telecom?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amount = Number(body.amount);
  const phone = String(body.phone ?? "").trim();
  const telecom = String(body.telecom ?? "").trim().toUpperCase();

  if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
    return NextResponse.json(
      { error: `Amount must be at least ${MIN_AMOUNT}` },
      { status: 400 }
    );
  }

  if (!/^\d{9,15}$/.test(phone)) {
    return NextResponse.json({ error: "Phone must be 9 to 15 digits" }, { status: 400 });
  }

  if (!VALID_TELECOMS.has(telecom)) {
    return NextResponse.json(
      { error: "Telecom must be one of AM, OM, MP, AF" },
      { status: 400 }
    );
  }

  const admin = getAdminClient();
  const { data, error } = await admin.rpc("request_school_payout", {
    p_school_id: school.id,
    p_requested_by: user.id,
    p_amount: amount,
    p_phone: phone,
    p_telecom: telecom,
  });

  if (error) {
    console.error("[payouts/request] RPC error:", error.message);
    return NextResponse.json({ error: "Failed to create payout request" }, { status: 500 });
  }

  if (data?.error === "insufficient_balance") {
    return NextResponse.json(
      { error: "Insufficient balance", available: data.available },
      { status: 422 }
    );
  }

  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx vitest run __tests__/payout-request.test.ts 2>&1 | tail -20
```
Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/dashboard/payouts/request/route.ts __tests__/payout-request.test.ts vitest.config.ts
git commit -m "feat: add payout request API route with tests"
```

---

## Task 6: Payout Approve API Route

**Files:**
- Create: `app/api/admin/payouts/[id]/approve/route.ts`
- Create: `__tests__/payout-approve.test.ts`

- [ ] **Step 1: Write the failing tests in `__tests__/payout-approve.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({ getAdminClient: vi.fn() }));
vi.mock("../lib/proxy", () => ({
  callProxyPayout: vi.fn(),
  ProxyError: class ProxyError extends Error {
    status: number;
    constructor(msg: string, status: number) { super(msg); this.status = status; }
  },
}));
vi.mock("../lib/email", () => ({
  sendPayoutFailedEmail: vi.fn(),
}));
vi.mock("../lib/tenant", () => ({ getTenantContext: vi.fn() }));

import { POST } from "../app/api/admin/payouts/[id]/approve/route";
import { NextRequest } from "next/server";
import { getAdminClient } from "../lib/supabase";
import { callProxyPayout, ProxyError } from "../lib/proxy";
import { sendPayoutFailedEmail } from "../lib/email";
import { getTenantContext } from "../lib/tenant";

type AdminClient = ReturnType<typeof getAdminClient>;

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/admin/payouts/${id}/approve`, {
    method: "POST",
  });
}

function asAdminClient(client: { from: unknown }) {
  return client as unknown as AdminClient;
}

const mockPayout = {
  id: "payout-uuid",
  school_id: "school-uuid",
  requested_by: "user-uuid",
  amount: 5000,
  phone: "0812345678",
  telecom: "OM",
  status: "pending",
};

describe("POST /api/admin/payouts/[id]/approve", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 403 if user is not super admin", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce({
      user: { id: "user-uuid", email: "notadmin@test.com" },
      school: { id: "school-uuid", currency: "FC" },
      membership: { role: "owner" },
    } as never);

    const res = await POST(makeRequest("payout-uuid"), { params: Promise.resolve({ id: "payout-uuid" }) });
    expect(res.status).toBe(403);
  });

  it("returns 409 if payout is not pending (re-entrancy guard)", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce({
      user: { id: "user-uuid", email: "admin@test.com" },
      school: { id: "school-uuid", currency: "FC" },
      membership: { role: "owner" },
    } as never);

    // Atomic UPDATE returns no rows (already processing)
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));

    const res = await POST(makeRequest("payout-uuid"), { params: Promise.resolve({ id: "payout-uuid" }) });
    expect(res.status).toBe(409);
  });

  it("calls proxy and returns 200 on success", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce({
      user: { id: "user-uuid", email: "admin@test.com" },
      school: { id: "school-uuid", currency: "FC" },
      membership: { role: "owner" },
    } as never);

    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPayout, error: null }),
      });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));
    vi.mocked(callProxyPayout).mockResolvedValueOnce({});

    const res = await POST(makeRequest("payout-uuid"), { params: Promise.resolve({ id: "payout-uuid" }) });
    expect(res.status).toBe(200);
    expect(callProxyPayout).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000, phone: "0812345678", telecom: "OM" })
    );
  });

  it("marks failed and sends email when proxy throws", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce({
      user: { id: "user-uuid", email: "admin@test.com" },
      school: { id: "school-uuid", currency: "FC" },
      membership: { role: "owner" },
    } as never);

    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPayout, error: null }),
      })
      .mockReturnValueOnce({
        // fetch profile for email
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { email: "owner@test.com" }, error: null }),
      })
      .mockReturnValueOnce({
        // update status to failed
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));
    vi.mocked(callProxyPayout).mockRejectedValueOnce(new (ProxyError as never)("SerdiPay error", 502));

    const res = await POST(makeRequest("payout-uuid"), { params: Promise.resolve({ id: "payout-uuid" }) });
    expect(res.status).toBe(502);
    expect(sendPayoutFailedEmail).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run __tests__/payout-approve.test.ts 2>&1 | tail -20
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/admin/payouts/[id]/approve/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { callProxyPayout, ProxyError } from "@/lib/proxy";
import { sendPayoutFailedEmail } from "@/lib/email";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user } = await getTenantContext();

  if (user.email !== process.env.SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminClient();

  // Atomic re-entrancy guard: only succeeds if status is still 'pending'
  const { data: payout } = await admin
    .from("school_payouts")
    .update({
      status: "processing",
      approved_at: new Date().toISOString(),
      approved_by: user.email,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .single();

  if (!payout) {
    return NextResponse.json(
      { error: "Payout not found or already processed" },
      { status: 409 }
    );
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/serdipay/payout-callback`;

  try {
    await callProxyPayout({
      amount: payout.amount,
      phone: payout.phone,
      telecom: payout.telecom,
      reference: payout.id,
      callback_url: callbackUrl,
    });

    return NextResponse.json({ id: payout.id, status: "processing" });
  } catch (err) {
    const reason = err instanceof ProxyError ? err.message : "Unexpected proxy error";

    // Fetch owner email for failure notification
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", payout.requested_by)
      .single();

    await admin
      .from("school_payouts")
      .update({ status: "failed", failure_reason: reason })
      .eq("id", payout.id);

    if (profile?.email) {
      const { data: school } = await admin
        .from("schools")
        .select("currency")
        .eq("id", payout.school_id)
        .single();

      await sendPayoutFailedEmail({
        to: profile.email,
        amount: payout.amount,
        currency: (school as { currency?: string } | null)?.currency ?? "",
      }).catch(console.error);
    }

    const status = err instanceof ProxyError ? err.status : 500;
    return NextResponse.json({ error: reason }, { status });
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run __tests__/payout-approve.test.ts 2>&1 | tail -20
```
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/payouts/[id]/approve/route.ts __tests__/payout-approve.test.ts
git commit -m "feat: add payout approve API with atomic guard and proxy call"
```

---

## Task 7: Payout Callback Route

**Files:**
- Create: `app/api/serdipay/payout-callback/route.ts`
- Create: `__tests__/payout-callback-b2c.test.ts`

- [ ] **Step 1: Write failing tests in `__tests__/payout-callback-b2c.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({ getAdminClient: vi.fn() }));
vi.mock("../lib/email", () => ({
  sendPayoutCompletedEmail: vi.fn(),
  sendPayoutFailedEmail: vi.fn(),
}));

import { POST } from "../app/api/serdipay/payout-callback/route";
import { NextRequest } from "next/server";
import { getAdminClient } from "../lib/supabase";
import { sendPayoutCompletedEmail, sendPayoutFailedEmail } from "../lib/email";

type AdminClient = ReturnType<typeof getAdminClient>;

function makeRequest(body: object, secret = "test-callback-secret") {
  return new NextRequest("http://localhost/api/serdipay/payout-callback", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-serdipay-secret": secret,
    },
  });
}

function asAdminClient(client: { from: unknown }) {
  return client as unknown as AdminClient;
}

const mockPayout = {
  id: "payout-uuid",
  school_id: "school-uuid",
  requested_by: "user-uuid",
  amount: 5000,
  phone: "0812345678",
  telecom: "OM",
  status: "processing",
};

describe("POST /api/serdipay/payout-callback", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 if callback secret is wrong", async () => {
    const res = await POST(makeRequest({ message: "payout-uuid" }, "wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 200 for unknown payout id (idempotent ignore)", async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));

    const res = await POST(makeRequest({ message: "unknown-id", payment: { status: "success" } }));
    expect(res.status).toBe(200);
  });

  it("marks completed and sends success email on success callback", async () => {
    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPayout, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { email: "owner@test.com" }, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { currency: "FC" }, error: null }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));

    const res = await POST(makeRequest({
      message: "payout-uuid",
      payment: { status: "success", transactionId: "TXN123" },
    }));
    expect(res.status).toBe(200);
    expect(sendPayoutCompletedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@test.com", amount: 5000 })
    );
  });

  it("marks failed and sends failure email on failed callback", async () => {
    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPayout, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { email: "owner@test.com" }, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { currency: "FC" }, error: null }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));

    const res = await POST(makeRequest({
      message: "payout-uuid",
      payment: { status: "failed" },
    }));
    expect(res.status).toBe(200);
    expect(sendPayoutFailedEmail).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run __tests__/payout-callback-b2c.test.ts 2>&1 | tail -20
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/serdipay/payout-callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendPayoutCompletedEmail, sendPayoutFailedEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-serdipay-secret");
  if (
    process.env.SERDIPAY_CALLBACK_SECRET &&
    secret !== process.env.SERDIPAY_CALLBACK_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { message?: string; payment?: { status?: string; transactionId?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payoutId = body.message;
  const paymentStatus = body.payment?.status;
  const transactionId = body.payment?.transactionId;

  if (!payoutId || !paymentStatus) {
    return NextResponse.json({ error: "message and payment.status are required" }, { status: 400 });
  }

  const admin = getAdminClient();

  const { data: payout } = await admin
    .from("school_payouts")
    .select("id, school_id, requested_by, amount, phone, telecom, status")
    .eq("id", payoutId)
    .single();

  if (!payout) {
    return NextResponse.json({ message: "unknown payout, ignored" }, { status: 200 });
  }

  const isSuccess = paymentStatus === "success";

  // Fetch owner email and school currency for email
  const [{ data: profile }, { data: school }] = await Promise.all([
    admin.from("profiles").select("email").eq("id", payout.requested_by).single(),
    admin.from("schools").select("currency").eq("id", payout.school_id).single(),
  ]);

  const ownerEmail = (profile as { email?: string } | null)?.email;
  const currency = (school as { currency?: string } | null)?.currency ?? "";

  if (isSuccess) {
    await admin
      .from("school_payouts")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        serdipay_transaction_id: transactionId ?? null,
      })
      .eq("id", payoutId);

    if (ownerEmail) {
      await sendPayoutCompletedEmail({
        to: ownerEmail,
        amount: payout.amount,
        currency,
        phone: payout.phone,
        telecom: payout.telecom,
      }).catch(console.error);
    }
  } else {
    await admin
      .from("school_payouts")
      .update({
        status: "failed",
        failure_reason: paymentStatus,
      })
      .eq("id", payoutId);

    if (ownerEmail) {
      await sendPayoutFailedEmail({
        to: ownerEmail,
        amount: payout.amount,
        currency,
      }).catch(console.error);
    }
  }

  return NextResponse.json({ message: "ok" }, { status: 200 });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run __tests__/payout-callback-b2c.test.ts 2>&1 | tail -20
```
Expected: all 4 tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npx vitest run 2>&1 | tail -30
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/serdipay/payout-callback/route.ts __tests__/payout-callback-b2c.test.ts
git commit -m "feat: add payout callback route with email notifications"
```

---

## Task 8: UI — WithdrawForm Component

**Files:**
- Create: `app/dashboard/payouts/WithdrawForm.tsx`

- [ ] **Step 1: Read `app/dashboard/payouts/page.tsx` to understand existing structure**

Before writing the form, read the current file to understand what imports, styles, and patterns are used (Tailwind classes, button styles, card layouts, etc.).

- [ ] **Step 2: Create `app/dashboard/payouts/WithdrawForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TELECOM_OPTIONS = [
  { value: "AM", label: "Airtel Money" },
  { value: "OM", label: "Orange Money" },
  { value: "MP", label: "Vodacom M-Pesa" },
  { value: "AF", label: "Afrimoney" },
];

interface Props {
  availableBalance: number;
  currency: string;
}

export function WithdrawForm({ availableBalance, currency }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [telecom, setTelecom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const amountNum = Number(amount);
  const isInvalid = !amount || !phone || !telecom || amountNum < 1000 || amountNum > availableBalance;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/dashboard/payouts/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: amountNum, phone, telecom }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to submit withdrawal request");
        return;
      }

      setSuccess(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border p-4 text-sm text-green-700 bg-green-50">
        Withdrawal request submitted. You will receive an email once it is processed.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
      <h2 className="font-semibold text-sm">Request Withdrawal</h2>

      <p className="text-xs text-gray-500">
        Available balance: {availableBalance.toLocaleString()} {currency}
      </p>

      <div className="space-y-1">
        <label className="text-xs font-medium">Amount ({currency})</label>
        <input
          type="number"
          min={1000}
          max={availableBalance}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="Minimum 1,000"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Mobile Money Phone</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="0812345678"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Provider</label>
        <select
          value={telecom}
          onChange={(e) => setTelecom(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
          required
        >
          <option value="">Select provider</option>
          {TELECOM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={isInvalid || loading}
        className="w-full rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {loading ? "Submitting…" : "Request Withdrawal"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/payouts/WithdrawForm.tsx
git commit -m "feat: add WithdrawForm component"
```

---

## Task 9: UI — Update Payouts Page

**Files:**
- Modify: `app/dashboard/payouts/page.tsx`

- [ ] **Step 1: Read the full current `app/dashboard/payouts/page.tsx`**

Read it carefully before editing — match its Tailwind patterns, imports, and data fetching style exactly.

- [ ] **Step 2: Add balance card, WithdrawForm, and payout history to the page**

At the top of the server component, after fetching settled payments, add:

1. **Available balance query** — query `school_payouts` for pending/processing totals, then subtract from collected total:

```typescript
// Available balance
const { data: collectedData } = await admin
  .from("payment_requests")
  .select("amount, fee_amount")
  .eq("school_id", school.id)
  .eq("status", "success");

const collected = (collectedData ?? []).reduce(
  (sum, r) => sum + (r.amount - (r.fee_amount ?? 0)),
  0
);

const { data: inFlightData } = await admin
  .from("school_payouts")
  .select("amount")
  .eq("school_id", school.id)
  .in("status", ["pending", "processing"]);

const inFlight = (inFlightData ?? []).reduce((sum, r) => sum + r.amount, 0);
const availableBalance = Math.max(0, collected - inFlight);
```

2. **Payout history query** (for the current school's payouts):

```typescript
const { data: payoutHistory } = await admin
  .from("school_payouts")
  .select("id, amount, phone, telecom, status, created_at, completed_at, failure_reason")
  .eq("school_id", school.id)
  .order("created_at", { ascending: false })
  .limit(50);
```

3. **Role check** for showing WithdrawForm (owner only):

```typescript
const canWithdraw = membership.role === "owner";
```

4. **Render** — add before the existing settled payments section:

```tsx
{/* Balance card */}
<div className="rounded-lg border p-4">
  <p className="text-xs text-gray-500">Available Balance</p>
  <p className="text-2xl font-bold">
    {availableBalance.toLocaleString()} {school.currency}
  </p>
</div>

{/* Withdraw form — owner only */}
{canWithdraw && (
  <WithdrawForm availableBalance={availableBalance} currency={school.currency} />
)}

{/* Payout history */}
{(payoutHistory ?? []).length > 0 && (
  <div>
    <h2 className="font-semibold text-sm mb-2">Withdrawal Requests</h2>
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500">
          <th className="pb-2">Amount</th>
          <th className="pb-2">Phone</th>
          <th className="pb-2">Provider</th>
          <th className="pb-2">Status</th>
          <th className="pb-2">Requested</th>
        </tr>
      </thead>
      <tbody>
        {(payoutHistory ?? []).map((p) => (
          <tr key={p.id} className="border-t">
            <td className="py-2">{p.amount.toLocaleString()} {school.currency}</td>
            <td className="py-2">{p.phone}</td>
            <td className="py-2">{p.telecom}</td>
            <td className="py-2 capitalize">{p.status}</td>
            <td className="py-2">{new Date(p.created_at).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
```

5. Add `import { WithdrawForm } from "./WithdrawForm";` at the top.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/payouts/page.tsx
git commit -m "feat: add balance card, withdraw form, and payout history to payouts page"
```

---

## Task 10: UI — Operator Admin Panel

**Files:**
- Create: `app/dashboard/admin/payouts/page.tsx`

- [ ] **Step 1: Create the admin payouts page**

```tsx
import { redirect } from "next/navigation";
import { createSSRClient, getAdminClient } from "@/lib/supabase";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

export default async function AdminPayoutsPage() {
  const ssr = await createSSRClient();
  const { data: { user } } = await ssr.auth.getUser();

  if (!user || user.email !== process.env.SUPER_ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  const admin = getAdminClient();

  const { data: payouts } = await admin
    .from("school_payouts")
    .select("id, school_id, amount, phone, telecom, status, created_at, requested_by, schools(name), profiles(email)")
    .order("created_at", { ascending: false })
    .limit(200);

  const pending = (payouts ?? []).filter((p) => p.status === "pending");
  const history = (payouts ?? []).filter((p) => p.status !== "pending");

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-xl font-bold">Payout Requests</h1>

      <section>
        <h2 className="font-semibold mb-3">Pending Approval ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-500">No pending requests.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-2">School</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Phone</th>
                <th className="pb-2">Provider</th>
                <th className="pb-2">Requested by</th>
                <th className="pb-2">Date</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2">{(p.schools as { name?: string } | null)?.name ?? p.school_id}</td>
                  <td className="py-2">{p.amount.toLocaleString()}</td>
                  <td className="py-2">{p.phone}</td>
                  <td className="py-2">{p.telecom}</td>
                  <td className="py-2">{(p.profiles as { email?: string } | null)?.email ?? p.requested_by}</td>
                  <td className="py-2">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="py-2">
                    <ApproveButton payoutId={p.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">History</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="pb-2">School</th>
              <th className="pb-2">Amount</th>
              <th className="pb-2">Phone</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {history.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="py-2">{(p.schools as { name?: string } | null)?.name ?? p.school_id}</td>
                <td className="py-2">{p.amount.toLocaleString()}</td>
                <td className="py-2">{p.phone}</td>
                <td className="py-2">{STATUS_LABELS[p.status] ?? p.status}</td>
                <td className="py-2">{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// Client component for the approve button
"use client";
function ApproveButton({ payoutId }: { payoutId: string }) {
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function handleApprove() {
    setLoading(true);
    const res = await fetch(`/api/admin/payouts/${payoutId}/approve`, { method: "POST" });
    setLoading(false);
    if (res.ok) setDone(true);
  }

  if (done) return <span className="text-xs text-green-600">Sent</span>;

  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className="rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-40"
    >
      {loading ? "…" : "Approve"}
    </button>
  );
}
```

Note: `ApproveButton` needs to be in a separate `"use client"` file. Split it out:

**Create `app/dashboard/admin/payouts/ApproveButton.tsx`:**
```tsx
"use client";
import { useState } from "react";

export function ApproveButton({ payoutId }: { payoutId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleApprove() {
    setLoading(true);
    const res = await fetch(`/api/admin/payouts/${payoutId}/approve`, { method: "POST" });
    setLoading(false);
    if (res.ok) setDone(true);
  }

  if (done) return <span className="text-xs text-green-600">Sent</span>;

  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className="rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-40"
    >
      {loading ? "…" : "Approve"}
    </button>
  );
}
```

Then update `page.tsx` to remove the inline `ApproveButton` and import from `./ApproveButton`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/admin/payouts/page.tsx app/dashboard/admin/payouts/ApproveButton.tsx
git commit -m "feat: add operator admin payout panel"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
cd "/Users/rod/20 Apps/Minerval/minerval"
npx vitest run 2>&1 | tail -30
```
Expected: all tests PASS, 0 failures.

- [ ] **Step 2: TypeScript full check**

```bash
npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 3: Push to origin/main**

```bash
git push origin main
```

---

## Environment Checklist (Production)

Before this goes live, ensure these are set in Vercel/production:
- [ ] `RESEND_API_KEY` — Resend dashboard → API keys
- [ ] `EMAIL_FROM` — verified sender domain in Resend
- [ ] `SERDIPAY_CALLBACK_SECRET` — shared with SerdiPay for B2C callback auth
- [ ] `SUPER_ADMIN_EMAIL` — your email address
- [ ] `NEXT_PUBLIC_APP_URL` — production URL (used to build callback URL)
