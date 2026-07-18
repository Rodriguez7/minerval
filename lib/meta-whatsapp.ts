import { z } from "zod";

const SuccessSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).min(1),
});

const ErrorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
});

export class MetaWhatsAppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(opts: { message: string; status: number; code: string; retryable: boolean }) {
    super(opts.message);
    this.name = "MetaWhatsAppError";
    this.status = opts.status;
    this.code = opts.code;
    this.retryable = opts.retryable;
  }
}

function getConfiguration() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION?.trim();

  if (!accessToken || !phoneNumberId || !graphVersion || !/^v\d+\.\d+$/.test(graphVersion)) {
    throw new MetaWhatsAppError({
      message: "Meta WhatsApp Cloud API is not configured",
      status: 500,
      code: "configuration_missing",
      retryable: false,
    });
  }

  return { accessToken, phoneNumberId, graphVersion };
}

export async function sendWhatsAppTemplate(opts: {
  to: string;
  templateName: string;
  locale: "fr";
  bodyParameters: string[];
  buttonToken?: string;
}) {
  if (!/^243[89]\d{8}$/.test(opts.to)) {
    throw new MetaWhatsAppError({
      message: "Invalid normalized DRC WhatsApp number",
      status: 400,
      code: "invalid_recipient",
      retryable: false,
    });
  }

  const { accessToken, phoneNumberId, graphVersion } = getConfiguration();
  const components: Array<Record<string, unknown>> = [
    {
      type: "body",
      parameters: opts.bodyParameters.map((text) => ({ type: "text", text })),
    },
  ];

  if (opts.buttonToken) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: opts.buttonToken }],
    });
  }

  let response: Response;
  try {
    response = await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: opts.to,
          type: "template",
          template: {
            name: opts.templateName,
            language: { code: "fr" },
            components,
          },
        }),
      }
    );
  } catch (error) {
    throw new MetaWhatsAppError({
      message: error instanceof Error ? error.message : "Meta network request failed",
      status: 503,
      code: "network_error",
      retryable: true,
    });
  }

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ErrorSchema.safeParse(json);
    const metaCode = parsed.success ? parsed.data.error.code : undefined;
    const code = metaCode ? String(metaCode) : `http_${response.status}`;
    throw new MetaWhatsAppError({
      message:
        (parsed.success && parsed.data.error.message) ||
        `Meta WhatsApp request failed with HTTP ${response.status}`,
      status: response.status,
      code,
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  const parsed = SuccessSchema.safeParse(json);
  if (!parsed.success) {
    throw new MetaWhatsAppError({
      message: "Meta WhatsApp returned an invalid success response",
      status: 502,
      code: "invalid_response",
      retryable: true,
    });
  }

  return { messageId: parsed.data.messages[0].id };
}
