"use client";
import { useActionState, useState, useRef } from "react";
import { signup } from "@/app/actions/auth";
import Link from "next/link";

const STEPS = [
  { num: 1, label: "School"  },
  { num: 2, label: "Setup"   },
  { num: 3, label: "Account" },
];

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, null);
  const [step, setStep] = useState(1);

  // Controlled values needed for left-panel previews + client validation
  const [schoolName,      setSchoolName]      = useState("");
  const [schoolCode,      setSchoolCode]      = useState("");
  const [studentIdPrefix, setStudentIdPrefix] = useState("");
  const [currency,        setCurrency]        = useState("FC");
  const [password,        setPassword]        = useState("");
  const [stepError,       setStepError]       = useState("");

  // Auto-derive school code from name
  function handleSchoolNameChange(v: string) {
    setSchoolName(v);
    const derived = v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
    setSchoolCode(derived);
    const words = v.trim().split(/\s+/);
    const prefix = words.map(w => w[0]?.toUpperCase() ?? "").join("").slice(0, 6);
    if (prefix.length >= 2) setStudentIdPrefix(prefix);
  }

  const pwStrength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3;
  const pwLabel  = ["", "Too short", "Good", "Strong"][pwStrength];
  const pwColor  = ["", "#ef4444", "#f59e0b", "#16a34a"][pwStrength];
  const pwWidth  = ["0%", "33%", "66%", "100%"][pwStrength];

  function validateStep(n: number): string {
    if (n === 1) {
      if (!schoolName.trim()) return "School name is required.";
      if (!schoolCode.trim()) return "School code is required.";
      if (!/^[a-z0-9-]+$/.test(schoolCode)) return "Code must be lowercase letters, numbers, and hyphens only.";
    }
    if (n === 2) {
      if (!studentIdPrefix || studentIdPrefix.length < 2) return "Student ID prefix must be at least 2 characters.";
      if (!/^[A-Z0-9]{2,6}$/.test(studentIdPrefix)) return "2–6 uppercase letters/numbers only.";
    }
    return "";
  }

  function next() {
    const err = validateStep(step);
    if (err) { setStepError(err); return; }
    setStepError("");
    setStep(s => s + 1);
  }

  function back() { setStepError(""); setStep(s => s - 1); }

  const previewIds = studentIdPrefix
    ? [`${studentIdPrefix}-001`, `${studentIdPrefix}-002`, `${studentIdPrefix}-003`]
    : ["ESM-001", "ESM-002", "ESM-003"];

  /* ─── Left panel content per step ─── */
  const leftContent = [
    {
      eyebrow: "Step 1 of 3 — School identity",
      heading: <>Your school,<br />your payment link.</>,
      body: "Pick a short, memorable code for your school — it becomes part of your public payment URL.",
      visual: (
        <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", marginBottom: 6, fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase" }}>Your payment URL</p>
          <p style={{ fontSize: 14, color: "white", fontWeight: 600, letterSpacing: "-0.2px", wordBreak: "break-all" }}>
            <span style={{ color: "rgba(148,163,184,0.6)" }}>minerval.org/pay/</span>
            <span style={{ color: "#60a5fa" }}>{schoolCode || "sainte-marie"}</span>
          </p>
        </div>
      ),
    },
    {
      eyebrow: "Step 2 of 3 — Configuration",
      heading: <>Set once,<br />used forever.</>,
      body: "Your student ID prefix appears on every student record and payment receipt. Keep it short and recognisable.",
      visual: (
        <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", marginBottom: 10, fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase" }}>Student IDs preview</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {previewIds.map((id, i) => (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: i === 0 ? "#60a5fa" : "rgba(148,163,184,0.35)", flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: i === 0 ? "white" : "rgba(148,163,184,0.65)", fontWeight: i === 0 ? 600 : 400, fontVariantNumeric: "tabular-nums" }}>{id}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      eyebrow: "Step 3 of 3 — Admin account",
      heading: <>Almost there.<br />You're in charge.</>,
      body: "Your admin account controls everything — students, fees, payments, and reports. Keep your password safe.",
      visual: (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "Full dashboard access" },
            { icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", label: "Manage all students" },
            { icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z", label: "Track all payments" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(147,197,253,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              <span style={{ fontSize: 13, color: "rgba(148,163,184,0.9)", fontWeight: 500 }}>{item.label}</span>
            </div>
          ))}
        </div>
      ),
    },
  ][step - 1];

  return (
    <>
      <style>{`
        .su-root { font-family: 'Outfit', system-ui, sans-serif; }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
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
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
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

        .step-fields { animation: slideInRight 0.42s cubic-bezier(0.16,1,0.3,1) both; }
        .left-panel  { animation: fadeIn 0.9s ease both; }
        .left-visual { animation: fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.15s both; }

        .form-field { animation: fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .form-field:nth-child(1) { animation-delay: 0.05s; }
        .form-field:nth-child(2) { animation-delay: 0.14s; }
        .form-field:nth-child(3) { animation-delay: 0.22s; }

        .input-field { transition: border-color 0.18s, box-shadow 0.18s; outline: none; }
        .input-field:focus { border-color: #1d4ed8; box-shadow: 0 0 0 3px rgba(29,78,216,0.11); }
        .input-field.error { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.1); }

        .btn-primary {
          transition: background 0.2s, transform 0.12s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;
        }
        .btn-primary:hover:not(:disabled) {
          background: #1e40af !important;
          box-shadow: 0 8px 24px rgba(29,78,216,0.3);
          transform: translateY(-1px);
        }
        .btn-primary:active:not(:disabled) { transform: scale(0.98) translateY(0); box-shadow: none; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .btn-secondary {
          transition: background 0.15s, color 0.15s;
        }
        .btn-secondary:hover { background: #f1f5f9 !important; }
        .btn-secondary:active { transform: scale(0.98); }

        .shimmer-btn {
          background: linear-gradient(90deg, #1d4ed8 0%, #3b82f6 50%, #1d4ed8 100%) !important;
          background-size: 200% auto !important;
          animation: shimmer 1.4s linear infinite;
        }

        .dot-1,.dot-2,.dot-3 {
          width: 5px; height: 5px; border-radius: 50%; background: white; display: inline-block;
          animation: floatDot 1s ease-in-out infinite;
        }
        .dot-2 { animation-delay: 0.18s; }
        .dot-3 { animation-delay: 0.36s; }

        .step-dot {
          transition: background 0.3s, border-color 0.3s, transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        .progress-bar-fill { transition: width 0.5s cubic-bezier(0.16,1,0.3,1); }
        .strength-bar      { transition: width 0.3s cubic-bezier(0.16,1,0.3,1), background 0.3s; }

        .grid-dot {
          position: absolute; width: 1px; height: 1px;
          background: rgba(255,255,255,0.15); border-radius: 50%;
        }

        .check-circle { stroke-dasharray: 100; animation: drawCircle 0.55s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
        .check-mark   { stroke-dasharray: 40;  animation: drawCheck  0.45s cubic-bezier(0.16,1,0.3,1) 0.55s both; }
        .check-wrapper { animation: popIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .pulse-ring {
          position: absolute; inset: -6px; border-radius: 50%;
          border: 1.5px solid rgba(22,163,74,0.4);
          animation: pulseRing 1.8s cubic-bezier(0.22,1,0.36,1) 0.6s infinite;
        }

        .success-panel { animation: fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div className="su-root min-h-[100dvh] flex" style={{ background: "#f8fafc" }}>

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

          {/* Dynamic copy */}
          <div key={step} style={{ maxWidth: 400 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(147,197,253,0.9)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 20 }}>
              {leftContent.eyebrow}
            </p>
            <h2 style={{ fontSize: "clamp(26px,3vw,38px)", fontWeight: 800, color: "white", lineHeight: 1.15, letterSpacing: "-1px", marginBottom: 16 }}>
              {leftContent.heading}
            </h2>
            <p style={{ fontSize: 15, color: "rgba(148,163,184,0.9)", lineHeight: 1.7, maxWidth: 340, marginBottom: 28 }}>
              {leftContent.body}
            </p>
            <div className="left-visual">{leftContent.visual}</div>
          </div>

          {/* Step indicators (left panel) */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {STEPS.map(s => (
              <div key={s.num} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: step > s.num ? 20 : step === s.num ? 20 : 8,
                  height: 8, borderRadius: 4,
                  background: step > s.num ? "rgba(96,165,250,0.8)" : step === s.num ? "white" : "rgba(255,255,255,0.2)",
                  transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
                }} />
              </div>
            ))}
            <p style={{ fontSize: 12, color: "rgba(148,163,184,0.6)", marginLeft: 4 }}>
              {step} of {STEPS.length}
            </p>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex-1 flex items-center justify-center px-6 py-12" style={{ background: "white" }}>
          <div style={{ width: "100%", maxWidth: 420 }}>

            {/* Mobile logo */}
            <div className="lg:hidden mb-8">
              <Link href="/" style={{ textDecoration: "none" }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#1d4ed8", letterSpacing: "-0.5px" }}>Minerval</span>
              </Link>
            </div>

            {/* ── Progress bar ── */}
            <div style={{ marginBottom: 36 }}>
              {/* Step labels */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                {STEPS.map(s => (
                  <span key={s.num} style={{
                    fontSize: 12, fontWeight: step >= s.num ? 600 : 400,
                    color: step > s.num ? "#16a34a" : step === s.num ? "#0f172a" : "#94a3b8",
                    transition: "color 0.3s",
                  }}>
                    {step > s.num ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {s.label}
                      </span>
                    ) : s.label}
                  </span>
                ))}
              </div>

              {/* Bar track */}
              <div style={{ height: 4, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                <div
                  className="progress-bar-fill"
                  style={{
                    height: "100%", borderRadius: 4,
                    background: "linear-gradient(90deg, #1d4ed8, #3b82f6)",
                    width: `${((step - 1) / (STEPS.length - 1)) * 100}%`,
                    minWidth: step === 1 ? "8%" : undefined,
                  }}
                />
              </div>

              {/* Step dots */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: -6, position: "relative" }}>
                {STEPS.map(s => (
                  <div key={s.num} className="step-dot" style={{
                    width: 14, height: 14, borderRadius: "50%",
                    border: `2px solid ${step > s.num ? "#16a34a" : step === s.num ? "#1d4ed8" : "#e2e8f0"}`,
                    background: step > s.num ? "#16a34a" : step === s.num ? "#1d4ed8" : "white",
                    transform: step === s.num ? "scale(1.2)" : "scale(1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {step > s.num && (
                      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Heading ── */}
            <div key={`heading-${step}`} style={{ marginBottom: 28, animation: "fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both" }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.7px", marginBottom: 5 }}>
                {["Your school's identity", "Configuration", "Admin account"][step - 1]}
              </h1>
              <p style={{ fontSize: 14, color: "#64748b" }}>
                {[
                  "Give your school a name and a unique code.",
                  "Set the student ID format and fee currency.",
                  "Create the admin login for this school.",
                ][step - 1]}
              </p>
            </div>

            {/* ── The one form that wraps ALL steps ── */}
            <form action={action}>

              {/* All hidden inputs carry state across steps */}
              <input type="hidden" name="schoolName"      value={schoolName} />
              <input type="hidden" name="schoolCode"      value={schoolCode} />
              <input type="hidden" name="studentIdPrefix" value={studentIdPrefix} />
              <input type="hidden" name="currency"        value={currency} />

              {/* ── STEP 1 ── */}
              {step === 1 && (
                <div className="step-fields" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                  <div className="form-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>School name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. École Sainte Marie"
                      value={schoolName}
                      onChange={e => handleSchoolNameChange(e.target.value)}
                      className="input-field"
                      style={{ border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "#0f172a", background: "#f8fafc", width: "100%", fontFamily: "inherit" }}
                    />
                  </div>

                  <div className="form-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>School code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. sainte-marie"
                      value={schoolCode}
                      onChange={e => setSchoolCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      className="input-field"
                      style={{ border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "#0f172a", background: "#f8fafc", width: "100%", fontFamily: "inherit" }}
                    />
                    <p style={{ fontSize: 12, color: "#94a3b8" }}>Lowercase letters, numbers, hyphens — used in your payment URL.</p>
                  </div>

                  {stepError && <StepError msg={stepError} />}

                  <button type="button" onClick={next} className="btn-primary"
                    style={{ width: "100%", border: "none", borderRadius: 10, padding: "13px 20px", fontSize: 15, fontWeight: 600, color: "white", background: "#1d4ed8", boxShadow: "0 4px 14px rgba(29,78,216,0.28)", fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    Continue
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                </div>
              )}

              {/* ── STEP 2 ── */}
              {step === 2 && (
                <div className="step-fields" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                  <div className="form-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Student ID prefix</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ESM"
                      value={studentIdPrefix}
                      maxLength={6}
                      onChange={e => setStudentIdPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                      className="input-field"
                      style={{ border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "#0f172a", background: "#f8fafc", width: "100%", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "1px" }}
                    />
                    <p style={{ fontSize: 12, color: "#94a3b8" }}>
                      2–6 uppercase letters. Students get IDs like{" "}
                      <span style={{ color: "#1d4ed8", fontWeight: 600 }}>{studentIdPrefix || "ESM"}-001</span>.
                    </p>
                  </div>

                  <div className="form-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Fee currency</label>
                    <div style={{ position: "relative" }}>
                      <select
                        value={currency}
                        onChange={e => setCurrency(e.target.value)}
                        className="input-field"
                        style={{ border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "#0f172a", background: "#f8fafc", width: "100%", fontFamily: "inherit", appearance: "none" }}
                      >
                        <option value="FC">FC — Franc Congolais</option>
                        <option value="USD">USD — US Dollar</option>
                      </select>
                      <svg style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                    <p style={{ fontSize: 12, color: "#94a3b8" }}>All fee amounts at your school will use this currency.</p>
                  </div>

                  {stepError && <StepError msg={stepError} />}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={back} className="btn-secondary"
                      style={{ flex: "0 0 auto", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "13px 18px", fontSize: 15, fontWeight: 600, color: "#64748b", background: "white", fontFamily: "inherit", cursor: "pointer" }}>
                      Back
                    </button>
                    <button type="button" onClick={next} className="btn-primary"
                      style={{ flex: 1, border: "none", borderRadius: 10, padding: "13px 20px", fontSize: 15, fontWeight: 600, color: "white", background: "#1d4ed8", boxShadow: "0 4px 14px rgba(29,78,216,0.28)", fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      Continue
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 3 ── */}
              {step === 3 && (
                <div className="step-fields" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                  <div className="form-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Admin email</label>
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@yourschool.org"
                      className="input-field"
                      style={{ border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "#0f172a", background: "#f8fafc", width: "100%", fontFamily: "inherit" }}
                    />
                  </div>

                  <div className="form-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Password</label>
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={8}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="input-field"
                      style={{ border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "#0f172a", background: "#f8fafc", width: "100%", fontFamily: "inherit" }}
                    />
                    {password.length > 0 && (
                      <div>
                        <div style={{ height: 3, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                          <div className="strength-bar" style={{ height: "100%", width: pwWidth, background: pwColor, borderRadius: 2 }} />
                        </div>
                        <p style={{ fontSize: 11, color: pwColor, fontWeight: 600, marginTop: 4 }}>{pwLabel}</p>
                      </div>
                    )}
                  </div>

                  {(stepError || state?.error) && <StepError msg={stepError || state?.error || ""} />}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={back} disabled={pending} className="btn-secondary"
                      style={{ flex: "0 0 auto", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "13px 18px", fontSize: 15, fontWeight: 600, color: "#64748b", background: "white", fontFamily: "inherit", cursor: "pointer" }}>
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={pending}
                      className={`btn-primary${pending ? " shimmer-btn" : ""}`}
                      style={{ flex: 1, border: "none", borderRadius: 10, padding: "13px 20px", fontSize: 15, fontWeight: 600, color: "white", background: pending ? undefined : "#1d4ed8", boxShadow: pending ? "none" : "0 4px 14px rgba(29,78,216,0.28)", fontFamily: "inherit", cursor: pending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      {pending ? (
                        <><span className="dot-1"/><span className="dot-2"/><span className="dot-3"/></>
                      ) : "Create school"}
                    </button>
                  </div>
                </div>
              )}

            </form>

            {/* Footer */}
            <p style={{ marginTop: 28, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
              Already registered?{" "}
              <Link href="/login" style={{ color: "#1d4ed8", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
            </p>
          </div>
        </div>

      </div>
    </>
  );
}

function StepError({ msg }: { msg: string }) {
  return (
    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 500 }}>{msg}</span>
    </div>
  );
}
