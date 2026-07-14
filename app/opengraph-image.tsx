import { ImageResponse } from "next/og";

export const alt = "Minerval — Paiements scolaires par mobile money";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #dbeafe 100%)",
          color: "#0f172a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#1d4ed8",
              color: "white",
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            M
          </div>
          <div style={{ fontSize: 38, fontWeight: 800, color: "#1d4ed8" }}>Minerval</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 940 }}>
          <div style={{ fontSize: 68, lineHeight: 1.08, fontWeight: 800, letterSpacing: -2 }}>
            Les frais scolaires, simplement.
          </div>
          <div style={{ fontSize: 30, lineHeight: 1.4, color: "#475569" }}>
            Mobile money, recus instantanes et suivi en temps reel pour les ecoles de la RDC.
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, fontSize: 24, color: "#1e40af", fontWeight: 600 }}>
          <span>M-Pesa</span><span>·</span><span>Airtel Money</span><span>·</span><span>Orange Money</span>
        </div>
      </div>
    ),
    size
  );
}
