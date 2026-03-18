"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ── Animated counter ──────────────────────────────────────────────────────────
function useCounter(target: number, duration: number, delay: number) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      let start: number | null = null;
      function frame(ts: number) {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        setValue(Math.floor(ease * target));
        if (progress < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }, delay);
    return () => clearTimeout(t);
  }, [target, duration, delay]);
  return value;
}

// ── Live payments cycling ─────────────────────────────────────────────────────
const PAYMENT_NAMES = [
  { initials: "MK", name: "Marie Kalinda",  color: "#3b82f6" },
  { initials: "JM", name: "Jonas Mutombo",  color: "#8b5cf6" },
  { initials: "AB", name: "Aline Bukasa",   color: "#0ea5e9" },
  { initials: "GK", name: "Grâce Kabongo",  color: "#10b981" },
  { initials: "PN", name: "Pierre Nkosi",   color: "#f59e0b" },
  { initials: "LB", name: "Lucie Banza",    color: "#6366f1" },
];

type PayRow = { id: number; initials: string; name: string; color: string; time: string; status: "Confirmed" | "Processing" };

function DashboardCard() {
  const collected = useCounter(47200, 1800, 900);
  const [rows, setRows] = useState<PayRow[]>([
    { id: 0, ...PAYMENT_NAMES[0], time: "2 minutes ago",   status: "Confirmed" },
    { id: 1, ...PAYMENT_NAMES[1], time: "18 minutes ago",  status: "Processing" },
    { id: 2, ...PAYMENT_NAMES[2], time: "34 minutes ago",  status: "Confirmed" },
  ]);
  const idxRef = useRef(3);

  useEffect(() => {
    const t = setInterval(() => {
      const p = PAYMENT_NAMES[idxRef.current++ % PAYMENT_NAMES.length];
      setRows((prev) => [
        { id: Date.now(), ...p, time: "Just now", status: "Confirmed" },
        ...prev.slice(0, 2),
      ]);
    }, 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 20,
      padding: 24, width: "100%", maxWidth: 480,
      boxShadow: "0 20px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)",
      animation: "cardFloat 5s ease-in-out infinite 1.2s",
    }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>École Sainte Marie — Overview</span>
        <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block", animation: "pulseGreen 1.8s ease-in-out infinite" }} />
          Live
        </span>
      </div>
      {/* stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Collected today</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.5px" }}>{collected.toLocaleString()} FC</div>
          <div style={{ fontSize: 12, color: "#10b981", fontWeight: 500, marginTop: 2 }}>+12% vs yesterday</div>
        </div>
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Students</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.5px" }}>312</div>
          <div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 500, marginTop: 2 }}>248 paid</div>
        </div>
      </div>
      {/* payments */}
      <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>Recent payments</div>
      <div>
        {rows.map((row) => (
          <div key={row.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f1f5f9", animation: "rowSlideIn 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: row.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white" }}>{row.initials}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{row.name}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{row.time}</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>15,000 FC</div>
              <span style={{
                fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 10, marginTop: 2, display: "inline-block",
                background: row.status === "Confirmed" ? "#dcfce7" : "#fef9c3",
                color: row.status === "Confirmed" ? "#16a34a" : "#ca8a04",
              }}>{row.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scroll reveal hook ────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(32px)",
      transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; overflow-x: hidden; }
        body { font-family: 'Outfit', system-ui, sans-serif !important; background: #fff !important; color: #0f172a; -webkit-font-smoothing: antialiased; }

        @keyframes navSlideDown { from { transform: translateY(-100%); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideInRight { from { opacity:0; transform:translateX(32px) translateY(12px); } to { opacity:1; transform:translateX(0) translateY(0); } }
        @keyframes cardFloat { 0%,100% { transform:translateY(0); box-shadow:0 20px 60px rgba(15,23,42,0.08),0 4px 16px rgba(15,23,42,0.04); } 50% { transform:translateY(-8px); box-shadow:0 32px 80px rgba(15,23,42,0.12),0 8px 24px rgba(15,23,42,0.06); } }
        @keyframes rowSlideIn { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
        @keyframes pulseBadge { 0%,100% { box-shadow:0 0 0 3px rgba(59,130,246,0.25); } 50% { box-shadow:0 0 0 6px rgba(59,130,246,0.08); } }
        @keyframes pulseGreen { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.8); } }
        @keyframes marqueeLeft { from { transform:translateX(0); } to { transform:translateX(-50%); } }
        @keyframes marqueeRight { from { transform:translateX(-50%); } to { transform:translateX(0); } }
        @keyframes pulseDot { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.5); opacity:0.6; } }

        .landing-nav { position:fixed; top:0; left:0; right:0; z-index:100; background:rgba(255,255,255,0.92); backdrop-filter:blur(12px); border-bottom:1px solid #e2e8f0; padding:0 48px; height:60px; display:flex; align-items:center; justify-content:space-between; animation:navSlideDown 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .landing-hero { min-height:100dvh; padding-top:60px; display:grid; grid-template-columns:1fr 1fr; max-width:1400px; margin:0 auto; padding-left:64px; padding-right:48px; align-items:center; gap:64px; }
        .hero-left { padding-top:24px; }
        .hero-badge { display:inline-flex; align-items:center; gap:8px; background:#eff6ff; border:1px solid #bfdbfe; padding:6px 14px; border-radius:20px; font-size:13px; font-weight:500; color:#1d4ed8; margin-bottom:28px; animation:fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.10s both; }
        .hero-badge-dot { width:7px; height:7px; border-radius:50%; background:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.25); animation:pulseBadge 2s ease-in-out infinite; }
        .hero-h1 { font-size:clamp(36px,4.5vw,58px); font-weight:800; line-height:1.08; letter-spacing:-1.5px; color:#0f172a; margin-bottom:20px; animation:fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.22s both; }
        .hero-h1 span { color:#1d4ed8; }
        .hero-sub { font-size:17px; color:#475569; line-height:1.65; max-width:460px; margin-bottom:36px; animation:fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.34s both; }
        .hero-actions { display:flex; align-items:center; gap:14px; margin-bottom:48px; animation:fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.44s both; }
        .hero-note { font-size:13px; color:#94a3b8; display:flex; align-items:center; gap:6px; animation:fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.52s both; }
        .hero-right { display:flex; align-items:center; justify-content:flex-end; animation:slideInRight 0.9s cubic-bezier(0.16,1,0.3,1) 0.35s both; }
        .btn-primary { background:#1d4ed8; color:white; border:none; padding:14px 28px; border-radius:10px; font-size:15px; font-weight:600; cursor:pointer; font-family:'Outfit',sans-serif; box-shadow:0 4px 14px rgba(29,78,216,0.3); transition:background 0.2s,transform 0.15s,box-shadow 0.2s; text-decoration:none; display:inline-block; }
        .btn-primary:hover { background:#1e40af; box-shadow:0 8px 24px rgba(29,78,216,0.4); transform:translateY(-1px); }
        .btn-ghost { background:transparent; color:#475569; border:none; padding:14px 20px; font-size:14px; font-weight:500; cursor:pointer; font-family:'Outfit',sans-serif; display:flex; align-items:center; gap:6px; transition:color 0.2s; text-decoration:none; }
        .btn-ghost:hover { color:#1d4ed8; }

        .telecom-section { border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; background:#f8fafc; overflow:hidden; padding:20px 0; }
        .telecom-intro { text-align:center; font-size:12px; text-transform:uppercase; letter-spacing:1.5px; color:#94a3b8; font-weight:600; margin-bottom:20px; }
        .telecom-tagline { text-align:center; margin-top:20px; font-size:13px; color:#94a3b8; }
        .marquee-wrapper { position:relative; overflow:hidden; }
        .marquee-wrapper::before,.marquee-wrapper::after { content:''; position:absolute; top:0; bottom:0; width:120px; z-index:2; pointer-events:none; }
        .marquee-wrapper::before { left:0; background:linear-gradient(to right,#f8fafc,transparent); }
        .marquee-wrapper::after { right:0; background:linear-gradient(to left,#f8fafc,transparent); }
        .marquee-track { display:flex; gap:12px; width:max-content; animation:marqueeLeft 22s linear infinite; }
        .marquee-track:hover { animation-play-state:paused; }
        .marquee-track-reverse { display:flex; gap:12px; width:max-content; margin-top:10px; animation:marqueeRight 30s linear infinite; }
        .marquee-track-reverse:hover { animation-play-state:paused; }
        .m-pill { display:flex; align-items:center; gap:10px; padding:12px 22px; border-radius:40px; border:1.5px solid; font-size:14px; font-weight:700; white-space:nowrap; cursor:default; flex-shrink:0; transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1); }
        .m-pill:hover { transform:translateY(-3px); }
        .m-pill-dot { width:8px; height:8px; border-radius:50%; animation:pulseDot 2s ease-in-out infinite; }
        .pill-mpesa  { border-color:#d1fae5; background:#f0fdf4; color:#15803d; }
        .pill-mpesa .m-pill-dot { background:#22c55e; }
        .pill-airtel { border-color:#fee2e2; background:#fff5f5; color:#b91c1c; }
        .pill-airtel .m-pill-dot { background:#ef4444; animation-delay:0.5s; }
        .pill-orange { border-color:#ffedd5; background:#fff7ed; color:#c2410c; }
        .pill-orange .m-pill-dot { background:#f97316; animation-delay:1s; }
        .m-sep { display:flex; align-items:center; padding:0 8px; font-size:18px; color:#cbd5e1; font-weight:300; flex-shrink:0; user-select:none; }
        .activity-chip { display:flex; align-items:center; gap:8px; padding:9px 18px; border-radius:40px; background:white; border:1px solid #e2e8f0; font-size:12px; color:#64748b; font-weight:500; white-space:nowrap; flex-shrink:0; }
        .chip-dot { width:6px; height:6px; border-radius:50%; background:#10b981; animation:pulseDot 2s ease-in-out infinite; }

        .land-section { max-width:1400px; margin:0 auto; padding:96px 64px; }
        .section-label { font-size:12px; text-transform:uppercase; letter-spacing:1.5px; color:#3b82f6; font-weight:600; margin-bottom:14px; }
        .section-title { font-size:clamp(28px,3vw,42px); font-weight:700; letter-spacing:-1px; color:#0f172a; margin-bottom:12px; }
        .section-sub { font-size:16px; color:#64748b; max-width:480px; line-height:1.6; }
        .steps-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0; margin-top:56px; }
        .step { padding:32px 40px 32px 0; border-right:1px solid #e2e8f0; margin-right:40px; }
        .step:last-child { border-right:none; margin-right:0; padding-right:0; }
        .step-num { width:40px; height:40px; border-radius:50%; background:#1d4ed8; color:white; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; margin-bottom:20px; transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.3s; }
        .step:hover .step-num { transform:scale(1.15); box-shadow:0 4px 16px rgba(29,78,216,0.35); }
        .step-title { font-size:18px; font-weight:700; color:#0f172a; margin-bottom:10px; }
        .step-desc { font-size:14px; color:#64748b; line-height:1.65; }
        .features-grid { display:grid; grid-template-columns:1fr 1fr; gap:2px; margin-top:56px; background:#e2e8f0; border-radius:20px; overflow:hidden; }
        .feature { background:white; padding:40px; transition:background 0.25s; }
        .feature:first-child  { border-radius:20px 0 0 0; }
        .feature:nth-child(2) { border-radius:0 20px 0 0; }
        .feature:nth-child(3) { border-radius:0 0 0 20px; }
        .feature:last-child   { border-radius:0 0 20px 0; }
        .feature:hover { background:#f8faff; }
        .feature-icon { width:44px; height:44px; border-radius:12px; background:#eff6ff; display:flex; align-items:center; justify-content:center; margin-bottom:18px; transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1),background 0.25s; }
        .feature:hover .feature-icon { transform:scale(1.12) rotate(-4deg); background:#dbeafe; }
        .feature-title { font-size:17px; font-weight:700; color:#0f172a; margin-bottom:8px; }
        .feature-desc { font-size:14px; color:#64748b; line-height:1.65; }
        .cta-section { background:#1d4ed8; padding:80px 64px; text-align:center; position:relative; overflow:hidden; }
        .cta-section::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 20% 50%,rgba(255,255,255,0.06) 0%,transparent 60%),radial-gradient(ellipse at 80% 50%,rgba(255,255,255,0.04) 0%,transparent 60%); pointer-events:none; }
        .cta-inner { max-width:600px; margin:0 auto; position:relative; }
        .cta-title { font-size:clamp(28px,3.5vw,44px); font-weight:800; color:white; letter-spacing:-1.2px; margin-bottom:14px; }
        .cta-sub { font-size:16px; color:#bfdbfe; margin-bottom:32px; line-height:1.6; }
        .btn-cta-white { background:white; color:#1d4ed8; border:none; padding:15px 32px; border-radius:10px; font-size:15px; font-weight:700; cursor:pointer; font-family:'Outfit',sans-serif; box-shadow:0 4px 20px rgba(0,0,0,0.15); transition:transform 0.2s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.2s; display:inline-block; text-decoration:none; }
        .btn-cta-white:hover { transform:translateY(-3px) scale(1.02); box-shadow:0 12px 32px rgba(0,0,0,0.22); }
        .land-footer { background:#0f172a; padding:32px 64px; display:flex; justify-content:space-between; align-items:center; }

        @media (max-width: 900px) {
          .landing-hero { grid-template-columns:1fr; padding-left:24px; padding-right:24px; padding-top:80px; gap:40px; }
          .hero-right { justify-content:center; }
          .land-section { padding:64px 24px; }
          .steps-grid { grid-template-columns:1fr; }
          .step { border-right:none; margin-right:0; padding-right:0; border-bottom:1px solid #e2e8f0; padding-bottom:32px; }
          .step:last-child { border-bottom:none; }
          .features-grid { grid-template-columns:1fr; }
          .feature:first-child,.feature:nth-child(2),.feature:nth-child(3),.feature:last-child { border-radius:0; }
          .cta-section { padding:64px 24px; }
          .land-footer { flex-direction:column; gap:12px; padding:24px; }
          .landing-nav { padding:0 24px; }
        }
      `}</style>

      {/* Nav */}
      <nav className="landing-nav">
        <span style={{ fontSize: 20, fontWeight: 700, color: "#1d4ed8", letterSpacing: "-0.5px" }}>Minerval</span>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <a href="#how-it-works" style={{ fontSize: 14, color: "#475569", textDecoration: "none", fontWeight: 500 }}>How it works</a>
          <a href="#features" style={{ fontSize: 14, color: "#475569", textDecoration: "none", fontWeight: 500 }}>For schools</a>
          <Link href="/login" style={{ fontSize: 14, color: "#475569", textDecoration: "none", fontWeight: 500 }}>Log in</Link>
          <Link href="/signup" className="btn-primary" style={{ padding: "9px 20px", fontSize: 14, borderRadius: 8 }}>Get started free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-left">
          <div className="hero-badge"><div className="hero-badge-dot" />Mobile money · M-Pesa · Airtel Money · Orange</div>
          <h1 className="hero-h1">Stop chasing<br />payments. Let<br />parents <span>pay from<br />their phone.</span></h1>
          <p className="hero-sub">No cash handling. No delays. School fees collected via mobile money and tracked in real time — all from one dashboard.</p>
          <div className="hero-actions">
            <Link href="/signup" className="btn-primary">Create your school — free</Link>
            <a href="#how-it-works" className="btn-ghost">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
              See how it works
            </a>
          </div>
          <div className="hero-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            Free to start. No setup fees. No card required.
          </div>
        </div>
        <div className="hero-right">
          <DashboardCard />
        </div>
      </section>

      {/* Telecom bar */}
      <div className="telecom-section">
        <div className="telecom-intro">Accepted payment networks</div>
        <div className="marquee-wrapper">
          <div className="marquee-track">
            {[...Array(2)].flatMap((_, i) => [
              <div key={`mpesa-${i}-1`} className="m-pill pill-mpesa"><div className="m-pill-dot" />M-Pesa</div>,
              <div key={`sep1-${i}-1`} className="m-sep">·</div>,
              <div key={`airtel-${i}-1`} className="m-pill pill-airtel"><div className="m-pill-dot" />Airtel Money</div>,
              <div key={`sep2-${i}-1`} className="m-sep">·</div>,
              <div key={`orange-${i}-1`} className="m-pill pill-orange"><div className="m-pill-dot" />Orange Money</div>,
              <div key={`sep3-${i}-1`} className="m-sep">·</div>,
              <div key={`mpesa-${i}-2`} className="m-pill pill-mpesa"><div className="m-pill-dot" />M-Pesa</div>,
              <div key={`sep4-${i}-2`} className="m-sep">·</div>,
              <div key={`airtel-${i}-2`} className="m-pill pill-airtel"><div className="m-pill-dot" />Airtel Money</div>,
              <div key={`sep5-${i}-2`} className="m-sep">·</div>,
              <div key={`orange-${i}-2`} className="m-pill pill-orange"><div className="m-pill-dot" />Orange Money</div>,
              <div key={`sep6-${i}-2`} className="m-sep">·</div>,
            ])}
          </div>
        </div>
        <div className="marquee-wrapper" style={{ marginTop: 10 }}>
          <div className="marquee-track-reverse">
            {[...Array(2)].flatMap((_, i) => [
              { net: "M-Pesa", amount: "15,000 FC" },
              { net: "Airtel Money", amount: "12,500 FC" },
              { net: "Orange Money", amount: "20,000 FC" },
              { net: "M-Pesa", amount: "8,000 FC" },
              { net: "Airtel Money", amount: "15,000 FC" },
              { net: "Orange Money", amount: "10,000 FC" },
              { net: "M-Pesa", amount: "18,000 FC" },
            ].map((c, j) => (
              <div key={`chip-${i}-${j}`} className="activity-chip">
                <div className="chip-dot" />Payment via <strong>{c.net}</strong> · {c.amount}
              </div>
            )))}
          </div>
        </div>
        <div className="telecom-tagline">Parents pay from any phone · No app download · No new account needed</div>
      </div>

      {/* How it works */}
      <section className="land-section" id="how-it-works">
        <Reveal><div className="section-label">How it works</div></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "end", gap: 24 }}>
          <Reveal delay={100}><div className="section-title">Three steps from signup<br />to first payment</div></Reveal>
          <Reveal delay={200}><div className="section-sub">No technical setup. No bank account required. If you have a school and a phone number, you&apos;re ready.</div></Reveal>
        </div>
        <div className="steps-grid">
          {[
            { n: 1, title: "Register your school", desc: "Create an account, enter your school name and student ID prefix. Takes under 2 minutes." },
            { n: 2, title: "Import your students", desc: "Upload a CSV or add students manually. Each student gets a unique ID and their fee amount automatically." },
            { n: 3, title: "Share your payment link", desc: "Send your unique link to parents. They enter their child's ID, choose M-Pesa or Airtel, and pay in seconds." },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <div className="step">
                <div className="step-num">{s.n}</div>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="land-section" id="features" style={{ paddingTop: 0 }}>
        <Reveal><div className="section-label">What you get</div></Reveal>
        <Reveal delay={100}><div className="section-title">Everything a school needs.<br />Nothing it doesn&apos;t.</div></Reveal>
        <div className="features-grid">
          {[
            {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>,
              title: "Mobile money payments",
              desc: "Accept M-Pesa, Airtel Money, and Orange Money. Parents pay from any phone, no app download needed.",
            },
            {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>,
              title: "Student roster",
              desc: "Manage your full student list, track who has paid, and import hundreds of records via CSV in one click.",
            },
            {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
              title: "Real-time dashboard",
              desc: "See every payment the moment it lands. Filter by class, date, or status. No manual reconciliation.",
            },
            {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
              title: "Instant receipts",
              desc: "Every successful payment generates a shareable receipt page. Parents can save or print it as proof.",
            },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 100}>
              <div className="feature">
                <div className="feature-icon">{f.icon}</div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="cta-section">
        <Reveal>
          <div className="cta-inner">
            <div className="cta-title">Ready to stop chasing fees?</div>
            <div className="cta-sub">Free to start. Your first payment link is ready in under 5 minutes.</div>
            <Link href="/signup" className="btn-cta-white">Create your school — free</Link>
            <div style={{ fontSize: 13, color: "#93c5fd", marginTop: 14 }}>No setup fees. No card required.</div>
          </div>
        </Reveal>
      </div>

      {/* Footer */}
      <footer className="land-footer">
        <span style={{ fontSize: 16, fontWeight: 700, color: "white" }}>Minerval</span>
        <span style={{ fontSize: 13, color: "#475569" }}>© 2026 Minerval. Built for Congo schools.</span>
      </footer>
    </>
  );
}
