type EmailTone = "success" | "danger" | "warning" | "info";

type EmailDetail = {
  label: string;
  value: string;
};

type EmailAction = {
  label: string;
  url: string;
};

type BrandedEmailOptions = {
  preview: string;
  eyebrow: string;
  title: string;
  message: string;
  tone?: EmailTone;
  details?: EmailDetail[];
  action?: EmailAction;
  note?: string;
};

const TONE_COLORS: Record<EmailTone, { background: string; foreground: string }> = {
  success: { background: "#dcfce7", foreground: "#166534" },
  danger: { background: "#fee2e2", foreground: "#991b1b" },
  warning: { background: "#fef3c7", foreground: "#92400e" },
  info: { background: "#dbeafe", foreground: "#1e40af" },
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderDetails(details: EmailDetail[]) {
  if (details.length === 0) return "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
      ${details
        .map(
          ({ label, value }) => `
            <tr>
              <td style="padding:12px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">${escapeHtml(label)}</td>
              <td align="right" style="padding:12px 16px;color:#0f172a;font-size:14px;font-weight:600;border-bottom:1px solid #e2e8f0;">${escapeHtml(value)}</td>
            </tr>`
        )
        .join("")}
    </table>`;
}

export function renderBrandedEmail(options: BrandedEmailOptions) {
  const tone = TONE_COLORS[options.tone ?? "info"];
  const details = renderDetails(options.details ?? []);
  const action = options.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
        <tr>
          <td style="border-radius:9px;background:#1d4ed8;">
            <a href="${escapeHtml(options.action.url)}" style="display:inline-block;padding:13px 20px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">${escapeHtml(options.action.label)}</a>
          </td>
        </tr>
      </table>`
    : "";
  const note = options.note
    ? `<p style="margin:20px 0 0;color:#64748b;font-size:13px;line-height:1.6;">${escapeHtml(options.note).replaceAll("\n", "<br>")}</p>`
    : "";

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(options.title)}</title>
  </head>
  <body style="margin:0;background:#f1f5f9;font-family:Inter,Segoe UI,Helvetica Neue,Arial,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preview)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
            <tr>
              <td style="padding:0 4px 18px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="width:42px;height:42px;border-radius:11px;background:#1d4ed8;color:#ffffff;font-size:23px;font-weight:800;">M</td>
                    <td style="padding-left:12px;color:#1d4ed8;font-size:22px;font-weight:800;letter-spacing:-0.4px;">Minerval</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:36px 40px;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
                <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${tone.background};color:${tone.foreground};font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(options.eyebrow)}</span>
                <h1 style="margin:18px 0 12px;color:#0f172a;font-size:28px;line-height:1.2;letter-spacing:-0.6px;">${escapeHtml(options.title)}</h1>
                <p style="margin:0;color:#475569;font-size:16px;line-height:1.65;">${escapeHtml(options.message)}</p>
                ${details}
                ${action}
                ${note}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 24px;color:#64748b;font-size:12px;line-height:1.6;">
                Minerval · Les frais scolaires, simplement.<br>
                <a href="https://www.minerval.org" style="color:#1d4ed8;text-decoration:none;">www.minerval.org</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
