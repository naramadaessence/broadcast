# Architecture

## System Overview

Narmada Broadcast is a single-client WhatsApp operations workspace. The browser
app manages contacts, broadcasts, catalogue products, orders, WhatsApp chat, and
smart FAQ replies. The backend is an Express API running on Vercel Node
functions and persists all client data in a client-owned MongoDB Atlas database.

## Architecture Diagram

```
Browser SPA (Preact/Vite)
  |
  | relative /api/v1/* calls with JWT
  v
Express API on Vercel (backend/src/app.js)
  |
  +--> MongoDB Atlas via Mongoose models
  +--> Meta WhatsApp Cloud API
  +--> DeepSeek Chat API for FAQ/product answer text
  +--> Razorpay/Shopify integrations when configured
```

## Layers & Responsibilities

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| Frontend | Preact, Zustand, Vite | Auth shell, workspace navigation, forms, chat inbox, API calls |
| Backend/API | Express.js | Route handling, JWT auth, singleton settings loading, integration orchestration |
| Database | MongoDB Atlas, Mongoose | Contacts, settings, campaigns, messages, orders, products, smart bot records |
| Auth | JWT | Single admin session validation through `/api/v1/auth/me` |
| Smart Automation | DeepSeek responder plus deterministic orchestration | Generated FAQ/product text, language/catalogue actions, exact-product media selection, and handoff state |
| Hosting | Vercel | Static frontend and Node API functions routed by `vercel.json` |
| Testing | `node:test`, ESLint, Vite | Regression contracts, lint, production build verification |

## Data Flow

### Login And Session Validation

1. Admin submits `admin` / `admin123` to `POST /api/v1/auth/login`.
2. Backend returns a JWT plus the singleton client tenant/profile payload.
3. Frontend stores the token in the product-specific `narmada_broadcast_token` key and state in `narmada-broadcast-storage`.
4. On every app boot, `validateSession()` calls `GET /api/v1/auth/me`.
5. Invalid/stale tokens are cleared before the dashboard is shown.

### Knowledge Base And Bot Reply

1. Admin curates FAQ entries and catalogue products in MongoDB.
2. `handleSmartReply()` runs deterministic language and catalogue actions, then asks DeepSeek to write the FAQ/product answer from the supplied business context and recent conversation.
3. The DeepSeek prompt and generated text remain unchanged by media delivery.
4. `selectExplicitProductMedia()` independently checks only the latest customer message. It returns stored media only for one exact SKU or complete unique multi-word product name; broad and multi-product requests return no media metadata.
5. The webhook sends the stored image URL as a WhatsApp media link with the original DeepSeek text as its caption. A media error falls back to that same text.

### Vercel API Request

1. Browser calls `/api/v1/...` on the same Vercel origin.
2. `app.js` loads singleton settings into `req.tenant` and `req.tenantId`.
3. Protected routes require `Authorization: Bearer <token>`.
4. Route handlers use Mongoose models directly.

## Key Design Patterns

- Single-client singleton settings document: `Setting` uses `singletonId: admin_settings`.
- Same-origin API deployment: no production `VITE_API_URL` is required.
- Serverless-safe uploads: upload helpers use writable temp storage where needed.
- DeepSeek owns FAQ/product answer wording; deterministic application code owns actions, product identity validation, media transport, and fallback delivery.
- Static/helper regression tests: tests avoid live MongoDB, Meta, Razorpay, or Vercel dependencies.

## External Dependencies

| Dependency | Purpose | Failure Mode |
|------------|---------|--------------|
| MongoDB Atlas | Primary persistence | Backend routes fail; login/settings/KB unavailable |
| Meta WhatsApp Cloud API | Templates, messages, webhooks, media | Broadcast/chat send and media retrieval fail |
| DeepSeek API | FAQ and product answer text | Ordinary knowledge answers cannot be generated; deterministic application actions remain available |
| Razorpay | Payment links when configured | Payment-link flows fail |
| Shopify | Optional product sync | Shopify sync fails; local catalogue still works |
| Vercel | Hosting and deployment | Site/API unavailable |

## Scalability & Limits

- The current architecture is intentionally single-client and not designed for tenant isolation.
- Vercel functions are stateless; background workers and schedulers are disabled on Vercel.
- Local uploaded files in serverless temp storage are ephemeral; persistent media should live in external storage if this becomes important.
- MongoDB Atlas sizing and connection limits are the primary production scaling constraints.

## What Not To Do

- Do not point this fork at the original SaaS database.
- Do not add tenant-seat billing or signup flows unless the client requirement changes.
- Do not hardcode MongoDB, JWT, Meta, Razorpay, Shopify, or SMTP secrets.
- Do not change the working DeepSeek prompt to make media delivery work.
- Do not infer one product image from a family/category request or from generated text alone.
