"use client";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import { useLocale } from "@/lib/i18n/client";
import { getAuthCopy } from "@/lib/i18n/copy/auth";
import { formatMoney, formatNumber } from "@/lib/i18n/format";

export default function LoginPage() {
  const locale = useLocale();
  const copy = getAuthCopy(locale);
  const [state, action, pending] = useActionState(login, null);

  return (
    <>
      <style>{`
        .login-root { font-family: 'Outfit', system-ui, sans-serif; }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes floatDot {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes shimmer {
          from { background-position: -200% center; }
          to   { background-position:  200% center; }
        }

        .stat-card { animation: fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .stat-card:nth-child(1) { animation-delay: 0.5s; }
        .stat-card:nth-child(2) { animation-delay: 0.65s; }
        .stat-card:nth-child(3) { animation-delay: 0.80s; }

        .form-field { animation: fadeSlideUp 0.55s cubic-bezier(0.16,1,0.3,1) both; }
        .form-field:nth-child(1) { animation-delay: 0.15s; }
        .form-field:nth-child(2) { animation-delay: 0.25s; }
        .form-field:nth-child(3) { animation-delay: 0.35s; }
        .form-field:nth-child(4) { animation-delay: 0.42s; }

        .btn-submit {
          position: relative; overflow: hidden;
          transition: background 0.2s, transform 0.12s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;
        }
        .btn-submit:hover  { background: #1e40af; box-shadow: 0 8px 24px rgba(29,78,216,0.35); transform: translateY(-1px); }
        .btn-submit:active { transform: scale(0.98) translateY(0); box-shadow: none; }
        .btn-submit:disabled { opacity: 0.65; cursor: not-allowed; transform: none; box-shadow: none; }

        .input-field {
          transition: border-color 0.18s, box-shadow 0.18s;
          outline: none;
        }
        .input-field:focus {
          border-color: #1d4ed8;
          box-shadow: 0 0 0 3px rgba(29,78,216,0.12);
        }
        .input-field.error {
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239,68,68,0.1);
        }

        .shimmer-btn {
          background: linear-gradient(90deg, #1d4ed8 0%, #3b82f6 50%, #1d4ed8 100%);
          background-size: 200% auto;
          animation: shimmer 1.4s linear infinite;
        }

        .dot-1, .dot-2, .dot-3 {
          width: 5px; height: 5px; border-radius: 50%; background: white; display: inline-block;
          animation: floatDot 1s ease-in-out infinite;
        }
        .dot-2 { animation-delay: 0.18s; }
        .dot-3 { animation-delay: 0.36s; }

        .left-panel { animation: fadeIn 0.8s ease both; }
        .grid-dot {
          position: absolute; width: 1px; height: 1px;
          background: rgba(255,255,255,0.15); border-radius: 50%;
        }
      `}</style>

      <div className="login-root relative min-h-[100dvh] flex" style={{ background: "#f8fafc" }}>
        <div className="absolute right-4 top-4 z-20 md:right-6 md:top-6">
          <LanguageSwitcher />
        </div>

        {/* ── Left brand panel ── */}
        <div className="left-panel hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden"
          style={{ background: "linear-gradient(145deg, #0f172a 0%, #1e3a5f 60%, #1d4ed8 100%)" }}>

          {/* Subtle dot grid */}
          {Array.from({ length: 80 }).map((_, i) => (
            <div key={i} className="grid-dot" style={{
              left: `${(i % 10) * 11 + 3}%`,
              top: `${Math.floor(i / 10) * 12 + 4}%`,
              opacity: 0.08 + (i % 3) * 0.06,
            }} />
          ))}

          {/* Logo */}
          <div>
            <LocalizedLink href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.5px" }}>Minerval</span>
            </LocalizedLink>
          </div>

          {/* Main copy */}
          <div style={{ maxWidth: 400 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(147,197,253,0.9)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 20 }}>
              {copy.login.heroEyebrow}
            </p>
            <h2 style={{ fontSize: "clamp(28px, 3vw, 40px)", fontWeight: 800, color: "white", lineHeight: 1.15, letterSpacing: "-1px", marginBottom: 16 }}>
              {copy.login.heroTitleLines[0]}<br />
              {copy.login.heroTitleLines[1]}<br />
              {copy.login.heroTitleLines[2]}
            </h2>
            <p style={{ fontSize: 15, color: "rgba(148,163,184,0.9)", lineHeight: 1.7, maxWidth: 340 }}>
              {copy.login.heroDescription}
            </p>
          </div>

          {/* Live stats strip */}
          <div style={{ display: "flex", gap: 12 }}>
            {[
              {
                label: copy.login.stats[0].label,
                value: formatMoney(47200, "FC", locale),
                sub: copy.login.stats[0].sub,
              },
              {
                label: copy.login.stats[1].label,
                value: formatNumber(248, locale),
                sub:
                  locale === "fr"
                    ? `sur ${formatNumber(312, locale)}`
                    : `of ${formatNumber(312, locale)}`,
              },
              {
                label: copy.login.stats[2].label,
                value: formatNumber(3, locale),
                sub: copy.login.stats[2].sub,
              },
            ].map((s) => (
              <div key={s.label} className="stat-card" style={{
                flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 14, padding: "14px 16px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              }}>
                <p style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "white", letterSpacing: "-0.5px" }}>{s.value}</p>
                <p style={{ fontSize: 11, color: "#60a5fa", fontWeight: 500, marginTop: 2 }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex-1 flex items-center justify-center px-6 py-12" style={{ background: "white" }}>
          <div style={{ width: "100%", maxWidth: 400 }}>

            {/* Mobile logo */}
            <div className="lg:hidden mb-8">
              <LocalizedLink href="/" style={{ textDecoration: "none" }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#1d4ed8", letterSpacing: "-0.5px" }}>Minerval</span>
              </LocalizedLink>
            </div>

            {/* Heading */}
            <div className="form-field" style={{ marginBottom: 36 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.8px", marginBottom: 6 }}>
                {copy.login.heading}
              </h1>
              <p style={{ fontSize: 14, color: "#64748b" }}>
                {copy.login.subheading}
              </p>
            </div>

            <form action={action} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <input type="hidden" name="locale" value={locale} />

              {/* Email */}
              <div className="form-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{copy.login.emailLabel}</label>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={copy.login.emailPlaceholder}
                  className={`input-field${state?.error ? " error" : ""}`}
                  style={{
                    border: "1.5px solid #e2e8f0", borderRadius: 10,
                    padding: "11px 14px", fontSize: 14, color: "#0f172a",
                    background: "#f8fafc", width: "100%",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Password */}
              <div className="form-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{copy.login.passwordLabel}</label>
                  <LocalizedLink href="/forgot-password" style={{ fontSize: 12, color: "#1d4ed8", textDecoration: "none" }}>{copy.login.forgotPassword}</LocalizedLink>
                </div>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder={copy.login.passwordPlaceholder}
                  className={`input-field${state?.error ? " error" : ""}`}
                  style={{
                    border: "1.5px solid #e2e8f0", borderRadius: 10,
                    padding: "11px 14px", fontSize: 14, color: "#0f172a",
                    background: "#f8fafc", width: "100%",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Error message */}
              {state?.error && (
                <div className="form-field" style={{
                  background: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: 10, padding: "10px 14px",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 500 }}>{state.error}</span>
                </div>
              )}

              {/* Submit */}
              <div className="form-field">
                <button
                  type="submit"
                  disabled={pending}
                  className={`btn-submit${pending ? " shimmer-btn" : ""}`}
                  style={{
                    width: "100%", border: "none", borderRadius: 10,
                    padding: "13px 20px", fontSize: 15, fontWeight: 600,
                    color: "white", cursor: pending ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    background: pending ? undefined : "#1d4ed8",
                    boxShadow: pending ? "none" : "0 4px 14px rgba(29,78,216,0.28)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {pending ? (
                    <>
                      <span className="dot-1" />
                      <span className="dot-2" />
                      <span className="dot-3" />
                    </>
                  ) : copy.login.submit}
                </button>
              </div>
            </form>

            {/* Footer link */}
            <p style={{ marginTop: 28, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
              {copy.login.footerPrompt}{" "}
              <LocalizedLink href="/signup" style={{ color: "#1d4ed8", fontWeight: 600, textDecoration: "none" }}>
                {copy.login.footerLink}
              </LocalizedLink>
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
