"use client";
import { useActionState } from "react";
import { resetPassword } from "@/app/actions/auth";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(resetPassword, null);

  return (
    <>
      <style>{`
        .fp-root { font-family: 'Outfit', system-ui, sans-serif; }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes shimmer {
          from { background-position: -200% center; }
          to   { background-position:  200% center; }
        }
        @keyframes floatDot {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes drawCircle {
          from { stroke-dashoffset: 100; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes drawCheck {
          from { stroke-dashoffset: 40; opacity: 0; }
          to   { stroke-dashoffset: 0;  opacity: 1; }
        }
        @keyframes popIn {
          0%   { opacity: 0; transform: scale(0.7); }
          70%  { transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pulseRing {
          0%   { transform: scale(1);    opacity: 0.4; }
          100% { transform: scale(1.55); opacity: 0; }
        }

        .form-field { animation: fadeSlideUp 0.52s cubic-bezier(0.16,1,0.3,1) both; }
        .form-field:nth-child(1) { animation-delay: 0.1s; }
        .form-field:nth-child(2) { animation-delay: 0.2s; }
        .form-field:nth-child(3) { animation-delay: 0.3s; }
        .form-field:nth-child(4) { animation-delay: 0.38s; }

        .left-panel { animation: fadeIn 0.9s ease both; }

        .btn-submit {
          position: relative; overflow: hidden;
          transition: background 0.2s, transform 0.12s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;
        }
        .btn-submit:hover:not(:disabled) {
          background: #1e40af !important;
          box-shadow: 0 8px 24px rgba(29,78,216,0.32);
          transform: translateY(-1px);
        }
        .btn-submit:active:not(:disabled) { transform: scale(0.98) translateY(0); box-shadow: none; }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .input-field { transition: border-color 0.18s, box-shadow 0.18s; outline: none; }
        .input-field:focus {
          border-color: #1d4ed8;
          box-shadow: 0 0 0 3px rgba(29,78,216,0.11);
        }
        .input-field.error {
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239,68,68,0.10);
        }

        .shimmer-btn {
          background: linear-gradient(90deg, #1d4ed8 0%, #3b82f6 50%, #1d4ed8 100%) !important;
          background-size: 200% auto !important;
          animation: shimmer 1.4s linear infinite;
        }

        .dot-1, .dot-2, .dot-3 {
          width: 5px; height: 5px; border-radius: 50%; background: white; display: inline-block;
          animation: floatDot 1s ease-in-out infinite;
        }
        .dot-2 { animation-delay: 0.18s; }
        .dot-3 { animation-delay: 0.36s; }

        .success-panel { animation: fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }

        .check-circle {
          stroke-dasharray: 100;
          animation: drawCircle 0.55s cubic-bezier(0.16,1,0.3,1) 0.1s both;
        }
        .check-mark {
          stroke-dasharray: 40;
          animation: drawCheck 0.45s cubic-bezier(0.16,1,0.3,1) 0.55s both;
        }
        .check-wrapper {
          animation: popIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        .pulse-ring {
          position: absolute; inset: -6px; border-radius: 50%;
          border: 1.5px solid rgba(22,163,74,0.4);
          animation: pulseRing 1.8s cubic-bezier(0.22,1,0.36,1) 0.6s infinite;
        }

        .grid-dot {
          position: absolute; width: 1px; height: 1px;
          background: rgba(255,255,255,0.15); border-radius: 50%;
        }

        .security-card {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 16px 18px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .security-card-icon {
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(29,78,216,0.35);
          border: 1px solid rgba(59,130,246,0.3);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
      `}</style>

      <div className="fp-root min-h-[100dvh] flex" style={{ background: "#f8fafc" }}>

        {/* ── Left brand panel ── */}
        <div
          className="left-panel hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden"
          style={{ background: "linear-gradient(145deg, #0f172a 0%, #1e3a5f 60%, #1d4ed8 100%)" }}
        >
          {/* Dot grid */}
          {Array.from({ length: 80 }).map((_, i) => (
            <div key={i} className="grid-dot" style={{
              left: `${(i % 10) * 11 + 3}%`,
              top: `${Math.floor(i / 10) * 12 + 4}%`,
              opacity: 0.08 + (i % 3) * 0.06,
            }} />
          ))}

          {/* Logo */}
          <div>
            <Link href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.5px" }}>Minerval</span>
            </Link>
          </div>

          {/* Main copy */}
          <div style={{ maxWidth: 400 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(147,197,253,0.9)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 20 }}>
              Account recovery
            </p>
            <h2 style={{ fontSize: "clamp(26px,3vw,38px)", fontWeight: 800, color: "white", lineHeight: 1.15, letterSpacing: "-1px", marginBottom: 16 }}>
              Back in two<br />minutes flat.
            </h2>
            <p style={{ fontSize: 15, color: "rgba(148,163,184,0.9)", lineHeight: 1.7, maxWidth: 340 }}>
              Enter your email and we'll send a secure reset link directly to your inbox. No security questions, no friction.
            </p>
          </div>

          {/* Security trust cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              {
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(147,197,253,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                ),
                title: "Encrypted link",
                desc: "Your reset link is single-use and expires in 1 hour.",
              },
              {
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(147,197,253,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                ),
                title: "No password exposure",
                desc: "We never send your current password by email.",
              },
            ].map((c) => (
              <div key={c.title} className="security-card" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div className="security-card-icon">{c.icon}</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "white", marginBottom: 2 }}>{c.title}</p>
                  <p style={{ fontSize: 12, color: "rgba(148,163,184,0.85)", lineHeight: 1.5 }}>{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex-1 flex items-center justify-center px-6 py-12" style={{ background: "white" }}>
          <div style={{ width: "100%", maxWidth: 400 }}>

            {/* Mobile logo */}
            <div className="lg:hidden mb-8">
              <Link href="/" style={{ textDecoration: "none" }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#1d4ed8", letterSpacing: "-0.5px" }}>Minerval</span>
              </Link>
            </div>

            {state?.success ? (
              /* ── Success state ── */
              <div className="success-panel" style={{ textAlign: "center" }}>
                <div style={{ position: "relative", width: 64, height: 64, margin: "0 auto 24px" }}>
                  <div className="pulse-ring" />
                  <div className="check-wrapper" style={{
                    width: 64, height: 64, borderRadius: "50%",
                    background: "#f0fdf4", border: "1.5px solid #bbf7d0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative",
                  }}>
                    <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
                      <circle cx="20" cy="20" r="15" stroke="#16a34a" strokeWidth="1.5"
                        className="check-circle" fill="none" />
                      <polyline points="13,21 18,26 27,15" stroke="#16a34a" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" className="check-mark" fill="none" />
                    </svg>
                  </div>
                </div>

                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px", marginBottom: 10 }}>
                  Check your inbox
                </h2>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, maxWidth: 300, margin: "0 auto 32px" }}>
                  A password reset link is on its way. It expires in 1 hour — check your spam folder if you don't see it.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                  <Link href="/login" style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "11px 24px", borderRadius: 10,
                    background: "#1d4ed8", color: "white",
                    fontSize: 14, fontWeight: 600, textDecoration: "none",
                    boxShadow: "0 4px 14px rgba(29,78,216,0.25)",
                    transition: "background 0.18s",
                  }}>
                    Back to sign in
                  </Link>
                  <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                    Didn't receive it?{" "}
                    <button
                      onClick={() => window.location.reload()}
                      style={{ color: "#1d4ed8", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: 0 }}
                    >
                      Try again
                    </button>
                  </p>
                </div>
              </div>
            ) : (
              /* ── Form state ── */
              <>
                {/* Heading */}
                <div className="form-field" style={{ marginBottom: 36 }}>
                  <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.8px", marginBottom: 6 }}>
                    Forgot your password?
                  </h1>
                  <p style={{ fontSize: 14, color: "#64748b" }}>
                    No problem — enter your email and we'll send a reset link.
                  </p>
                </div>

                <form action={action} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                  {/* Email */}
                  <div className="form-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Email address</label>
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      autoFocus
                      placeholder="admin@yourschool.org"
                      className={`input-field${state?.error ? " error" : ""}`}
                      style={{
                        border: "1.5px solid #e2e8f0", borderRadius: 10,
                        padding: "11px 14px", fontSize: 14, color: "#0f172a",
                        background: "#f8fafc", width: "100%", fontFamily: "inherit",
                      }}
                    />
                  </div>

                  {/* Error */}
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
                        color: "white", fontFamily: "inherit",
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
                      ) : "Send reset link"}
                    </button>
                  </div>
                </form>

                {/* Footer */}
                <p style={{ marginTop: 28, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
                  Remember your password?{" "}
                  <Link href="/login" style={{ color: "#1d4ed8", fontWeight: 600, textDecoration: "none" }}>
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
