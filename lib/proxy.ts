import type { Telecom } from "./types";

export interface ProxyPayload {
  amount: number;
  phone: string;
  reference: string;
  telecom: Telecom;
  callback_url?: string;
}

export interface ProxyResponse {
  payment?: {
    sessionId?: string | number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export class ProxyError extends Error {
  status: number;
  details: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ProxyError";
    this.status = status;
    this.details = details;
  }
}

async function callProxyEndpoint(path: "/pay" | "/payout", payload: ProxyPayload): Promise<ProxyResponse> {
  const proxyUrl = process.env.PROXY_URL;
  const proxySecret = process.env.PROXY_SECRET;
  if (!proxyUrl || !proxySecret) throw new Error("Missing PROXY_URL or PROXY_SECRET");

  const res = await fetch(`${proxyUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-proxy-secret": proxySecret,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data?.details?.message || data?.error || `Proxy error: ${res.status}`;
    throw new ProxyError(message, res.status, data);
  }

  return data;
}

export async function callProxy(payload: ProxyPayload): Promise<ProxyResponse> {
  return callProxyEndpoint("/pay", payload);
}

export async function callProxyPayout(payload: ProxyPayload): Promise<ProxyResponse> {
  return callProxyEndpoint("/payout", payload);
}
