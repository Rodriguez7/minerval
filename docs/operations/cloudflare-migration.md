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

**13 records.** Confirmed 2026-07-15 by reconciling two independent sources, because **neither was complete alone**:

- A hand-written list missed `zoho._domainkey` (signs outbound business mail).
- A targeted `dig` sweep then missed `MX send` and `TXT send` — Resend's sending subdomain, on Amazon SES — because it only probed subdomains already known about. Losing those breaks payment receipts.
- Cloudflare's auto-scan found the `send` pair but warns, correctly, that it misses uncommon records.

Take the **union of `dig` and the provider's scan, and reconcile the counts**. Do not trust either alone, and do not hand-write it.

```
A     minerval.org        69.46.46.127                            Railway (apex; 301 → https, 307 → /fr)
CNAME www                 0q290d7m.up.railway.app                 Railway (resolves 69.46.46.12)
A     proxy               89.167.106.33                           Hetzner — SerdiPay. NEVER proxy this.
MX    minerval.org        mx.zoho.eu                     (10)
MX    minerval.org        mx2.zoho.eu                    (20)
MX    minerval.org        mx3.zoho.eu                    (50)
MX    send                feedback-smtp.eu-west-1.amazonses.com (10)   Resend bounce handling
TXT   minerval.org        v=spf1 include:zohomail.eu ~all
TXT   minerval.org        zoho-verification=zb44744026.zmverify.zoho.eu
TXT   send                v=spf1 include:amazonses.com ~all       Resend sending subdomain
TXT   _dmarc              v=DMARC1; p=none; rua=mailto:contact@minerval.org; ...
TXT   resend._domainkey   p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC9miACDjE5...   Resend DKIM
TXT   zoho._domainkey     v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOC...      Zoho DKIM (split)
```

Expected totals: **2 A, 1 CNAME, 4 MX, 6 TXT**. If the provider's scan reports different counts, reconcile before proceeding.

**Records default to proxied.** Cloudflare's import turns the cloud **orange** on every A and CNAME, including `proxy`. Left alone, activating the nameservers silently performs Phase 3 — full proxying, including the SerdiPay path — the moment DNS propagates. Grey-cloud all three *before* activation. Cloudflare will warn the zone "is not fully protected"; that is the correct state for Phase 1, and it is Cloudflare confirming that moving DNS alone buys no protection.

No `AAAA` and no `CAA` records exist. The absent `CAA` matters: adding one later without including Railway's CA would break certificate renewal.

**Split TXT records.** `zoho._domainkey` is served as two quoted strings, because a single TXT string cannot exceed 255 bytes. It is one logical value. Paste it into Cloudflare as one continuous string with the quotes and the join removed, and let Cloudflare re-split it. Pasting it with the quotes embedded produces a DKIM record that looks present and fails validation.

Generate the authoritative snapshot — query the authoritative nameserver directly, not a resolver, and keep the file to diff against after the move:

```bash
{ echo "# minerval.org DNS — $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  for t in NS SOA A AAAA MX TXT CAA; do
    echo "## $t"; dig +noall +answer @dns1.registrar-servers.com $t minerval.org
  done
  for s in www proxy _dmarc resend._domainkey zoho._domainkey; do
    echo "## $s"
    for t in A CNAME TXT; do dig +noall +answer @dns1.registrar-servers.com $t $s.minerval.org; done
  done
} > /tmp/minerval-dns-before.txt
```

After the nameservers move, re-run it against Cloudflare's nameservers and diff. Every value must match; only the `NS`, `SOA`, and TTLs may differ.

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

**Done 2026-07-15.** Inert while grey-clouded, which is exactly why it goes in first.

Cloudflare → Security → Security rules → Create rule → Custom rules. One rule covers all four paths, which leaves headroom in the Free plan's five:

- **Name:** `Skip security for authenticated server-to-server callbacks`
- **Expression:**
  ```
  (http.request.uri.path in {"/api/serdipay/callback" "/api/serdipay/payout-callback" "/api/webhooks/stripe" "/api/health"})
  ```
- **Action:** `Skip`
- **Components:** check **every** box, including the ones hidden behind *More components to skip*.

Every one of these endpoints is already authenticated (`SERDIPAY_CALLBACK_SECRET`, Stripe signature, `HEALTHCHECK_SECRET`), so Cloudflare's checks add no security — only the risk of challenging a legitimate callback. They are server-to-server calls from datacenter IPs, precisely what bot protection is built to stop.

**The default four are not enough.** The visible checkboxes are custom rules, rate limiting, managed rules, and Super Bot Fight Mode. Two of the ones hidden behind *More components to skip* matter most:

- **Browser Integrity Check** — challenges requests lacking normal browser headers. A SerdiPay `POST` has none. Miss this and callbacks are challenged despite the rule.
- **Security Level** — challenges by IP threat score. Datacenter IPs score poorly.

Also hidden there: Zone Lockdown, User Agent Blocking, Hotlink Protection, and the two *(Previous version)* legacy entries. Check them all — predictability is worth more than selectivity on endpoints that authenticate themselves.

Verify the path shape before writing the expression. Pages redirect to `/en` and `/fr`, but `/api/*` is **not** locale-prefixed, so the literal paths match. A rule on a wrong path fails silently:

```bash
for p in /api/health /api/serdipay/callback /api/webhooks/stripe; do
  curl -sI "https://www.minerval.org$p" | head -1     # expect 200 / 405, never a 3xx to /en
done
```

### Free plan limits (confirmed in-dashboard)

| | Free |
|---|---|
| Custom rules | **5** (this uses 1) |
| Rate limiting rules | 1 |
| Managed rules | Pro only — the dashboard shows "Upgrade to Pro" |
| `Skip` action | Available |

The Free plan's WAF is the auto-applied Free Managed Ruleset, not the configurable managed rulesets. Unmetered DDoS protection is included on Free and is the point of this migration.

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
