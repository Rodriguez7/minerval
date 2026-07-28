"use client";

import { useActionState, useCallback, useState } from "react";
import { signup } from "@/app/actions/auth";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import { useLocale } from "@/lib/i18n/client";
import { getAuthCopy } from "@/lib/i18n/copy/auth";
import { formatMoney, formatNumber } from "@/lib/i18n/format";
import { Turnstile } from "@/lib/Turnstile";

export default function SignupPage() {
  const locale = useLocale();
  const copy = getAuthCopy(locale);
  const [state, action, isPending] = useActionState(signup, null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const onCaptchaToken = useCallback((token: string | null) => setCaptchaToken(token), []);
  const captchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const captchaRequired = Boolean(captchaSiteKey);

  return (
    <>
      <style>{`
        .signup-root { font-family: 'Outfit', system-ui, sans-serif; }

        @keyframes signupFadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes signupFadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes signupFloatDot {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes signupShimmer {
          from { background-position: -200% center; }
          to   { background-position: 200% center; }
        }

        .signup-stat-card { animation: signupFadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .signup-stat-card:nth-child(1) { animation-delay: 0.5s; }
        .signup-stat-card:nth-child(2) { animation-delay: 0.65s; }
        .signup-stat-card:nth-child(3) { animation-delay: 0.8s; }

        .signup-form-field { animation: signupFadeSlideUp 0.55s cubic-bezier(0.16,1,0.3,1) both; }
        .signup-form-field:nth-child(1) { animation-delay: 0.15s; }
        .signup-form-field:nth-child(2) { animation-delay: 0.25s; }
        .signup-form-field:nth-child(3) { animation-delay: 0.35s; }
        .signup-form-field:nth-child(4) { animation-delay: 0.42s; }

        .signup-submit {
          position: relative;
          overflow: hidden;
          transition: background 0.2s, transform 0.12s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;
        }
        .signup-submit:hover {
          background: #1e40af;
          box-shadow: 0 8px 24px rgba(29,78,216,0.35);
          transform: translateY(-1px);
        }
        .signup-submit:active { transform: scale(0.98) translateY(0); box-shadow: none; }
        .signup-submit:disabled { opacity: 0.65; cursor: not-allowed; transform: none; box-shadow: none; }

        .signup-input {
          transition: border-color 0.18s, box-shadow 0.18s;
          outline: none;
        }
        .signup-input:focus {
          border-color: #1d4ed8;
          box-shadow: 0 0 0 3px rgba(29,78,216,0.12);
        }
        .signup-input.error {
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239,68,68,0.1);
        }

        .signup-shimmer {
          background: linear-gradient(90deg, #1d4ed8 0%, #3b82f6 50%, #1d4ed8 100%);
          background-size: 200% auto;
          animation: signupShimmer 1.4s linear infinite;
        }

        .signup-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: white;
          display: inline-block;
          animation: signupFloatDot 1s ease-in-out infinite;
        }
        .signup-dot:nth-child(2) { animation-delay: 0.18s; }
        .signup-dot:nth-child(3) { animation-delay: 0.36s; }

        .signup-left-panel { animation: signupFadeIn 0.8s ease both; }
        .signup-grid-dot {
          position: absolute;
          width: 1px;
          height: 1px;
          background: rgba(255,255,255,0.15);
          border-radius: 50%;
        }

        .signup-check {
          accent-color: #1d4ed8;
          flex: 0 0 auto;
        }

        @media (prefers-reduced-motion: reduce) {
          .signup-stat-card,
          .signup-form-field,
          .signup-left-panel,
          .signup-dot,
          .signup-shimmer {
            animation: none;
          }
        }
      `}</style>

      <div className="signup-root relative flex min-h-[100dvh]" style={{ background: "#f8fafc" }}>
        <div className="absolute right-4 top-4 z-20 md:right-6 md:top-6">
          <LanguageSwitcher />
        </div>

        <div
          className="signup-left-panel relative hidden flex-col justify-between overflow-hidden p-12 lg:flex lg:w-[52%]"
          style={{ background: "linear-gradient(145deg, #0f172a 0%, #1e3a5f 60%, #1d4ed8 100%)" }}
        >
          {Array.from({ length: 80 }).map((_, i) => (
            <div
              key={i}
              className="signup-grid-dot"
              style={{
                left: `${(i % 10) * 11 + 3}%`,
                top: `${Math.floor(i / 10) * 12 + 4}%`,
                opacity: 0.08 + (i % 3) * 0.06,
              }}
            />
          ))}

          <div>
            <LocalizedLink href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.5px" }}>
                Minerval
              </span>
            </LocalizedLink>
          </div>

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
                sub: locale === "fr"
                  ? `sur ${formatNumber(312, locale)}`
                  : `of ${formatNumber(312, locale)}`,
              },
              {
                label: copy.login.stats[2].label,
                value: formatNumber(3, locale),
                sub: copy.login.stats[2].sub,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="signup-stat-card"
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 14,
                  padding: "14px 16px",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              >
                <p style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {stat.label}
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "white", letterSpacing: "-0.5px" }}>
                  {stat.value}
                </p>
                <p style={{ fontSize: 11, color: "#60a5fa", fontWeight: 500, marginTop: 2 }}>
                  {stat.sub}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center bg-white px-6 py-20 sm:px-8 lg:py-12">
          <div style={{ width: "100%", maxWidth: 400 }}>
            <div className="mb-8 lg:hidden">
              <LocalizedLink href="/" style={{ textDecoration: "none" }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#1d4ed8", letterSpacing: "-0.5px" }}>
                  Minerval
                </span>
              </LocalizedLink>
            </div>

            {state?.success ? (
              <div className="signup-form-field text-center">
                <div
                  className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: "#eff6ff", color: "#1d4ed8" }}
                  aria-hidden="true"
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-10 5L2 7" />
                  </svg>
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.8px", marginBottom: 8 }}>
                  {copy.signup.successTitle}
                </h1>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, marginBottom: 28 }}>
                  {copy.signup.successDescription}
                </p>
                <LocalizedLink
                  href="/login"
                  className="signup-submit inline-flex w-full items-center justify-center"
                  style={{
                    borderRadius: 10,
                    padding: "13px 20px",
                    fontSize: 15,
                    fontWeight: 600,
                    color: "white",
                    textDecoration: "none",
                    background: "#1d4ed8",
                    boxShadow: "0 4px 14px rgba(29,78,216,0.28)",
                  }}
                >
                  {copy.signup.successBackToSignIn}
                </LocalizedLink>
              </div>
            ) : (
              <>
                <div className="signup-form-field" style={{ marginBottom: 32 }}>
                  <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.8px", marginBottom: 6 }}>
                    {copy.signup.heading}
                  </h1>
                  <p style={{ fontSize: 14, color: "#64748b" }}>
                    {copy.signup.subheading}
                  </p>
                </div>

                <form action={action} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="captchaToken" value={captchaToken ?? ""} />

                  <div className="signup-form-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                      {copy.signup.emailLabel}
                    </label>
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder={copy.login.emailPlaceholder}
                      className={`signup-input${state?.error ? " error" : ""}`}
                      style={{
                        border: "1.5px solid #e2e8f0",
                        borderRadius: 10,
                        padding: "11px 14px",
                        fontSize: 14,
                        color: "#0f172a",
                        background: "#f8fafc",
                        width: "100%",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>

                  <div className="signup-form-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                      {copy.signup.passwordLabel}
                    </label>
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder={copy.login.passwordPlaceholder}
                      className={`signup-input${state?.error ? " error" : ""}`}
                      style={{
                        border: "1.5px solid #e2e8f0",
                        borderRadius: 10,
                        padding: "11px 14px",
                        fontSize: 14,
                        color: "#0f172a",
                        background: "#f8fafc",
                        width: "100%",
                        fontFamily: "inherit",
                      }}
                    />
                    <p style={{ fontSize: 12, color: "#94a3b8" }}>{copy.signup.passwordHint}</p>
                  </div>

                  <label className="signup-form-field flex items-start gap-3" style={{ fontSize: 13, lineHeight: 1.55, color: "#64748b", cursor: "pointer" }}>
                    <input
                      name="legalAccepted"
                      type="checkbox"
                      value="yes"
                      required
                      className="signup-check mt-0.5 h-4 w-4 rounded"
                    />
                    <span>
                      {copy.signup.legalPrefix}{" "}
                      <LocalizedLink href="/terms" style={{ color: "#1d4ed8", textDecoration: "none" }}>
                        {copy.signup.termsLink}
                      </LocalizedLink>{" "}
                      {copy.signup.legalJoin}{" "}
                      <LocalizedLink href="/privacy" style={{ color: "#1d4ed8", textDecoration: "none" }}>
                        {copy.signup.privacyLink}
                      </LocalizedLink>
                      .
                    </span>
                  </label>

                  {state?.error && (
                    <div
                      className="signup-form-field"
                      role="alert"
                      style={{
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: 10,
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 500 }}>{state.error}</span>
                    </div>
                  )}

                  <Turnstile siteKey={captchaSiteKey} onToken={onCaptchaToken} resetSignal={state?.error} />

                  <div className="signup-form-field">
                    <button
                      type="submit"
                      disabled={isPending || (captchaRequired && !captchaToken)}
                      className={`signup-submit${isPending ? " signup-shimmer" : ""}`}
                      style={{
                        width: "100%",
                        border: "none",
                        borderRadius: 10,
                        padding: "13px 20px",
                        fontSize: 15,
                        fontWeight: 600,
                        color: "white",
                        cursor: isPending ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                        background: isPending ? undefined : "#1d4ed8",
                        boxShadow: isPending ? "none" : "0 4px 14px rgba(29,78,216,0.28)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      {isPending ? (
                        <>
                          <span className="signup-dot" />
                          <span className="signup-dot" />
                          <span className="signup-dot" />
                          <span className="sr-only">{copy.signup.submitPending}</span>
                        </>
                      ) : copy.signup.submit}
                    </button>
                  </div>
                </form>

                <p style={{ marginTop: 28, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
                  {copy.signup.footerPrompt}{" "}
                  <LocalizedLink href="/login" style={{ color: "#1d4ed8", fontWeight: 600, textDecoration: "none" }}>
                    {copy.signup.footerLink}
                  </LocalizedLink>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
