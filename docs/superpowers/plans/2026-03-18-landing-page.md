# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the root `/` redirect with a fully animated marketing landing page targeting school administrators in Congo.

**Architecture:** Three components — a Server Component (`app/page.tsx`) for auth-check, metadata, and static sections; a Client Component (`app/_components/dashboard-preview.tsx`) for the live payment simulation; and a Client Component (`app/_components/telecom-bar.tsx`) for the hover-pause marquee rows. All animations are CSS keyframes + vanilla JS. No new npm packages.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, `next/font/google` (Outfit), TypeScript.

**Spec:** `docs/superpowers/specs/2026-03-18-landing-page-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `app/page.tsx` | **Modify** (replace redirect) | Server Component: auth check, metadata, full page layout |
| `app/_components/dashboard-preview.tsx` | **Create** | Client Component: live payment card with counter + row simulation |
| `app/_components/telecom-bar.tsx` | **Create** | Client Component: dual marquee rows with hover-pause |
| `app/landing.css` | **Create** | All CSS keyframes, scroll-reveal, and hover styles |

---

## Task 1: Create `landing.css`

**Files:**
- Create: `app/landing.css`

- [ ] **Step 1: Create the CSS file with all keyframes and utility styles**

```css
/* app/landing.css */

html {
  scroll-behavior: smooth;
}

/* ── Keyframes ── */

@keyframes navSlideDown {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0);     opacity: 1; }
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(32px) translateY(12px); }
  to   { opacity: 1; transform: translateX(0) translateY(0); }
}

@keyframes cardFloat {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-8px); }
}

@keyframes rowSlideIn {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes pulseDot {
  0%, 100% { box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25); }
  50%       { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.08); }
}

@keyframes pulseGreen {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.8); }
}

@keyframes pulseDotColored {
  0%, 100% { transform: scale(1);   opacity: 1; }
  50%       { transform: scale(1.5); opacity: 0.6; }
}

@keyframes pendingShimmer {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}

@keyframes pillPop {
  from { opacity: 0; transform: scale(0.8) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes marqueeLeft {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

@keyframes marqueeRight {
  from { transform: translateX(-50%); }
  to   { transform: translateX(0); }
}

/* ── Scroll reveal ── */

.reveal {
  opacity: 0;
  transform: translateY(32px);
  transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1);
}
.reveal.revealed {
  opacity: 1;
  transform: translateY(0);
}

/* ── Step number hover ── */

.step-num {
  transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s;
}
.step-card:hover .step-num {
  transform: scale(1.15);
  box-shadow: 0 4px 16px rgba(29, 78, 216, 0.35);
}

/* ── Feature card and icon hover ── */

.feature-card {
  transition: background 0.25s;
}
.feature-card:hover {
  background: #f8faff !important;
}
.feature-icon {
  transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), background 0.25s;
}
.feature-card:hover .feature-icon {
  transform: scale(1.12) rotate(-4deg);
  background: #dbeafe !important;
}

/* ── Marquee hover pause ── */

.marquee-track:hover,
.marquee-track-reverse:hover {
  animation-play-state: paused;
}

/* ── CTA button hover ── */

.btn-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(29, 78, 216, 0.4) !important;
}
.btn-cta-white:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 12px 32px rgba(0,0,0,0.22) !important;
}
.btn-cta,
.btn-cta-white {
  transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;
  display: inline-block;
  text-decoration: none;
}
```

- [ ] **Step 2: Verify the file exists**

```bash
ls "/Users/rod/20 Apps/Minerval/minerval/app/landing.css"
```
Expected: file listed.

---

## Task 2: Create `DashboardPreview` client component

**Files:**
- Create: `app/_components/dashboard-preview.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";
import { useState, useEffect, useRef } from "react";

const INITIAL_ROWS = [
  { initials: "MK", name: "Marie Kalinda",  color: "#3b82f6", time: "2 minutes ago",  status: "success" as const },
  { initials: "JM", name: "Jonas Mutombo",  color: "#8b5cf6", time: "18 minutes ago", status: "pending" as const },
  { initials: "AB", name: "Aline Bukasa",   color: "#0ea5e9", time: "34 minutes ago", status: "success" as const },
];

const LIVE_NAMES = [
  { initials: "GK", name: "Grâce Kabongo", color: "#10b981" },
  { initials: "PN", name: "Pierre Nkosi",  color: "#f59e0b" },
  { initials: "LB", name: "Lucie Banza",   color: "#6366f1" },
];

// Delays for staggered initial row entrance
const INITIAL_DELAYS = ["0.8s", "1.0s", "1.2s"];

type Row = {
  id: number;
  initials: string;
  name: string;
  color: string;
  time: string;
  status: "success" | "pending";
  isNew?: boolean;
  animatingOut?: boolean;
};

export function DashboardPreview() {
  const [countDisplay, setCountDisplay] = useState("0 FC");
  const [rows, setRows] = useState<Row[]>(
    INITIAL_ROWS.map((r, i) => ({ ...r, id: i, isNew: false }))
  );
  const liveIdx = useRef(0);
  const nextId = useRef(INITIAL_ROWS.length);

  // Counter animation — counts 0 → 47,200 FC over 1.8s with ease-out
  useEffect(() => {
    const target = 47200;
    const duration = 1800;
    let start: number | null = null;
    let raf: number;
    const delay = setTimeout(() => {
      function tick(ts: number) {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        setCountDisplay(Math.floor(ease * target).toLocaleString() + " FC");
        if (progress < 1) raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }, 900);
    return () => { clearTimeout(delay); cancelAnimationFrame(raf); };
  }, []);

  // Live payment simulation — new row every 3.5s
  useEffect(() => {
    const interval = setInterval(() => {
      const p = LIVE_NAMES[liveIdx.current % LIVE_NAMES.length];
      liveIdx.current++;
      const newRow: Row = {
        id: nextId.current++,
        initials: p.initials, name: p.name, color: p.color,
        time: "Just now", status: "success", isNew: true,
      };

      setRows(prev => {
        const updated = [newRow, ...prev];
        if (updated.length > 3) {
          const last = { ...updated[updated.length - 1], animatingOut: true };
          const withExit = [...updated.slice(0, -1), last];
          setTimeout(() => setRows(r => r.filter(x => x.id !== last.id)), 350);
          return withExit;
        }
        return updated;
      });
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "20px",
      padding: "24px", width: "100%", maxWidth: "480px",
      boxShadow: "0 20px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)",
      animation: "cardFloat 5s ease-in-out infinite 1.2s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>
          École Sainte Marie — Overview
        </span>
        <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "20px", display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block", animation: "pulseGreen 1.8s ease-in-out infinite" }} />
          Live
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 500, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Collected today</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.5px" }}>{countDisplay}</div>
          <div style={{ fontSize: "12px", color: "#10b981", fontWeight: 500, marginTop: "2px" }}>+12% vs yesterday</div>
        </div>
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 500, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Students</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.5px" }}>312</div>
          <div style={{ fontSize: "12px", color: "#3b82f6", fontWeight: 500, marginTop: "2px" }}>248 paid</div>
        </div>
      </div>

      {/* Payment rows */}
      <div>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Recent payments</div>
        {rows.map((row, i) => (
          <div
            key={row.id}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: i < rows.length - 1 ? "1px solid #f1f5f9" : "none",
              // Exit animation via CSS transition
              opacity: row.animatingOut ? 0 : 1,
              transform: row.animatingOut ? "translateX(12px)" : "translateX(0)",
              transition: row.animatingOut ? "opacity 0.35s, transform 0.35s" : undefined,
              // Entrance: initial rows stagger by index; live rows use rowSlideIn
              animation: !row.animatingOut
                ? row.isNew
                  ? "rowSlideIn 0.4s cubic-bezier(0.16,1,0.3,1)"
                  : `rowSlideIn 0.5s cubic-bezier(0.16,1,0.3,1) ${INITIAL_DELAYS[i] ?? "0.8s"} both`
                : undefined,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: row.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "white" }}>
                {row.initials}
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "#0f172a" }}>{row.name}</div>
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>{row.time}</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>15,000 FC</div>
              <div style={{
                fontSize: "11px", fontWeight: 500, padding: "2px 8px", borderRadius: "10px",
                marginTop: "2px", display: "inline-block",
                ...(row.status === "success"
                  ? { background: "#dcfce7", color: "#16a34a" }
                  : { background: "#fef9c3", color: "#ca8a04", animation: "pendingShimmer 2s ease-in-out infinite" }),
              }}>
                {row.status === "success" ? "Confirmed" : "Processing"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/rod/20 Apps/Minerval/minerval" && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors from `dashboard-preview.tsx`.

---

## Task 3: Create `TelecomBar` client component

**Files:**
- Create: `app/_components/telecom-bar.tsx`

The `TelecomBar` must be a Client Component because it uses `onMouseEnter`/`onMouseLeave` event handlers to pause the marquee animation. Event handlers cannot be used on Server Components.

- [ ] **Step 1: Create the component**

```tsx
"use client";

const PILLS = [
  { label: "M-Pesa",       dot: "#22c55e", delay: "0s",   border: "#d1fae5", bg: "#f0fdf4", color: "#15803d" },
  { label: "Airtel Money", dot: "#ef4444", delay: "0.5s", border: "#fee2e2", bg: "#fff5f5", color: "#b91c1c" },
  { label: "Orange Money", dot: "#f97316", delay: "1.0s", border: "#ffedd5", bg: "#fff7ed", color: "#c2410c" },
];
// Duplicate 4× for seamless loop at any viewport width
const PILLS_LOOP = [...PILLS, ...PILLS, ...PILLS, ...PILLS];

const CHIPS = [
  "Payment via M-Pesa · 15,000 FC",
  "Payment via Airtel Money · 12,500 FC",
  "Payment via Orange Money · 20,000 FC",
  "Payment via M-Pesa · 8,000 FC",
  "Payment via Airtel Money · 15,000 FC",
  "Payment via Orange Money · 10,000 FC",
  "Payment via M-Pesa · 18,000 FC",
];
// Duplicate 2× for seamless loop
const CHIPS_LOOP = [...CHIPS, ...CHIPS];

const fadeStyle = (dir: "left" | "right") => ({
  position: "absolute" as const,
  top: 0, bottom: 0,
  [dir]: 0,
  width: 120,
  background: `linear-gradient(to ${dir === "left" ? "right" : "left"}, #f8fafc, transparent)`,
  zIndex: 2,
  pointerEvents: "none" as const,
});

export function TelecomBar() {
  return (
    <div style={{ borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", overflow: "hidden", padding: "20px 0" }}>
      <p style={{ textAlign: "center", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#94a3b8", fontWeight: 600, marginBottom: "20px" }}>
        Accepted payment networks
      </p>

      {/* Row 1 — scrolls left */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        <div style={fadeStyle("left")} />
        <div style={fadeStyle("right")} />
        <div
          className="marquee-track"
          style={{ display: "flex", gap: "12px", width: "max-content", animation: "marqueeLeft 22s linear infinite" }}
          onMouseEnter={e => (e.currentTarget.style.animationPlayState = "paused")}
          onMouseLeave={e => (e.currentTarget.style.animationPlayState = "running")}
        >
          {PILLS_LOOP.map((p, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: "9px",
              padding: "10px 20px", borderRadius: "40px",
              border: `1.5px solid ${p.border}`, background: p.bg, color: p.color,
              fontSize: "14px", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
              animation: `pillPop 0.5s cubic-bezier(0.34,1.56,0.64,1) ${p.delay} both`,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.dot, display: "inline-block", animation: `pulseDotColored 2s ease-in-out infinite ${p.delay}` }} />
              {p.label}
            </div>
          ))}
        </div>
      </div>

      {/* Row 2 — scrolls right */}
      <div style={{ position: "relative", overflow: "hidden", marginTop: "10px" }}>
        <div style={fadeStyle("left")} />
        <div style={fadeStyle("right")} />
        <div
          className="marquee-track-reverse"
          style={{ display: "flex", gap: "12px", width: "max-content", animation: "marqueeRight 30s linear infinite" }}
          onMouseEnter={e => (e.currentTarget.style.animationPlayState = "paused")}
          onMouseLeave={e => (e.currentTarget.style.animationPlayState = "running")}
        >
          {CHIPS_LOOP.map((chip, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "9px 18px", borderRadius: "40px",
              background: "white", border: "1px solid #e2e8f0",
              fontSize: "12px", color: "#64748b", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "pulseDotColored 2s ease-in-out infinite" }} />
              {chip}
            </div>
          ))}
        </div>
      </div>

      <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "#94a3b8" }}>
        Parents pay from any phone · No app download · No new account needed
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/rod/20 Apps/Minerval/minerval" && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors from `telecom-bar.tsx`.

---

## Task 4: Build `app/page.tsx` — Server Component landing page

**Files:**
- Modify: `app/page.tsx` (replace entire file)

- [ ] **Step 1: Write the full page component**

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Outfit } from "next/font/google";
import Link from "next/link";
import { createSSRClient } from "@/lib/supabase";
import { DashboardPreview } from "@/app/_components/dashboard-preview";
import { TelecomBar } from "@/app/_components/telecom-bar";
import "@/app/landing.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Minerval — Collect School Fees by Mobile Money",
  description:
    "Stop chasing payments. Let parents pay school fees via M-Pesa, Airtel Money, and Orange Money. Free to start.",
};

export default async function LandingPage() {
  // Redirect authenticated admins straight to the dashboard
  try {
    const supabase = await createSSRClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  } catch {
    // SSR client reads cookies and may throw outside a request context — treat as unauthenticated
  }

  return (
    <div className={outfit.className} style={{ background: "#fff", color: "#0f172a", overflowX: "hidden" }}>

      {/* ── NAV ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #e2e8f0", padding: "0 48px", height: "60px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        animation: "navSlideDown 0.6s cubic-bezier(0.16,1,0.3,1) both",
      }}>
        <span style={{ fontSize: "20px", fontWeight: 700, color: "#1d4ed8", letterSpacing: "-0.5px" }}>Minerval</span>
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <a href="#how-it-works" style={{ fontSize: "14px", color: "#475569", textDecoration: "none", fontWeight: 500 }}>How it works</a>
          <span style={{ fontSize: "14px", color: "#475569", fontWeight: 500 }}>For schools</span>
          <Link href="/signup" className="btn-cta" style={{
            background: "#1d4ed8", color: "white",
            padding: "9px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: 600,
            boxShadow: "0 4px 14px rgba(29,78,216,0.2)",
          }}>Get started free</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        minHeight: "100dvh", paddingTop: "60px",
        display: "grid", gridTemplateColumns: "1fr 1fr",
        maxWidth: "1400px", margin: "0 auto",
        padding: "60px 48px 0 64px", alignItems: "center", gap: "64px",
      }}>
        {/* Left */}
        <div style={{ paddingTop: "24px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "#eff6ff", border: "1px solid #bfdbfe",
            padding: "6px 14px", borderRadius: "20px",
            fontSize: "13px", fontWeight: 500, color: "#1d4ed8", marginBottom: "28px",
            animation: "fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s both",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6", animation: "pulseDot 2s ease-in-out infinite", display: "inline-block" }} />
            Mobile money · M-Pesa · Airtel Money · Orange
          </div>

          <h1 style={{
            fontSize: "clamp(36px, 4.5vw, 58px)", fontWeight: 800, lineHeight: 1.08,
            letterSpacing: "-1.5px", color: "#0f172a", marginBottom: "20px",
            animation: "fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.22s both",
          }}>
            Stop chasing<br />payments. Let<br />parents{" "}
            <span style={{ color: "#1d4ed8" }}>pay from<br />their phone.</span>
          </h1>

          <p style={{
            fontSize: "17px", color: "#475569", lineHeight: 1.65,
            maxWidth: "460px", marginBottom: "36px",
            animation: "fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.34s both",
          }}>
            No cash handling. No delays. School fees collected via mobile money and tracked in real time — all from one dashboard.
          </p>

          <div style={{
            display: "flex", alignItems: "center", gap: "14px", marginBottom: "48px",
            animation: "fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.44s both",
          }}>
            <Link href="/signup" className="btn-cta" style={{
              background: "#1d4ed8", color: "white", padding: "14px 28px",
              borderRadius: "10px", fontSize: "15px", fontWeight: 600,
              boxShadow: "0 4px 14px rgba(29,78,216,0.3)",
            }}>
              Create your school — free
            </Link>
            <a href="#how-it-works" style={{
              color: "#475569", fontSize: "14px", fontWeight: 500,
              textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px",
              transition: "color 0.2s",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" />
              </svg>
              See how it works
            </a>
          </div>

          <div style={{
            fontSize: "13px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px",
            animation: "fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.52s both",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Free to start. No setup fees. No card required.
          </div>
        </div>

        {/* Right — Client Component */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          animation: "slideInRight 0.9s cubic-bezier(0.16,1,0.3,1) 0.35s both",
        }}>
          <DashboardPreview />
        </div>
      </section>

      {/* ── TELECOM BAR — Client Component ── */}
      <TelecomBar />

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ maxWidth: "1400px", margin: "0 auto", padding: "96px 64px" }}>
        <p className="reveal" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#3b82f6", fontWeight: 600, marginBottom: "14px" }}>
          How it works
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "end" }}>
          <h2 className="reveal" style={{ fontSize: "clamp(28px,3vw,42px)", fontWeight: 700, letterSpacing: "-1px", color: "#0f172a" }}>
            Three steps from signup<br />to first payment
          </h2>
          <p className="reveal" style={{ fontSize: "16px", color: "#64748b", maxWidth: "480px", lineHeight: 1.6, paddingBottom: "6px" }}>
            No technical setup. No bank account required. If you have a school and a phone number, you&apos;re ready.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginTop: "56px" }}>
          {[
            { n: 1, title: "Register your school",    desc: "Create an account, enter your school name and student ID prefix. Takes under 2 minutes." },
            { n: 2, title: "Import your students",    desc: "Upload a CSV or add students manually. Each student gets a unique ID and their fee amount automatically." },
            { n: 3, title: "Share your payment link", desc: "Send your unique link to parents. They enter their child's ID, choose M-Pesa or Airtel, and pay in seconds." },
          ].map((step, i) => (
            <div key={step.n} className="reveal step-card" style={{
              padding: "32px 40px 32px 0",
              borderRight: i < 2 ? "1px solid #e2e8f0" : "none",
              marginRight: i < 2 ? "40px" : 0,
            }}>
              <div className="step-num" style={{
                width: 40, height: 40, borderRadius: "50%", background: "#1d4ed8",
                color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "15px", fontWeight: 700, marginBottom: "20px",
              }}>
                {step.n}
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", letterSpacing: "-0.3px" }}>{step.title}</h3>
              <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.65 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 64px 96px" }}>
        <p className="reveal" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#3b82f6", fontWeight: 600, marginBottom: "14px" }}>What you get</p>
        <h2 className="reveal" style={{ fontSize: "clamp(28px,3vw,42px)", fontWeight: 700, letterSpacing: "-1px", color: "#0f172a" }}>
          Everything a school needs.<br />Nothing it doesn&apos;t.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px", marginTop: "56px", background: "#e2e8f0", borderRadius: "20px", overflow: "hidden" }}>
          {[
            { title: "Mobile money payments", desc: "Accept M-Pesa, Airtel Money, and Orange Money. Parents pay from any phone, no app download needed.",
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> },
            { title: "Student roster", desc: "Manage your full student list, track who has paid, and import hundreds of records via CSV in one click.",
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
            { title: "Real-time dashboard", desc: "See every payment the moment it lands. Filter by class, date, or status. No manual reconciliation.",
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
            { title: "Instant receipts", desc: "Every successful payment generates a shareable receipt page. Parents can save or print it as proof.",
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
          ].map((f, i) => (
            <div key={f.title} className="reveal feature-card" style={{
              background: "white", padding: "40px",
              borderRadius: i === 0 ? "20px 0 0 0" : i === 1 ? "0 20px 0 0" : i === 2 ? "0 0 0 20px" : "0 0 20px 0",
            }}>
              <div className="feature-icon" style={{
                width: 44, height: 44, borderRadius: "12px", background: "#eff6ff",
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px",
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>{f.title}</h3>
              <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <div style={{ background: "#1d4ed8", padding: "80px 64px", textAlign: "center" }}>
        <div className="reveal" style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 800, color: "white", letterSpacing: "-1.2px", marginBottom: "14px" }}>
            Ready to stop chasing fees?
          </h2>
          <p style={{ fontSize: "16px", color: "#bfdbfe", marginBottom: "32px", lineHeight: 1.6 }}>
            Free to start. Your first payment link is ready in under 5 minutes.
          </p>
          <Link href="/signup" className="btn-cta-white" style={{
            background: "white", color: "#1d4ed8", padding: "15px 32px",
            borderRadius: "10px", fontSize: "15px", fontWeight: 700,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }}>
            Create your school — free
          </Link>
          <p style={{ fontSize: "13px", color: "#93c5fd", marginTop: "14px" }}>No setup fees. No card required.</p>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#0f172a", padding: "32px 64px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "16px", fontWeight: 700, color: "white" }}>Minerval</span>
        <span style={{ fontSize: "13px", color: "#475569" }}>© 2026 Minerval. Built for Congo schools.</span>
      </footer>

      {/* Inline scroll-reveal script */}
      <script dangerouslySetInnerHTML={{ __html: `(function(){var o=new IntersectionObserver(function(e){e.forEach(function(e){if(e.isIntersecting){e.target.classList.add('revealed');o.unobserve(e.target)}})},{threshold:0.12});document.querySelectorAll('.reveal').forEach(function(el){o.observe(el)})})()` }} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/rod/20 Apps/Minerval/minerval" && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

---

## Task 5: Build check + smoke test

- [ ] **Step 1: Run build**

```bash
cd "/Users/rod/20 Apps/Minerval/minerval" && npm run build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully`. No type errors, no "use client" boundary errors.

- [ ] **Step 2: Start dev server**

```bash
cd "/Users/rod/20 Apps/Minerval/minerval" && npm run dev &
sleep 4
```

- [ ] **Step 3: Manual smoke check**

Visit `http://localhost:3000` (or `:3001` if `:3000` is busy). Verify:
- Nav slides down on load
- Headline "Stop chasing payments" visible, hero badge pulses
- Dashboard card floats and counter counts up from 0
- Payment rows slide in staggered (0.8s, 1.0s, 1.2s)
- New payments arrive every ~3.5s, old ones exit
- Telecom bar — both marquee rows scroll (opposite directions)
- Hover over marquee pauses animation
- "Get started free" and "Create your school — free" both navigate to `/signup`
- "See how it works" scrolls smoothly to the How It Works section
- Scrolling down reveals sections with fade-up animation
- Feature icons tilt on hover
- Step numbers scale on hover

- [ ] **Step 4: Verify authenticated redirect**

Log in at `/login`, then navigate to `http://localhost:3000`. Should redirect immediately to `/dashboard`.

- [ ] **Step 5: Kill dev server, then commit**

```bash
kill %1 2>/dev/null; cd "/Users/rod/20 Apps/Minerval/minerval"
git add app/page.tsx app/landing.css "app/_components/dashboard-preview.tsx" "app/_components/telecom-bar.tsx" docs/superpowers/
git commit -m "feat: add animated landing page for school admin acquisition"
```

---

## Notes for Implementer

- **`createSSRClient` try/catch**: intentional — the SSR client reads cookies and can throw in static generation contexts. If it fails, treat as unauthenticated and render the landing page.
- **`dangerouslySetInnerHTML` for scroll-reveal script**: authored code, not user input — no XSS risk. Standard Next.js App Router pattern.
- **Marquee seamless loop**: the `translateX(-50%)` trick requires the track to be exactly 2× the visible content. Pills are duplicated 4× (each set of 3 is short) and chips 2× (7 items × 2 is wide enough). If the loop looks jumpy, add more duplicates.
- **`.btn-cta` and `.btn-cta-white`**: CSS class names applied to `Link` components. They get their base styles from `landing.css` — hover lift, box-shadow transition. The `style` prop on the Link sets the visual appearance; the class handles the interaction.
- **`TelecomBar` is `"use client"`**: required because it uses `onMouseEnter`/`onMouseLeave`. Event handlers cannot be attached to elements in Server Components.
- **Initial row stagger**: rows use `animationDelay` via the `INITIAL_DELAYS` array. The `both` fill-mode keeps them invisible until the delay fires, then holds the final state.
