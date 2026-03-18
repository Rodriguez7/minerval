import "dotenv/config";
import crypto from "node:crypto";
import express from "express";

const VALID_TELECOMS = new Set(["AM", "OM", "MP", "AF"]);

class SerdiPayError extends Error {
  constructor(message, status, details, stage) {
    super(message);
    this.name = "SerdiPayError";
    this.status = status;
    this.details = details;
    this.stage = stage;
  }
}

function getConfig() {
  return {
    port: Number(process.env.PORT || 4010),
    proxySecret: process.env.PROXY_SECRET,
    baseUrl:
      process.env.SERDIPAY_BASE_URL || "https://serdipay.com/api/public-api/v1",
    email: process.env.SERDIPAY_EMAIL,
    password: process.env.SERDIPAY_PASSWORD,
    apiId: process.env.SERDIPAY_API_ID,
    apiPassword: process.env.SERDIPAY_API_PASSWORD,
    merchantCode: process.env.SERDIPAY_MERCHANT_CODE,
    merchantPin: process.env.SERDIPAY_MERCHANT_PIN,
    currency: process.env.SERDIPAY_CURRENCY || "CDF",
  };
}

function getMissingConfigKeys(config) {
  return Object.entries({
    PROXY_SECRET: config.proxySecret,
    SERDIPAY_EMAIL: config.email,
    SERDIPAY_PASSWORD: config.password,
    SERDIPAY_API_ID: config.apiId,
    SERDIPAY_API_PASSWORD: config.apiPassword,
    SERDIPAY_MERCHANT_CODE: config.merchantCode,
    SERDIPAY_MERCHANT_PIN: config.merchantPin,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

function parsePaymentPayload(body) {
  const amount = Number(body?.amount);
  const phone = String(body?.phone || "").trim();
  const reference = String(body?.reference || "").trim();
  const telecom = String(body?.telecom || "").trim().toUpperCase();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be a positive number");
  }

  if (!/^\d{9,15}$/.test(phone)) {
    throw new Error("phone must be 9 to 15 digits");
  }

  if (!reference) {
    throw new Error("reference is required");
  }

  if (!VALID_TELECOMS.has(telecom)) {
    throw new Error("telecom must be one of AM, OM, MP, AF");
  }

  return { amount, phone, reference, telecom };
}

async function fetchJson(url, init) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(10_000),
  });

  const data = await response.json().catch(() => ({}));

  return { data, response };
}

async function getAccessToken(config) {
  const { data, response } = await fetchJson(`${config.baseUrl}/merchant/get-token`, {
    method: "POST",
    body: JSON.stringify({
      email: config.email,
      password: config.password,
    }),
  });

  if (!response.ok || !data.access_token) {
    throw new SerdiPayError(
      "Failed to authenticate with SerdiPay",
      response.status,
      data,
      "auth"
    );
  }

  return data.access_token;
}

async function processPayment(config, payload) {
  const accessToken = await getAccessToken(config);

  const paymentBody = {
    api_id: config.apiId,
    api_password: config.apiPassword,
    merchantCode: config.merchantCode,
    merchant_pin: config.merchantPin,
    clientPhone: payload.phone,
    amount: payload.amount,
    currency: config.currency,
    telecom: payload.telecom,
    message: payload.reference,
    reference: payload.reference,
  };

  const { data, response } = await fetchJson(
    `${config.baseUrl}/merchant/payment-merchant`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(paymentBody),
    }
  );

  if (!response.ok) {
    throw new SerdiPayError(
      data?.message || `SerdiPay payment failed with ${response.status}`,
      response.status,
      data,
      "payment"
    );
  }

  return { data, status: response.status };
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.get("/health", (_req, res) => {
  const config = getConfig();
  const missingConfigKeys = getMissingConfigKeys(config);

  res.status(missingConfigKeys.length === 0 ? 200 : 503).json({
    service: "serdipay-proxy",
    status: missingConfigKeys.length === 0 ? "ok" : "degraded",
    missingConfigKeys,
    timestamp: new Date().toISOString(),
  });
});

app.post("/pay", async (req, res) => {
  const requestId = crypto.randomUUID();
  const config = getConfig();

  if (req.get("x-proxy-secret") !== config.proxySecret) {
    return res.status(401).json({ error: "Unauthorized", requestId });
  }

  const missingConfigKeys = getMissingConfigKeys(config);
  if (missingConfigKeys.length > 0) {
    return res.status(503).json({
      error: "Proxy is not fully configured",
      missingConfigKeys,
      requestId,
    });
  }

  let payload;
  try {
    payload = parsePaymentPayload(req.body);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid payload",
      requestId,
    });
  }

  try {
    const result = await processPayment(config, payload);
    return res.status(result.status).json(result.data);
  } catch (error) {
    if (error instanceof SerdiPayError) {
      if (error.stage === "payment") {
        return res.status(error.status).json({
          error: error.message,
          details: error.details,
          requestId,
        });
      }

      return res.status(502).json({
        error: "Unable to authenticate with SerdiPay",
        details: error.details,
        requestId,
      });
    }

    console.error("Proxy request failed", {
      message: error instanceof Error ? error.message : "Unknown error",
      requestId,
    });

    return res.status(500).json({
      error: "Unexpected proxy error",
      requestId,
    });
  }
});

const config = getConfig();
const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`SerdiPay proxy listening on port ${config.port}`);
});

server.requestTimeout = 15_000;
server.headersTimeout = 20_000;
