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
  +--> Razorpay/Shopify integrations when configured
  +--> Local Smart Automation embeddings and lexical fallback
```

## Layers & Responsibilities

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| Frontend | Preact, Zustand, Vite | Auth shell, workspace navigation, forms, chat inbox, API calls |
| Backend/API | Express.js | Route handling, JWT auth, singleton settings loading, integration orchestration |
| Database | MongoDB Atlas, Mongoose | Contacts, settings, campaigns, messages, orders, products, smart bot records |
| Auth | JWT | Single admin session validation through `/api/v1/auth/me` |
| Smart Automation | Smart responder service | FAQ/product matching with local embeddings and lexical fallback |
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

1. Admin creates FAQ entries from the Knowledge Base UI.
2. Backend stores FAQs and attempts to generate local vectors with the active embedding model.
3. FAQ, alternate phrasing, and product vectors are cached in memory for fast matching.
4. When vectors are missing or unavailable, `scoreTextMatch()` provides a deterministic lexical fallback.
5. The webhook smart responder uses the same `handleSmartReply()` path for incoming WhatsApp text.

### Vercel API Request

1. Browser calls `/api/v1/...` on the same Vercel origin.
2. `app.js` loads singleton settings into `req.tenant` and `req.tenantId`.
3. Protected routes require `Authorization: Bearer <token>`.
4. Route handlers use Mongoose models directly.

## Key Design Patterns

- Single-client singleton settings document: `Setting` uses `singletonId: admin_settings`.
- Same-origin API deployment: no production `VITE_API_URL` is required.
- Serverless-safe uploads: upload helpers use writable temp storage where needed.
- Local embeddings improve matching, but the lexical fallback must keep the app usable if vectors are missing.
- Static/helper regression tests: tests avoid live MongoDB, Meta, Razorpay, or Vercel dependencies.

## External Dependencies

| Dependency | Purpose | Failure Mode |
|------------|---------|--------------|
| MongoDB Atlas | Primary persistence | Backend routes fail; login/settings/KB unavailable |
| Meta WhatsApp Cloud API | Templates, messages, webhooks, media | Broadcast/chat send and media retrieval fail |
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
- Do not remove the lexical fallback unless another no-key bot path replaces it.
