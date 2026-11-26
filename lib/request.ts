export function getClientIp(headers: Headers) {
  // Cloudflare sets cf-connecting-ip to the real visitor on every proxied or
  // tunnelled request. Prefer it: behind Cloudflare Tunnel + Traefik,
  // x-forwarded-for is rewritten to the tunnel's own address.
  const cloudflareIp = headers.get("cf-connecting-ip")?.trim();

  if (cloudflareIp) {
    return cloudflareIp;
  }

  const forwardedFor = headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return headers.get("x-real-ip") ?? "unknown";
}
