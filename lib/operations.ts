import { sendOperationalAlert } from "./email";

export type OperationalIssue = {
  source: string;
  message: string;
  severity?: "warning" | "critical";
  reference?: string;
};

export async function reportOperationalIssue(issue: OperationalIssue) {
  const event = {
    ...issue,
    severity: issue.severity ?? "critical",
    timestamp: new Date().toISOString(),
  };

  console.error("[operations]", JSON.stringify(event));

  if (!process.env.OPERATIONS_ALERT_EMAIL || !process.env.RESEND_API_KEY) return;

  await Promise.resolve(
    sendOperationalAlert({
      to: process.env.OPERATIONS_ALERT_EMAIL,
      subject: `[${event.severity.toUpperCase()}] ${event.source}`,
      text: [
        event.message,
        event.reference ? `Reference: ${event.reference}` : "",
        `Timestamp: ${event.timestamp}`,
      ]
        .filter(Boolean)
        .join("\n"),
    })
  ).catch((error) => {
    console.error(
      "[operations] alert delivery failed",
      error instanceof Error ? error.message : "Unknown alert delivery error"
    );
  });
}
