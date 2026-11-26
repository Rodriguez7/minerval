# Search engine registration

## Production properties

Registered on 2026-07-30 with `kayemberodriguez@gmail.com`.

### Google Search Console

- Property: Domain property `minerval.org`
- Ownership: Verified through Cloudflare DNS
- Sitemap: `https://www.minerval.org/sitemap.xml`
- Initial state: Submitted; Google is processing the new property

DNS record that must remain present:

```text
Type: TXT
Name: @
Content: google-site-verification=XISekzMfdN2pSfeiEbAYckCYbF3cu2jHXbOSwazv5Jo
TTL: Auto
```

Removing this record can cause ownership verification to be lost.

### Bing Webmaster Tools

- Site: `https://www.minerval.org/`
- Ownership: Verified through Cloudflare DNS
- Sitemap: `https://www.minerval.org/sitemap.xml`
- Initial state: Submitted successfully; processing

DNS record that must remain present:

```text
Type: CNAME
Name: 871cdc5fb4d57ccaf5b2d4b7beaa94af
Target: verify.bing.com
Proxy status: DNS only
TTL: Auto
```

Removing this record can cause ownership verification to be lost.

## Production checks

The public sitemap was checked after registration:

```text
GET https://www.minerval.org/sitemap.xml
Status: 200
Content-Type: application/xml
```

Search-engine reports can take 24–48 hours to populate after a new property is
created. Do not remove either verification record while waiting for the first
crawl.
