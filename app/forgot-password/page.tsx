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
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          from { background-position: -200% center; }
          to   { background-position:  200% center; }
        }

        .form-field { animation: fadeSlideUp 0.55s cubic-bezier(0.16,1,0.3,1) both; }
        .form-field:nth-child(1) { animation-delay: 0.1s; }
        .form-field:nth-child(2) { animation-delay: 0.2s; }
        .form-field:nth-child(3) { animation-delay: 0.3s; }

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

        .success-box { animation: fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div className="fp-root min-h-[100dvh] flex items-center justify-center" style={{ background: "#f8fafc" }}>
        <div style={{ width: "100%", maxWidth: 420, padding: "0 24px" }}>

          {/* Logo */}
          <div style={{ marginBottom: 32, textAlign: "center" }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "#1d4ed8", letterSpacing: "-0.5px" }}>Minerval</span>
            </Link>
          </div>

          <div style={{ background: "white", borderRadius: 16, padding: "36px 32px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>

            {state?.success ? (
              <div className="success-box" style={{ textAlign: "center" }}>
                {/* Checkmark */}
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Check your email</h2>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 24 }}>
                  We sent a password reset link to your email address. It expires in 1 hour.
                </p>
                <Link href="/login" style={{
                  display: "inline-block", fontSize: 14, color: "#1d4ed8",
                  fontWeight: 600, textDecoration: "none",
                }}>
                  Back to sign in
                </Link>
              </div>
            ) : (
              <>
                {/* Heading */}
                <div className="form-field" style={{ marginBottom: 28 }}>
                  <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.6px", marginBottom: 6 }}>
                    Reset your password
                  </h1>
                  <p style={{ fontSize: 14, color: "#64748b" }}>
                    Enter your email and we'll send you a reset link.
                  </p>
                </div>

                <form action={action} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                  {/* Email */}
                  <div className="form-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Email address</label>
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
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
                        color: "white", cursor: pending ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                        background: pending ? undefined : "#1d4ed8",
                        boxShadow: pending ? "none" : "0 4px 14px rgba(29,78,216,0.28)",
                      }}
                    >
                      {pending ? "Sending…" : "Send reset link"}
                    </button>
                  </div>
                </form>
              </>
            )}

          </div>

          {/* Footer */}
          {!state?.success && (
            <p style={{ marginTop: 24, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
              Remember your password?{" "}
              <Link href="/login" style={{ color: "#1d4ed8", fontWeight: 600, textDecoration: "none" }}>
                Sign in
              </Link>
            </p>
          )}

        </div>
      </div>
    </>
  );
}
