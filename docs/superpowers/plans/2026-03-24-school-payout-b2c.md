# School Payout B2C — Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to work through this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the fully-implemented School Payout B2C feature is correct and well-tested before declaring it production-ready.

**Architecture:** All implementation exists: DB migration, proxy `/payout` endpoint, `lib/proxy.ts`, `lib/email.ts`, request/approve/callback API routes, `WithdrawForm`, `ApproveButton`, admin payouts page. Unit tests exist for all three API routes (13 tests, all passing). The only gap is smoke-test (E2E) coverage — the Playwright smoke test doesn't exercise the payout flow.

**Tech Stack:** Vitest (unit), Playwright (E2E), Next.js 16, Supabase, SerdiPay proxy

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Run | `__tests__/payout-request.test.ts` | 5 unit tests — request validation, owner guard, insufficient balance, success |
| Run | `__tests__/payout-approve.test.ts` | 4 unit tests — super-admin guard, re-entrancy 409, proxy call, failure email |
| Run | `__tests__/payout-callback-b2c.test.ts` | 4 unit tests — secret auth, idempotent ignore, success callback, failure callback |
| Verify | `serdipay-proxy/index.js` | Confirm `/payout` route exists alongside `/pay` |
| Verify | `app/dashboard/payouts/page.tsx` | Confirm balance card + history table render |
| Verify | `app/dashboard/admin/payouts/page.tsx` | Confirm admin panel renders pending + history |
| Modify | `e2e/smoke.spec.ts` | Add payout page navigation assertion |

---

## Task 1: Run All Unit Tests

**Files:**
- Run: `__tests__/payout-request.test.ts`
- Run: `__tests__/payout-approve.test.ts`
- Run: `__tests__/payout-callback-b2c.test.ts`

- [x] **Step 1: Run all three payout test files**

```bash
cd "/Users/rod/20 Apps/Minerval/minerval"
npx vitest run __tests__/payout-request.test.ts __tests__/payout-approve.test.ts __tests__/payout-callback-b2c.test.ts
```

Expected: `3 passed (3)`, `13 passed (13)` ✅ Already verified passing.

---

## Task 2: Verify Proxy Has `/payout` Endpoint

**Files:**
- Verify: `serdipay-proxy/index.js`

- [x] **Step 1: Confirm `/payout` route exists in proxy**

```bash
grep -n "POST.*payout\|app.post.*payout" "/Users/rod/20 Apps/Minerval/minerval/serdipay-proxy/index.js"
```

Result: `serdipay-proxy/index.js:286:app.post("/payout", ...)` ✅

- [x] **Step 2: Confirm `parsePayoutPayload` and `processPayout` are defined**

```bash
grep -n "parsePayoutPayload\|processPayout" "/Users/rod/20 Apps/Minerval/minerval/serdipay-proxy/index.js"
```

Result: Both present at lines 72 and 172 ✅

---

## Task 3: Verify `lib/proxy.ts` Has `callProxyPayout`

**Files:**
- Verify: `minerval/lib/proxy.ts`

- [x] **Step 1: Check callProxyPayout is exported**

```bash
grep -n "callProxyPayout" "/Users/rod/20 Apps/Minerval/minerval/lib/proxy.ts"
```

Result: `lib/proxy.ts:59:export async function callProxyPayout(...)` ✅

---

## Task 4: Add Smoke Test — Payout Page Navigation

The Playwright smoke test at `e2e/smoke.spec.ts` visits the payouts page and checks the heading, but does NOT verify the balance card or history table rendered correctly. Add a minimal assertion that the page loaded without error.

**Files:**
- Modify: `e2e/smoke.spec.ts`

- [x] **Step 1: Read current smoke test payout section**

Found at `e2e/smoke.spec.ts:223-226`. Already checks `getByRole("heading", { name: "Payouts" })` and `getByText("Net school payout")`.

- [x] **Step 2: Verify smoke test already covers the balance card**

`"Net school payout"` text is rendered at line 100 of `app/dashboard/payouts/page.tsx` inside the balance card. The smoke test assertion at line 226 already confirms the balance card rendered. No additional assertion needed.

- [ ] **Step 3: Run smoke test to confirm it still passes**

```bash
cd "/Users/rod/20 Apps/Minerval/minerval"
npx playwright test e2e/smoke.spec.ts --reporter=line 2>&1 | tail -20
```

Expected: All tests pass.

---

## Task 5: TypeScript Compilation Check

- [ ] **Step 1: Run tsc noEmit**

```bash
cd "/Users/rod/20 Apps/Minerval/minerval"
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors (or only pre-existing unrelated errors — zero new errors from payout code).

---

## Task 6: Final Status

- [ ] **Step 1: Run full unit test suite**

```bash
cd "/Users/rod/20 Apps/Minerval/minerval"
npx vitest run 2>&1 | tail -10
```

Expected: All test files pass.

- [ ] **Step 2: Confirm feature is production-ready**

Checklist:
- [x] DB migration: `supabase/migrations/013_school_payouts.sql` — table, indexes, RLS, `request_school_payout()` RPC
- [x] Proxy: `serdipay-proxy/index.js` — `POST /payout` → SerdiPay payment-client
- [x] `lib/proxy.ts` — `callProxyPayout()`
- [x] `lib/email.ts` — `sendPayoutCompletedEmail`, `sendPayoutFailedEmail`
- [x] `app/api/dashboard/payouts/request/route.ts` — owner-only, min 1000, calls RPC
- [x] `app/api/admin/payouts/[id]/approve/route.ts` — super-admin, 409 re-entrancy guard, calls proxy
- [x] `app/api/serdipay/payout-callback/route.ts` — secret auth, idempotent, emails
- [x] `app/dashboard/payouts/page.tsx` — balance card, WithdrawForm, payout history
- [x] `app/dashboard/admin/payouts/page.tsx` — pending approval + history
- [x] Unit tests: 13 tests across 3 files, all passing
- [x] Smoke test: payouts page already covered (`getByText("Net school payout")`)
- [ ] Smoke test: full run still passes after all design changes
- [ ] TypeScript: no new compilation errors
