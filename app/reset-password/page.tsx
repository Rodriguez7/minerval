"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const strength = password.length === 0 ? 0
    : password.length < 8  ? 1
    : password.length < 12 ? 2
    : 3;

  const strengthLabel = ["", "Too short", "Good", "Strong"][strength];
  const strengthColor = ["", "#ef4444", "#f59e0b", "#16a34a"][strength];
  const strengthWidth = ["0%", "33%", "66%", "100%"][strength];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setPending(true);
    setError(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) { setError(updateError.message); return; }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 2200);
  }

  return (
    <>
      <style>{`
        .rp-root { font-family: 'Outfit', system-ui, sans-serif; }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
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
        @keyframes strengthFill {
          from { width: 0; }
        }

        .form-field { animation: fadeSlideUp 0.52s cubic-bezier(0.16,1,0.3,1) both; }
        .form-field:nth-child(1) { animation-delay: 0.1s; }
        .form-field:nth-child(2) { animation-delay: 0.2s; }
        .form-field:nth-child(3) { animation-delay: 0.3s; }
        .form-field:nth-child(4) { animation-delay: 0.38s; }
        .form-field:nth-child(5) { animation-delay: 0.44s; }

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
        .input-field:focus { border-color: #1d4ed8; box-shadow: 0 0 0 3px rgba(29,78,216,0.11); }
        .input-field.error { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.10); }

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

        .strength-bar { transition: width 0.3s cubic-bezier(0.16,1,0.3,1), background 0.3s; }

        .success-panel { animation: fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .check-circle {
          stroke-dasharray: 100;
          animation: drawCircle 0.55s cubic-bezier(0.16,1,0.3,1) 0.1s both;
        }
        .check-mark {
          stroke-dasharray: 40;
          animation: drawCheck 0.45s cubic-bezier(0.16,1,0.3,1) 0.55s both;
        }
        .check-wrapper { animation: popIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .pulse-ring {
          position: absolute; inset: -6px; border-radius: 50%;
          border: 1.5px solid rgba(22,163,74,0.4);
          animation: pulseRing 1.8s cubic-bezier(0.22,1,0.36,1) 0.6s infinite;
        }

        .grid-dot {
          position: absolute; width: 1px; height: 1px;
          background: rgba(255,255,255,0.15); border-radius: 50%;
        }

        .steps-item { display: flex; align-items: flex-start; gap: 12; margin-bottom: 18px; }
        .step-num {
          width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
          background: rgba(29,78,216,0.3); border: 1px solid rgba(59,130,246,0.35);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: rgba(147,197,253,0.9);
        }
      `}</style>

      <div className="rp-root min-h-[100dvh] flex" style={{ background: "#f8fafc" }}>

        {/* ── Left brand panel ── */}
        <div
          className="left-panel hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden"
          style={{ background: "linear-gradient(145deg, #0f172a 0%, #1e3a5f 60%, #1d4ed8 100%)" }}
        >
          {Array.from({ length: 80 }).map((_, i) => (
            <div key={i} className="grid-dot" style={{
              left: `${(i % 10) * 11 + 3}%`,
              top: `${Math.floor(i / 10) * 12 + 4}%`,
              opacity: 0.08 + (i % 3) * 0.06,
            }} />
          ))}

          <div>
            <Link href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.5px" }}>Minerval</span>
            </Link>
          </div>

          <div style={{ maxWidth: 400 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(147,197,253,0.9)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 20 }}>
              Almost done
            </p>
            <h2 style={{ fontSize: "clamp(26px,3vw,38px)", fontWeight: 800, color: "white", lineHeight: 1.15, letterSpacing: "-1px", marginBottom: 16 }}>
              Choose a password<br />you'll remember.
            </h2>
            <p style={{ fontSize: 15, color: "rgba(148,163,184,0.9)", lineHeight: 1.7, maxWidth: 340 }}>
              Your new password will replace the old one immediately. All other sessions will remain active.
            </p>
          </div>

          {/* Steps */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(147,197,253,0.7)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 16 }}>
              What happens next
            </p>
            {[
              "Set your new password below",
              "You'll be signed in automatically",
              "Manage your account from the dashboard",
            ].map((step, i) => (
              <div key={i} className="steps-item">
                <div className="step-num">{i + 1}</div>
                <p style={{ fontSize: 13, color: "rgba(148,163,184,0.9)", lineHeight: 1.55, paddingTop: 2 }}>{step}</p>
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

            {done ? (
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
                  Password updated
                </h2>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, marginBottom: 8 }}>
                  Taking you to your dashboard…
                </p>
                <div style={{ width: 40, height: 2, background: "#e2e8f0", borderRadius: 2, margin: "0 auto" }}>
                  <div style={{ height: "100%", background: "#1d4ed8", borderRadius: 2, animation: "strengthFill 2.2s linear both" }} />
                </div>
              </div>
            ) : (
              /* ── Form state ── */
              <>
                <div className="form-field" style={{ marginBottom: 36 }}>
                  <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.8px", marginBottom: 6 }}>
                    Set new password
                  </h1>
                  <p style={{ fontSize: 14, color: "#64748b" }}>
                    Choose something strong — at least 8 characters.
                  </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                  {/* New password */}
                  <div className="form-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>New password</label>
                    <input
                      type="password"
                      required
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className={`input-field${error && error.includes("8") ? " error" : ""}`}
                      style={{
                        border: "1.5px solid #e2e8f0", borderRadius: 10,
                        padding: "11px 14px", fontSize: 14, color: "#0f172a",
                        background: "#f8fafc", width: "100%", fontFamily: "inherit",
                      }}
                    />
                    {/* Strength bar */}
                    {password.length > 0 && (
                      <div>
                        <div style={{ height: 3, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                          <div
                            className="strength-bar"
                            style={{ height: "100%", width: strengthWidth, background: strengthColor, borderRadius: 2 }}
                          />
                        </div>
                        <p style={{ fontSize: 11, color: strengthColor, fontWeight: 600, marginTop: 4 }}>
                          {strengthLabel}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div className="form-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Confirm password</label>
                    <input
                      type="password"
                      required
                      placeholder="Repeat your password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      className={`input-field${error && error.includes("match") ? " error" : ""}`}
                      style={{
                        border: "1.5px solid #e2e8f0", borderRadius: 10,
                        padding: "11px 14px", fontSize: 14, color: "#0f172a",
                        background: "#f8fafc", width: "100%", fontFamily: "inherit",
                      }}
                    />
                    {/* Match indicator */}
                    {confirm.length > 0 && (
                      <p style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: confirm === password ? "#16a34a" : "#ef4444" }}>
                        {confirm === password ? "Passwords match" : "Does not match"}
                      </p>
                    )}
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="form-field" style={{
                      background: "#fef2f2", border: "1px solid #fecaca",
                      borderRadius: 10, padding: "10px 14px",
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 500 }}>{error}</span>
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
                      ) : "Update password"}
                    </button>
                  </div>
                </form>

                <p style={{ marginTop: 28, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
                  Remembered your password?{" "}
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
