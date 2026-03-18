# SerdiPay Proxy

This service runs on a fixed-IP host so SerdiPay can whitelist it. The main Next.js app never talks to SerdiPay directly; it sends `POST /pay` to this proxy with `x-proxy-secret`.

## Setup

```bash
cd proxy
npm install
cp .env.example .env
npm run dev
```

## Endpoints

- `GET /health` returns configuration readiness and liveness
- `POST /pay` validates the shared secret, authenticates with SerdiPay, and forwards the payment request

## Required Environment Variables

- `PORT`
- `PROXY_SECRET`
- `SERDIPAY_BASE_URL`
- `SERDIPAY_EMAIL`
- `SERDIPAY_PASSWORD`
- `SERDIPAY_API_ID`
- `SERDIPAY_API_PASSWORD`
- `SERDIPAY_MERCHANT_CODE`
- `SERDIPAY_MERCHANT_PIN`
- `SERDIPAY_CURRENCY`

## PM2

Use [`ecosystem.config.cjs`](./ecosystem.config.cjs) on the Hetzner box:

```bash
cd /opt/serdipay-proxy
npm install
pm2 start ecosystem.config.cjs
pm2 save
```
