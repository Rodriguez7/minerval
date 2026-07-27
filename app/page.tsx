"use client";
import { useEffect, useRef, useState } from "react";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import { useLocale } from "@/lib/i18n/client";
import { formatMoney, formatNumber } from "@/lib/i18n/format";

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

type PageLocale = "fr" | "en";
type PaymentStatus = "confirmed" | "processing";
type PayRow = { id: number; initials: string; name: string; color: string; time: string; status: PaymentStatus };

const HOME_COPY = {
  fr: {
    nav: {
      howItWorks: "Comment ça marche",
      forSchools: "Pour les écoles",
      login: "Connexion",
      signup: "Commencer gratuitement",
    },
    hero: {
      badge: "Rappels WhatsApp automatiques · Paiement mobile money",
      titleLines: [
        "Automatisez le recouvrement",
        "des frais scolaires.",
        "Les parents paient",
        "depuis WhatsApp.",
      ],
      description:
        "Minerval détecte les soldes impayés, envoie automatiquement un rappel en français avec un lien sécurisé, puis rapproche chaque paiement avec le bon élève.",
      cta: "Créer mon école gratuitement",
      secondary: "Voir le parcours",
      note: "Sans frais d’installation · Sans carte bancaire · Rappels sous votre contrôle",
    },
    telecom: {
      intro: "Paiement depuis le téléphone du parent",
      activityPrefix: "Paiement via",
      tagline: "M-Pesa · Airtel Money · Orange Money · Aucun téléchargement · Aucun nouveau compte",
    },
    trust: {
      label: "Une automatisation responsable",
      items: [
        { title: "Messages approuvés par Meta", desc: "Des modèles WhatsApp en français, clairs et non promotionnels." },
        { title: "Consentement enregistré", desc: "Chaque responsable donne son accord et peut se désinscrire." },
        { title: "Liens de paiement sécurisés", desc: "Chaque lien est personnel, révocable et limité dans le temps." },
        { title: "Arrêt après paiement", desc: "Dès qu’un paiement est confirmé, les prochains rappels sont annulés." },
      ],
    },
    how: {
      label: "Comment ça marche",
      titleLines: [
        "Trois étapes, sans campagne",
        "ni relance manuelle",
      ],
      description:
        "L’école garde le contrôle, mais n’a aucun élève à sélectionner et aucune campagne à créer.",
      steps: [
        {
          title: "Ajoutez l’élève et son responsable",
          desc: "Importez vos élèves ou ajoutez-les manuellement avec le numéro WhatsApp et le consentement du parent ou tuteur.",
        },
        {
          title: "Minerval envoie les rappels",
          desc: "Lorsqu’un solde arrive à échéance, Minerval envoie automatiquement le bon rappel, au bon moment, en français.",
        },
        {
          title: "Le paiement est rapproché",
          desc: "Le parent appuie sur « Payer maintenant », règle par mobile money et le solde de l’élève est mis à jour automatiquement.",
        },
      ],
    },
    features: {
      label: "Tout le parcours, au même endroit",
      titleLines: [
        "Moins de relances.",
        "Plus de visibilité.",
      ],
      items: [
        {
          title: "Rappels WhatsApp automatiques",
          desc: "Chaque solde éligible suit une séquence de rappels sans sélection manuelle de l’école.",
        },
        {
          title: "Paiement mobile money sécurisé",
          desc: "Le parent ouvre son lien personnel et paie depuis son téléphone avec M-Pesa, Airtel Money ou Orange Money.",
        },
        {
          title: "Rapprochement automatique",
          desc: "Chaque paiement confirmé est associé au bon élève et interrompt immédiatement les rappels restants.",
        },
        {
          title: "Suivi et reçus en temps réel",
          desc: "L’école suit les paiements, les statuts d’envoi WhatsApp et les soldes, tandis que le parent reçoit un reçu partageable.",
        },
      ],
    },
    cta: {
      title: "Prêt à automatiser vos relances ?",
      description:
        "Créez votre école, ajoutez un premier élève et configurez votre suivi en quelques minutes.",
      button: "Créer mon école gratuitement",
      note: "Sans frais d’installation. Sans carte bancaire.",
    },
    footer: "© 2026 Minerval. Conçu pour les écoles de la RDC.",
    legal: { privacy: "Confidentialité", terms: "Conditions", refunds: "Remboursements" },
    card: {
      header: "École Sainte-Marie — Recouvrement",
      live: "En direct",
      collectedToday: "Recouvré aujourd’hui",
      collectedChange: "+12 % vs hier",
      students: "Élèves",
      studentsPaid: "248 à jour",
      automationTitle: "Relance WhatsApp automatique",
      automationMessage: "Bonjour Maman Kabongo, les frais de Grâce restent dus. Consultez le solde et payez en toute sécurité.",
      payNow: "Payer maintenant",
      automationStatus: "Programmé selon l’échéance",
      recentPayments: "Paiements rapprochés",
      confirmed: "Rapproché",
      processing: "En confirmation",
      times: ["Il y a 2 min", "Il y a 18 min", "Il y a 34 min"] as [string, string, string],
      justNow: "À l’instant",
    },
  },
  en: {
    nav: {
      howItWorks: "How it works",
      forSchools: "For schools",
      login: "Log in",
      signup: "Get started free",
    },
    hero: {
      badge: "Automatic WhatsApp reminders · Mobile money payments",
      titleLines: [
        "Automate school-fee",
        "collection.",
        "Parents pay",
        "from WhatsApp.",
      ],
      description:
        "Minerval detects unpaid balances, automatically sends a secure payment reminder, and reconciles every confirmed payment with the right student.",
      cta: "Create my school for free",
      secondary: "See the journey",
      note: "No setup fee · No card required · Reminders stay under your control",
    },
    telecom: {
      intro: "Payment from the parent’s phone",
      activityPrefix: "Payment via",
      tagline: "M-Pesa · Airtel Money · Orange Money · No app download · No new account",
    },
    trust: {
      label: "Responsible automation",
      items: [
        { title: "Meta-approved messages", desc: "Clear, non-promotional WhatsApp templates in French." },
        { title: "Recorded consent", desc: "Every responsible payer opts in and can opt out." },
        { title: "Secure payment links", desc: "Each personal link is revocable and time-limited." },
        { title: "Stops after payment", desc: "Once payment is confirmed, remaining reminders are cancelled." },
      ],
    },
    how: {
      label: "How it works",
      titleLines: [
        "Three steps, with no campaign",
        "or manual chasing",
      ],
      description:
        "The school stays in control without selecting students or creating reminder campaigns.",
      steps: [
        {
          title: "Add the student and guardian",
          desc: "Import students or add them manually with the parent or guardian’s WhatsApp number and consent.",
        },
        {
          title: "Minerval sends reminders",
          desc: "When a balance becomes due, Minerval automatically sends the right French reminder at the right time.",
        },
        {
          title: "Payment is reconciled",
          desc: "The parent taps “Pay now”, pays by mobile money, and the student’s balance is updated automatically.",
        },
      ],
    },
    features: {
      label: "The whole journey in one place",
      titleLines: [
        "Less chasing.",
        "More visibility.",
      ],
      items: [
        {
          title: "Automatic WhatsApp reminders",
          desc: "Every eligible balance follows a reminder sequence without manual student selection.",
        },
        {
          title: "Secure mobile money payment",
          desc: "Parents open a personal link and pay from their phone using M-Pesa, Airtel Money, or Orange Money.",
        },
        {
          title: "Automatic reconciliation",
          desc: "Every confirmed payment is matched to the right student and immediately stops remaining reminders.",
        },
        {
          title: "Live tracking and receipts",
          desc: "Schools track payments, WhatsApp delivery, and balances while parents receive a shareable receipt.",
        },
      ],
    },
    cta: {
      title: "Ready to automate fee reminders?",
      description:
        "Create your school, add your first student, and prepare the payment journey in minutes.",
      button: "Create my school for free",
      note: "No setup fee. No card required.",
    },
    footer: "© 2026 Minerval. Built for schools in the DRC.",
    legal: { privacy: "Privacy", terms: "Terms", refunds: "Refunds" },
    card: {
      header: "École Sainte-Marie — Collections",
      live: "Live",
      collectedToday: "Collected today",
      collectedChange: "+12% vs yesterday",
      students: "Students",
      studentsPaid: "248 up to date",
      automationTitle: "Automatic WhatsApp reminder",
      automationMessage: "Hello Mama Kabongo, Grace’s school fees are still due. Review the balance and pay securely.",
      payNow: "Pay now",
      automationStatus: "Scheduled from the due date",
      recentPayments: "Reconciled payments",
      confirmed: "Reconciled",
      processing: "Confirming",
      times: ["2 minutes ago", "18 minutes ago", "34 minutes ago"] as [string, string, string],
      justNow: "Just now",
    },
  },
} as const;

function DashboardCard({ locale, copy }: { locale: PageLocale; copy: (typeof HOME_COPY)[PageLocale] }) {
  const collected = useCounter(47200, 1800, 900);
  const [rows, setRows] = useState<PayRow[]>([
    { id: 0, ...PAYMENT_NAMES[0], time: copy.card.times[0], status: "confirmed" },
    { id: 1, ...PAYMENT_NAMES[1], time: copy.card.times[1], status: "processing" },
    { id: 2, ...PAYMENT_NAMES[2], time: copy.card.times[2], status: "confirmed" },
  ]);
  const idxRef = useRef(3);

  useEffect(() => {
    const t = setInterval(() => {
      const p = PAYMENT_NAMES[idxRef.current++ % PAYMENT_NAMES.length];
      setRows((prev) => [
        { id: Date.now(), ...p, time: copy.card.justNow, status: "confirmed" },
        ...prev.slice(0, 2),
      ]);
    }, 3500);
    return () => clearInterval(t);
  }, [copy.card.justNow]);

  return (
    <div style={{
      background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 20,
      padding: 24, width: "100%", maxWidth: 480,
      boxShadow: "0 20px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)",
      animation: "cardFloat 5s ease-in-out infinite 1.2s",
    }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{copy.card.header}</span>
        <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block", animation: "pulseGreen 1.8s ease-in-out infinite" }} />
          {copy.card.live}
        </span>
      </div>
      {/* stats */}
      <div className="dashboard-stats-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{copy.card.collectedToday}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.5px" }}>{formatMoney(collected, "FC", locale)}</div>
          <div style={{ fontSize: 12, color: "#10b981", fontWeight: 500, marginTop: 2 }}>{copy.card.collectedChange}</div>
        </div>
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{copy.card.students}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.5px" }}>{formatNumber(312, locale)}</div>
          <div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 500, marginTop: 2 }}>{copy.card.studentsPaid}</div>
        </div>
      </div>
      <div className="automation-preview">
        <div className="automation-preview-head">
          <span className="automation-preview-label">{copy.card.automationTitle}</span>
          <span className="automation-preview-dot" aria-hidden="true" />
        </div>
        <div className="automation-message">{copy.card.automationMessage}</div>
        <div className="automation-preview-foot">
          <span className="automation-status">{copy.card.automationStatus}</span>
          <span className="automation-pay-button">{copy.card.payNow}</span>
        </div>
      </div>
      {/* payments */}
      <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>{copy.card.recentPayments}</div>
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
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{formatMoney(15000, "FC", locale)}</div>
              <span style={{
                fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 10, marginTop: 2, display: "inline-block",
                background: row.status === "confirmed" ? "#dcfce7" : "#fef9c3",
                color: row.status === "confirmed" ? "#16a34a" : "#ca8a04",
              }}>{row.status === "confirmed" ? copy.card.confirmed : copy.card.processing}</span>
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
    if (window.matchMedia("(max-width: 900px)").matches) {
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref } = useReveal();
  return (
    <div ref={ref} style={{
      opacity: 1,
      transform: "translateY(0)",
      transitionDelay: `${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const locale = useLocale();
  const copy = HOME_COPY[locale];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; overflow-x: hidden; }
        body { font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif !important; background: #fff !important; color: #0f172a; -webkit-font-smoothing: antialiased; overflow-x:hidden; }

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
        .desktop-nav-links { display:flex; align-items:center; gap:32px; }
        .mobile-menu-button { display:none; align-items:center; justify-content:center; width:40px; height:40px; border:1px solid #e2e8f0; border-radius:10px; background:white; color:#0f172a; }
        .mobile-menu { display:none; position:fixed; top:60px; left:12px; right:12px; z-index:99; background:rgba(255,255,255,0.98); border:1px solid #e2e8f0; border-radius:18px; box-shadow:0 20px 50px rgba(15,23,42,0.14); padding:14px; }
        .mobile-menu a { display:block; padding:12px 14px; border-radius:12px; color:#475569; text-decoration:none; font-size:15px; font-weight:600; }
        .mobile-menu a:hover { background:#f8fafc; color:#1d4ed8; }
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

        .automation-preview { margin-bottom:20px; padding:14px; border:1px solid #bbf7d0; border-radius:14px; background:linear-gradient(145deg,#f0fdf4,#ffffff); }
        .automation-preview-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
        .automation-preview-label { color:#166534; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.55px; }
        .automation-preview-dot { width:8px; height:8px; border-radius:50%; background:#22c55e; box-shadow:0 0 0 4px rgba(34,197,94,0.12); }
        .automation-message { color:#334155; font-size:12px; line-height:1.5; margin-bottom:10px; }
        .automation-preview-foot { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .automation-status { color:#64748b; font-size:10px; }
        .automation-pay-button { flex-shrink:0; border-radius:8px; background:#16a34a; color:white; padding:6px 10px; font-size:10px; font-weight:700; }

        .trust-section { max-width:1400px; margin:0 auto; padding:72px 64px 24px; }
        .trust-heading { display:flex; align-items:end; justify-content:space-between; gap:24px; margin-bottom:28px; }
        .trust-heading-copy { max-width:620px; color:#475569; font-size:15px; line-height:1.65; }
        .trust-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
        .trust-item { min-width:0; border:1px solid #e2e8f0; border-radius:16px; padding:22px; background:#fff; }
        .trust-check { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:16px; background:#dcfce7; color:#15803d; font-size:15px; font-weight:800; }
        .trust-title { margin-bottom:8px; color:#0f172a; font-size:15px; font-weight:700; line-height:1.35; }
        .trust-desc { color:#64748b; font-size:13px; line-height:1.6; }

        .land-section { max-width:1400px; margin:0 auto; padding:96px 64px; }
        .section-label { font-size:12px; text-transform:uppercase; letter-spacing:1.5px; color:#3b82f6; font-weight:600; margin-bottom:14px; }
        .section-title { font-size:clamp(28px,3vw,42px); font-weight:700; letter-spacing:-1px; color:#0f172a; margin-bottom:12px; }
        .section-sub { font-size:16px; color:#64748b; max-width:480px; line-height:1.6; }
        .section-heading-grid { display:grid; grid-template-columns:1fr 1fr; align-items:end; gap:32px; }
        .steps-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; margin-top:48px; }
        .step { height:100%; padding:28px; border:1px solid #e2e8f0; border-radius:18px; background:#fff; }
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
        .cta-inner { max-width:760px; margin:0 auto; position:relative; }
        .cta-title { font-size:clamp(28px,3.5vw,44px); font-weight:800; color:white; letter-spacing:-1.2px; margin-bottom:14px; }
        .cta-sub { font-size:16px; color:#bfdbfe; margin-bottom:32px; line-height:1.6; }
        .btn-cta-white { background:white; color:#1d4ed8; border:none; padding:15px 32px; border-radius:10px; font-size:15px; font-weight:700; cursor:pointer; font-family:'Outfit',sans-serif; box-shadow:0 4px 20px rgba(0,0,0,0.15); transition:transform 0.2s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.2s; display:inline-block; text-decoration:none; }
        .btn-cta-white:hover { transform:translateY(-3px) scale(1.02); box-shadow:0 12px 32px rgba(0,0,0,0.22); }
        .land-footer { background:#0f172a; padding:32px 64px; display:flex; justify-content:space-between; align-items:center; }

        @media (max-width: 900px) {
          .landing-hero { grid-template-columns:1fr; min-height:auto; padding-left:24px; padding-right:24px; padding-top:96px; padding-bottom:56px; gap:40px; }
          .hero-right { justify-content:center; }
          .land-section { padding:64px 24px; }
          .trust-section { padding:56px 24px 8px; }
          .trust-heading { align-items:flex-start; flex-direction:column; margin-bottom:24px; }
          .trust-grid { grid-template-columns:1fr 1fr; }
          .section-heading-grid { grid-template-columns:1fr; gap:10px; }
          .steps-grid { grid-template-columns:1fr; }
          .step { padding:24px; }
          .features-grid { grid-template-columns:1fr; }
          .feature:first-child,.feature:nth-child(2),.feature:nth-child(3),.feature:last-child { border-radius:0; }
          .cta-section { padding:64px 24px; }
          .land-footer { flex-direction:column; gap:12px; padding:24px; }
          .landing-nav { padding:0 24px; }
          .desktop-nav-links { display:none; }
          .mobile-menu-button { display:flex; }
          .mobile-menu.open { display:block; }
          .mobile-menu .btn-primary { text-align:center; margin-top:8px; color:white; }
          .mobile-language { display:flex; justify-content:center; padding:10px 0 2px; }
          .hero-h1 { font-size:clamp(34px,10vw,48px); letter-spacing:-1.1px; }
          .hero-actions { flex-direction:column; align-items:stretch; gap:10px; margin-bottom:28px; }
          .hero-actions .btn-primary { text-align:center; width:100%; }
          .hero-actions .btn-ghost { justify-content:center; width:100%; }
          .hero-badge { font-size:12px; padding:6px 12px; margin-bottom:22px; }
          .hero-sub { font-size:16px; margin-bottom:28px; }
          .automation-preview-foot { align-items:flex-start; flex-direction:column; }
          .marquee-wrapper::before,.marquee-wrapper::after { width:44px; }
          .marquee-wrapper::before,.marquee-wrapper::after { display:none; }
          .marquee-track,.marquee-track-reverse { width:auto; flex-wrap:wrap; justify-content:center; padding:0 18px; animation:none; }
          .marquee-track > * { display:none; }
          .marquee-track > :nth-child(1),
          .marquee-track > :nth-child(3),
          .marquee-track > :nth-child(5) { display:flex; }
          .marquee-track-reverse > * { display:none; }
          .marquee-track-reverse > :nth-child(1),
          .marquee-track-reverse > :nth-child(2),
          .marquee-track-reverse > :nth-child(3) { display:flex; }
          .m-pill { padding:10px 16px; font-size:13px; }
          .activity-chip { padding:8px 14px; }
        }

        @media (max-width: 560px) {
          .landing-nav { padding:0 16px; }
          .landing-hero { padding-left:18px; padding-right:18px; }
          .hero-left { padding-top:0; }
          .hero-note { align-items:flex-start; line-height:1.45; }
          .land-section { padding:56px 18px; }
          .trust-section { padding:48px 18px 4px; }
          .trust-grid { grid-template-columns:1fr; gap:10px; }
          .trust-item { padding:20px; }
          .features-grid { margin-top:32px; border-radius:16px; }
          .feature { padding:28px; }
          .step { padding:28px 0; }
          .steps-grid { margin-top:32px; }
          .cta-section { padding:56px 18px; }
          .land-footer { text-align:center; }
        }

        @media (max-width: 360px) {
          .dashboard-stats-grid { grid-template-columns:1fr !important; }
          .hero-h1 { font-size:32px; }
        }
      `}</style>

      {/* Nav */}
      <nav className="landing-nav">
        <span style={{ fontSize: 20, fontWeight: 700, color: "#1d4ed8", letterSpacing: "-0.5px" }}>Minerval</span>
        <div className="desktop-nav-links">
          <a href="#how-it-works" style={{ fontSize: 14, color: "#475569", textDecoration: "none", fontWeight: 500 }}>{copy.nav.howItWorks}</a>
          <a href="#features" style={{ fontSize: 14, color: "#475569", textDecoration: "none", fontWeight: 500 }}>{copy.nav.forSchools}</a>
          <LocalizedLink href="/login" style={{ fontSize: 14, color: "#475569", textDecoration: "none", fontWeight: 500 }}>{copy.nav.login}</LocalizedLink>
          <LocalizedLink href="/signup" className="btn-primary" style={{ padding: "9px 20px", fontSize: 14, borderRadius: 8 }}>{copy.nav.signup}</LocalizedLink>
          <LanguageSwitcher />
        </div>
        <button
          type="button"
          className="mobile-menu-button"
          aria-label="Menu"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            {mobileMenuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      <div className={`mobile-menu ${mobileMenuOpen ? "open" : ""}`}>
        <a href="#how-it-works" onClick={closeMobileMenu}>{copy.nav.howItWorks}</a>
        <a href="#features" onClick={closeMobileMenu}>{copy.nav.forSchools}</a>
        <LocalizedLink href="/login" onClick={closeMobileMenu}>{copy.nav.login}</LocalizedLink>
        <LocalizedLink href="/signup" className="btn-primary" onClick={closeMobileMenu}>{copy.nav.signup}</LocalizedLink>
        <div className="mobile-language"><LanguageSwitcher /></div>
      </div>

      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-left">
          <div className="hero-badge"><div className="hero-badge-dot" />{copy.hero.badge}</div>
          <h1 className="hero-h1">{copy.hero.titleLines[0]}<br />{copy.hero.titleLines[1]}<br />{copy.hero.titleLines[2]} <span>{copy.hero.titleLines[3]}</span></h1>
          <p className="hero-sub">{copy.hero.description}</p>
          <div className="hero-actions">
            <LocalizedLink href="/signup" className="btn-primary">{copy.hero.cta}</LocalizedLink>
            <a href="#how-it-works" className="btn-ghost">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
              {copy.hero.secondary}
            </a>
          </div>
          <div className="hero-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            {copy.hero.note}
          </div>
        </div>
        <div className="hero-right">
          <DashboardCard locale={locale} copy={copy} />
        </div>
      </section>

      {/* Telecom bar */}
      <div className="telecom-section">
        <div className="telecom-intro">{copy.telecom.intro}</div>
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
              { net: "M-Pesa", amount: formatMoney(15000, "FC", locale) },
              { net: "Airtel Money", amount: formatMoney(12500, "FC", locale) },
              { net: "Orange Money", amount: formatMoney(20000, "FC", locale) },
              { net: "M-Pesa", amount: formatMoney(8000, "FC", locale) },
              { net: "Airtel Money", amount: formatMoney(15000, "FC", locale) },
              { net: "Orange Money", amount: formatMoney(10000, "FC", locale) },
              { net: "M-Pesa", amount: formatMoney(18000, "FC", locale) },
            ].map((c, j) => (
              <div key={`chip-${i}-${j}`} className="activity-chip">
                <div className="chip-dot" />{copy.telecom.activityPrefix} <strong>{c.net}</strong> · {c.amount}
              </div>
            )))}
          </div>
        </div>
        <div className="telecom-tagline">{copy.telecom.tagline}</div>
      </div>

      {/* Trust and safeguards */}
      <section className="trust-section" aria-labelledby="trust-title">
        <div className="trust-heading">
          <div>
            <div className="section-label">{copy.trust.label}</div>
            <h2 className="section-title" id="trust-title">
              {locale === "fr" ? "Pensée pour protéger la relation avec les parents." : "Built to protect the relationship with parents."}
            </h2>
          </div>
          <p className="trust-heading-copy">
            {locale === "fr"
              ? "Minerval automatise le suivi sans transformer les rappels en messages intrusifs. L’école garde la maîtrise de chaque étape."
              : "Minerval automates follow-up without turning reminders into intrusive messages. The school remains in control at every step."}
          </p>
        </div>
        <div className="trust-grid">
          {copy.trust.items.map((item) => (
            <article className="trust-item" key={item.title}>
              <div className="trust-check" aria-hidden="true">✓</div>
              <h3 className="trust-title">{item.title}</h3>
              <p className="trust-desc">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="land-section" id="how-it-works">
        <Reveal><div className="section-label">{copy.how.label}</div></Reveal>
        <div className="section-heading-grid">
          <Reveal delay={100}><div className="section-title">{copy.how.titleLines[0]}<br />{copy.how.titleLines[1]}</div></Reveal>
          <Reveal delay={200}><div className="section-sub">{copy.how.description}</div></Reveal>
        </div>
        <div className="steps-grid">
          {copy.how.steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 100}>
              <div className="step">
                <div className="step-num">{i + 1}</div>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="land-section" id="features" style={{ paddingTop: 0 }}>
        <Reveal><div className="section-label">{copy.features.label}</div></Reveal>
        <Reveal delay={100}><div className="section-title">{copy.features.titleLines[0]}<br />{copy.features.titleLines[1]}</div></Reveal>
        <div className="features-grid">
          {[
            {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>,
              ...copy.features.items[0],
            },
            {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>,
              ...copy.features.items[1],
            },
            {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
              ...copy.features.items[2],
            },
            {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
              ...copy.features.items[3],
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
            <div className="cta-title">{copy.cta.title}</div>
            <div className="cta-sub">{copy.cta.description}</div>
            <LocalizedLink href="/signup" className="btn-cta-white">{copy.cta.button}</LocalizedLink>
            <div style={{ fontSize: 13, color: "#93c5fd", marginTop: 14 }}>{copy.cta.note}</div>
          </div>
        </Reveal>
      </div>

      {/* Footer */}
      <footer className="land-footer">
        <span style={{ fontSize: 16, fontWeight: 700, color: "white" }}>Minerval</span>
        <span style={{ fontSize: 13, color: "#475569" }}>{copy.footer}</span>
        <nav style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16, fontSize: 13 }}>
          <LocalizedLink href="/privacy" style={{ color: "#94a3b8", textDecoration: "none" }}>{copy.legal.privacy}</LocalizedLink>
          <LocalizedLink href="/terms" style={{ color: "#94a3b8", textDecoration: "none" }}>{copy.legal.terms}</LocalizedLink>
          <LocalizedLink href="/refunds" style={{ color: "#94a3b8", textDecoration: "none" }}>{copy.legal.refunds}</LocalizedLink>
        </nav>
      </footer>
    </>
  );
}
