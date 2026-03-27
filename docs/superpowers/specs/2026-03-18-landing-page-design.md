# Landing Page Design Spec
**Date:** 2026-03-18
**Product:** Minerval
**Audience:** School administrators in Congo

---

## Goal

A public marketing page at `/` that converts school administrators into signups. The page must build trust quickly, answer the key objection ("does it work with our mobile networks?"), and remove all friction from getting started.

---

## Design Decisions

### Audience
School administrators (decision-makers), not parents. The page sells to the person who will register the school and pay the subscription.

### Color palette
Blue (`#1d4ed8`) and white. Single accent, no gradients, no purple.

### Font
`Outfit` (Google Fonts) — weight 300–800. Loaded via `next/font/google` and scoped to the landing page component only via a wrapper `div` with the font's `className`. The root layout (which uses Geist/Geist Mono for the dashboard) is **not modified**.

### Pricing on page
None. Phase 1 goal is acquisition, not filtering by budget. CTA is "Get started free."

### Existing `app/page.tsx`
The current file contains `redirect("/pay")`. This redirect must be **removed and replaced** with the landing page component. The `/pay` route is still accessible directly at its URL — removing the root redirect does not break it.

### Authenticated user at `/`
If a logged-in admin visits `/`, they should be redirected to `/dashboard`. Implement this by checking the session at the top of `app/page.tsx` using `createSSRClient()` — if a user is found, call `redirect("/dashboard")`.

### SEO metadata
`app/page.tsx` must export a `metadata` object overriding the root layout's generic title:
```ts
export const metadata = {
  title: "Minerval — Collect School Fees by Mobile Money",
  description: "Stop chasing payments. Let parents pay school fees via M-Pesa, Airtel Money, and Orange Money. Free to start.",
};
```

---

## Page Structure (7 sections)

### 1. Nav (fixed, blur backdrop)
- Logo: `Minerval` in blue
- Links: "How it works" · "For schools"
- CTA button: "Get started free" → `/signup`
- Slides down on load with CSS animation

### 2. Hero (split screen)
**Left:**
- Badge: pulsing blue dot + "Mobile money · M-Pesa · Airtel Money · Orange"
- Headline: *"Stop chasing payments. Let parents pay from their phone."*
- Subtext: *"No cash handling. No delays. School fees collected via mobile money and tracked in real time — all from one dashboard."*
- Primary CTA: "Create your school — free" → `/signup`
- Ghost CTA: "See how it works" — smooth scrolls to `#how-it-works`
- Trust note: checkmark + "Free to start. No setup fees. No card required."

**Right — `DashboardPreview` Client Component:**
- Card background: `#f8fafc`, border `#e2e8f0`, rounded-2xl, floating CSS animation (5s loop)
- Header row: school name "École Sainte Marie — Overview" + green "Live" badge with pulsing dot
- Stats row (2 columns):
  - Left: "Collected today" → counter animates 0→47,200 FC on load (1.8s, `requestAnimationFrame`)
  - Right: "Students" → 312 total, "248 paid" in blue
- Payment rows section headed "Recent payments":
  - Initial 3 rows: Marie Kalinda, Jonas Mutombo, Aline Bukasa — slide in staggered (0.8/1.0/1.2s delays)
  - Every 3.5s: new row slides in from left (one of: Grâce Kabongo, Pierre Nkosi, Lucie Banza), oldest row exits right
  - Statuses: "Confirmed" (green), "Processing" (yellow, dims/brightens)
- All mock data is hardcoded — no Supabase calls from this component

### 3. Animated Telecom Bar
Two marquee rows using CSS `translateX` animation:
- **Row 1 (scrolls left, 22s):** M-Pesa · Airtel Money · Orange Money pills with pulsing colored dots
- **Row 2 (scrolls right, 30s):** Activity chips — "Payment via M-Pesa · 15,000 FC" etc.
- Label above: "Accepted payment networks"
- Label below: "Parents pay from any phone · No app download · No new account needed"
- Hover pauses animation via CSS `animation-play-state: paused`

### 4. How It Works (3 steps)
Section has `id="how-it-works"` (anchor target for ghost CTA).
Asymmetric 2-column header, then 3 columns with vertical dividers:
1. Register your school — takes under 2 minutes
2. Import your students — CSV or manual, IDs auto-generated
3. Share your payment link — parents enter child ID, pick network, pay

Step numbers spring-scale on hover (CSS transition).

### 5. Features (2×2 grid)
Four features separated by 2px gaps — no 3-column card layout:
- Mobile money payments
- Student roster
- Real-time dashboard
- Instant receipts

Feature icons tilt + scale on hover (CSS transition).

### 6. Final CTA (full-width blue)
- Headline: *"Ready to stop chasing fees?"*
- Subtext: *"Free to start. Your first payment link is ready in under 5 minutes."*
- Button: "Create your school — free" → `/signup`
- Note: "No setup fees. No card required."

### 7. Footer
Dark (`#0f172a`) · Logo left · "© 2026 Minerval. Built for Congo schools." right

---

## Animation Inventory

| Element | Animation | Trigger |
|---|---|---|
| Nav | Slide down (CSS keyframe) | On load |
| Hero badge dot | Pulse (CSS keyframe) | Infinite |
| Hero elements | Staggered fade-up (CSS keyframe) | On load (0.1–0.52s delays) |
| Dashboard card | Float up/down (CSS keyframe) | Infinite (5s loop) |
| Dashboard counter | Count 0→47,200 FC (`requestAnimationFrame`) | On load (900ms delay) |
| Live badge dot | Pulse green (CSS keyframe) | Infinite |
| Payment rows | Slide in staggered (CSS keyframe) | On load |
| New payments | Slide in / old exits (`useState`/`useEffect`) | Every 3.5s |
| Pending badge | Dim/brighten (CSS keyframe) | Infinite |
| Telecom pills | Pop in spring (CSS keyframe) | On load |
| Marquee row 1 | Scroll left (CSS `translateX`) | Infinite (22s) |
| Marquee row 2 | Scroll right (CSS `translateX`) | Infinite (30s) |
| All below-fold | Fade-up (`IntersectionObserver`) | On scroll |
| Step numbers | Scale (CSS transition) | On hover |
| Feature icons | Tilt + scale (CSS transition) | On hover |
| Buttons | Lift + shadow (CSS transition) | On hover |

---

## Component Architecture

```
app/page.tsx                    ← Server Component, root layout wrapper
  └─ LandingPage (inline)       ← Server: nav, hero left, section shells
       └─ DashboardPreview       ← "use client": live payment simulation
       └─ MarqueeBar             ← "use client": hover pause state (optional, can be CSS-only)
```

The `DashboardPreview` component must be extracted as a Client Component (`"use client"`) to handle the `useState`/`useEffect` for the live payment simulation. Everything else is static and stays in the Server Component.

---

## Implementation Notes

### Tailwind version
Project uses **Tailwind v4**. Use v4 syntax and class patterns. Do not create or modify `tailwind.config.js`. PostCSS plugin is `@tailwindcss/postcss` (already configured).

### Font
Use `next/font/google` to load `Outfit`. Apply the font variable as a `className` on a root wrapper `div` inside `app/page.tsx`. Do **not** modify `app/layout.tsx` — the dashboard uses Geist and should not be changed.

```tsx
import { Outfit } from "next/font/google";
const outfit = Outfit({ subsets: ["latin"], weight: ["300","400","500","600","700","800"] });

export default function LandingPage() {
  return <div className={outfit.className}>...</div>;
}
```

### Routing
- All CTAs → `/signup`
- Ghost CTA → smooth scroll to `#how-it-works` (use `href="#how-it-works"` with `scroll-behavior: smooth` on `html`)
- `app/page.tsx` replaces the existing `redirect("/pay")`

### Performance
- `min-h-[100dvh]` on hero section (not `h-screen`)
- Animate only `transform` and `opacity` — never `top`, `left`, `width`, `height`
- Use `IntersectionObserver` for scroll reveals (no scroll event listeners)
- Marquee uses `transform: translateX` only

### No new npm packages
All animations use CSS keyframes, CSS transitions, and vanilla JS/React hooks. No Framer Motion, GSAP, or other animation libraries needed.

---

## Mobile behavior
Mobile layout is **out of scope** for this implementation. The page is built desktop-first. A responsive pass (collapsing the split hero to single column, stacking features, etc.) will be handled in a follow-up.

---

## Out of Scope
- Pricing page (Phase 2)
- Testimonials (no schools yet to quote)
- Blog / press / about pages
- Mobile nav menu
- Mobile responsive layout (follow-up task)
