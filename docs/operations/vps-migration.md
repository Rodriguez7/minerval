# Railway → VPS migration (November 2026)

On 2026-11-26 Minerval moved from Railway to the Hetzner VPS that already ran the SerdiPay
proxy. The app now runs as a Coolify application behind Cloudflare Tunnel. Supabase didn't
move: the app is stateless, so no data was copied.

Operator-only details live outside the repository, next to the secrets they use: hostnames,
record and resource IDs, deploy, cutover and rollback scripts, and the full plan and runbook.

## Design

```
Browser → Cloudflare (WAF, TLS) → Tunnel → Traefik (Coolify, localhost only) → Minerval container
                                                         └→ SerdiPay proxy (nginx + PM2, same VPS)
```

- **Image:** multi-stage `Dockerfile`, Next.js `output: "standalone"`, `node:22-slim`, non-root user,
  `curl` for Coolify's health check, memory capped at 512 MB. It uses about 65 MB at idle.
- **Build on a workstation, not the VPS:** the 4 GB VPS also runs another app, and `next build` needs
  1.5–2 GB. Images go to the VPS's private registry; Coolify deploys by tag.
- **Build-time values:** `NEXT_PUBLIC_*` values come in as a BuildKit secret loaded into the build
  step's environment. They aren't written as a `.env` file, because Next's standalone output would
  copy that file into the runtime image. Runtime secrets live only in Coolify.
- **Isolation:** the app has its own Docker network. Only Coolify's proxy joins it.
- **Swap:** 2 GB of swap was added as a safety margin against running out of memory.

## Code changes the move required

- **Client IP** (`lib/request.ts`): behind Tunnel + Traefik, `x-forwarded-for` holds the tunnel's
  address, which would have put every parent in one payment rate-limit bucket. `getClientIp` now
  prefers `cf-connecting-ip`. This was verified on staging: the recorded rate-limit key held the
  visitor's real IP.
- **Canonical host:** `minerval.org` 308-redirects to `www.minerval.org`, and metadata, robots and
  sitemap derive from `getCanonicalSiteUrl()`. Redirects stay on the public origin (no internal
  `0.0.0.0` hosts).
- **CI:** runners are pinned to `ubuntu-24.04`, because Playwright can't install browsers on
  `ubuntu-latest` (26.04).

## Cutover

1. Pre-stage, which visitors couldn't see: add the app's domains in Coolify, add tunnel routes for
   www and the apex, and test the A → CNAME change on a throwaway record.
2. Switch: point both proxied records at the tunnel. Because they're proxied, visitors keep resolving
   to Cloudflare, so there is no DNS propagation; the edge picked up the change in under 2 minutes.
3. Verify:
   - deep health and the main pages;
   - the apex redirect;
   - Meta webhook verification;
   - a correctly signed Stripe event (accepted) and a forged one (rejected);
   - SerdiPay and cron endpoints answering with the app's own 401, not a Cloudflare challenge;
   - the GitHub deep-health monitor.

Railway stayed up, untouched, as a one-command rollback target for 7 days.

## Lessons

- Coolify's health check runs `curl`/`wget` inside the container and ignores the image's
  `HEALTHCHECK`. Slim images without either tool get rolled back even though the app started.
- During a Cloudflare dashboard incident, dashboard saves can fail silently while the API still
  works. Keep a scoped, short-lived API token for DNS and tunnel changes during migrations.
- GitHub disables scheduled workflows after 60 days without commits. The production monitor and
  reminder schedules had been off since September without anyone noticing.
