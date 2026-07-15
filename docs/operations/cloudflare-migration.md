# Cloudflare migration runbook

How to put minerval.org behind Cloudflare without breaking payments or email.

## Objectives

- Gain application-layer DDoS, WAF, and bot protection in front of Railway.
- Zero downtime for the app, inbound mail, and transactional email.
- Zero dropped SerdiPay or Stripe callbacks.
- Every phase independently reversible within one DNS TTL (~5 minutes).

## Why this is not one change

Moving DNS to Cloudflare and enabling the proxy are **two separate changes**. Doing them together is the usual cause of failed migrations. Split them:

- **Moving DNS** (Phase 1) changes who answers DNS queries. Traffic still goes browser → Railway. No behaviour change, and no protection.
- **Enabling the proxy** (Phase 3) puts Cloudflare in the request path. This is where protection arrives — and where the payment-callback risk arrives with it.

Namecheap's PremiumDNS DDoS protection does not substitute for Phase 3. It protects DNS *resolution*: it keeps the domain resolving during a DNS-layer flood. Namecheap is never in the HTTP request path, so it cannot absorb an application-layer flood against Railway. Only something sitting in the path can.

## Preconditions

1. `e2e/production/auth-availability.spec.ts` is merged and its scheduled job is green. Do not change what sits in front of the app while blind to client-side breakage.
2. A weekday morning with time to watch payments. Never a Friday, never before time off.
3. Access to: the Cloudflare account, Namecheap (registrar), Railway, and a phone that can complete a real mobile-money payment.

## Phase 0 — Prepare the zone (no user-visible change)

As of 2026-07-15 the Cloudflare account (`Kayemberodriguez@gmail.com`) holds **no domains** — only the Turnstile widgets and `qr-support-worker`. The Turnstile widget lists `minerval.org` under Hostname Management, which looks like the domain is onboarded. It is not: Turnstile is standalone by design and works on any site regardless of DNS.

1. Cloudflare → Add a domain → `minerval.org`. Choose the Free plan.
2. Let the scan import records, then **verify every record against the inventory below**. Cloudflare's scan silently misses records; a missing `MX` kills inbound mail, a missing `TXT` kills receipt delivery.
3. Set **every** record to **DNS-only (grey cloud)**.
4. SSL/TLS → **Full (strict)**. Anything less risks a redirect loop against Railway.
5. Do not change nameservers yet.

### Record inventory

Verified 2026-07-15. **Re-check with `dig` before migrating** — this list ages.

```
A     minerval.org        69.46.46.127               Railway (apex; 301 → https, 307 → /fr)
CNAME www                 0q290d7m.up.railway.app    Railway (resolves 69.46.46.12)
A     proxy               89.167.106.33              Hetzner — SerdiPay path. NEVER proxy this.
MX    minerval.org        mx.zoho.eu       (10)
MX    minerval.org        mx2.zoho.eu      (20)
MX    minerval.org        mx3.zoho.eu      (50)
TXT   minerval.org        v=spf1 include:zohomail.eu ~all
TXT   minerval.org        zoho-verification=zb44744026.zmverify.zoho.eu
TXT   _dmarc              v=DMARC1; p=none; rua=mailto:contact@minerval.org; ...
TXT   resend._domainkey   p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC9miACDjE5...
```

Regenerate the current state with:

```bash
for t in A CNAME MX TXT NS; do echo "--- $t ---"; dig +short $t minerval.org; done
dig +short CNAME www.minerval.org; dig +short A proxy.minerval.org
dig +short TXT _dmarc.minerval.org; dig +short TXT resend._domainkey.minerval.org
```

What each loss costs:

| Record | If lost or wrongly proxied |
|---|---|
| `www`, apex | app unreachable |
| `proxy` | **all SerdiPay payments fail** — the app calls this host |
| `MX` ×3 | inbound mail dies, including `legal@` and `contact@` published on the legal pages |
| SPF, DKIM, DMARC | receipts fail or land in spam; `EMAIL_DOMAIN` verification breaks and the deep health check degrades |

## Phase 1 — Move DNS only

1. Lower TTLs at Namecheap to 300s if any exceed it. Wait for the previous TTL to expire.
2. Namecheap → change nameservers to the pair Cloudflare shows.
3. Wait for Cloudflare to report the zone active.

Because everything is grey-clouded, Cloudflare is now only an authoritative DNS host. Traffic still goes straight to Railway and behaviour is identical.

Verify:

```bash
dig +short NS minerval.org                    # Cloudflare's nameservers
dig +short www.minerval.org                   # unchanged: Railway
dig +short A proxy.minerval.org               # unchanged: 89.167.106.33
dig +short MX minerval.org                    # unchanged: 3 Zoho records
curl -sI https://www.minerval.org/api/health  # 200
```

Then confirm by hand: send a mail to `contact@`, and **complete one real payment end to end**.

Soak 24–48h before Phase 2.

**Rollback:** point the nameservers back at Namecheap. ~5 min.

## Phase 2 — Bypass rules before any proxying

These are inert while grey-clouded, which is exactly why they go in first.

Cloudflare → Security → WAF → create rules that **skip** all security checks (bot fight, WAF, rate limiting) for:

- `/api/serdipay/callback`
- `/api/serdipay/payout-callback`
- `/api/webhooks/stripe`
- `/api/health`

Every one is already authenticated (`SERDIPAY_CALLBACK_SECRET`, Stripe signature, `HEALTHCHECK_SECRET`), so bypassing Cloudflare on them costs nothing. They are server-to-server calls from datacenter IPs — precisely what bot protection challenges.

## Phase 3 — Proxy the app only

Orange-cloud **`www` and the apex. Nothing else.**

Leave `proxy.minerval.org` grey. Proxying it gains nothing — SerdiPay whitelists Hetzner's *outbound* IP, which Cloudflare never touches — and adds a failure point inside the payment path.

Verify immediately, in order:

```bash
curl -sI https://www.minerval.org/en/login | grep -i cf-ray     # present ⇒ proxied
curl -s  https://www.minerval.org/api/health                    # 200
curl -sI https://www.minerval.org/api/health?deep=1 \
  -H "Authorization: Bearer $HEALTHCHECK_SECRET"                # 200 ⇒ bypass rule works
npm run test:e2e:production                                     # auth pages still usable
```

Then the check that actually matters:

4. **Complete one real payment end to end** and confirm the callback landed — a new row in `payment_events` and `amount_due` decremented.

A front page that loads proves nothing about callbacks. If SerdiPay's confirmation is challenged, parents pay, money moves, and the ledger never records it — while every dashboard stays green.

**Rollback:** grey-cloud the record. One click, ~5 min.

## Phase 4 — Tighten incrementally

Enable rate limiting or bot fight mode one setting at a time. Re-run a real payment after each. Do not stack changes.

## Known traps

**Railway TLS renewal.** Railway renews its certificate via an ACME HTTP challenge, which now passes through Cloudflare. If it is blocked or cached, renewal fails *silently* and the certificate expires weeks later, presenting as a sudden total outage long after anyone connects it to this migration. Either confirm `/.well-known/acme-challenge/` is never challenged or cached, or set a calendar reminder ~60 days out to check the expiry:

```bash
echo | openssl s_client -servername www.minerval.org -connect www.minerval.org:443 2>/dev/null \
  | openssl x509 -noout -dates
```

**Proxying `proxy.minerval.org`.** Breaks payments for no benefit. Keep it grey.

**Enabling bot protection before the bypass rules.** Silently drops SerdiPay and Stripe callbacks. Phase 2 precedes Phase 3 for this reason.

**Trusting the front page.** The failure mode here is invisible from the homepage. Verify with a real payment, every time.
