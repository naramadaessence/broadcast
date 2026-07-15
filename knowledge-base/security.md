# Security

## What This Subsystem Does
Security is split across request authentication, singleton client scoping, webhook verification, client-safe secret handling, deployment secret hygiene, and dependency hygiene. This fork is single-client, so the primary risk is accidentally sharing credentials or databases with another deployment.

## How It Is Structured
| Area | Files | Notes |
|------|-------|-------|
| Auth and client context | `backend/src/middleware/auth.js`, `backend/src/middleware/loadSettings.js`, `backend/src/routes/auth.js` | JWT auth validates the admin token; `/auth/me` validates persisted browser sessions; `loadSettings` attaches the singleton settings document. |
| Webhook security | `backend/src/app.js`, `backend/src/utils/security.js` | WhatsApp verification uses the configured verify token; Razorpay webhooks verify the HMAC over `req.rawBody`. |
| Settings secret handling | `backend/src/routes/tenant-settings.js`, `backend/src/utils/settings-security.js` | Secret-bearing payment settings are blanked before returning to the browser and preserved on blank updates. |
| MongoDB connection | `backend/src/database.js`, `knowledge-base/DEPLOYMENT.md` | Production/Vercel requires `MONGO_URI`; no Atlas URI may be hardcoded. |
| Chat human takeover | `backend/src/models/WhatsAppConversation.js`, `backend/src/routes/webhook.js`, `backend/src/routes/whatsapp-chat.js`, `frontend/src/stores/store.js`, `frontend/src/components/WhatsAppChat.jsx` | `bot_paused` is stored per conversation and the webhook skips auto-replies while paused. |
| Dependency security | `backend/package.json`, `frontend/package.json` | `npm audit --audit-level=high` must pass in both workspaces. |

## Conventions and Rules
- Do not add public debug endpoints that expose tenant, message, token, webhook, or credential data.
- Razorpay webhook handlers must verify `x-razorpay-signature` against the tenant's stored `razorpay_webhook_secret` before updating payment state.
- Database lookups from webhook payloads must include `tenant_id` where a tenant can be derived.
- Browser settings responses must not return raw tokens or payment secrets. Use blank values plus `has_*` flags for secret fields.
- Browser auth state must be validated with `/api/v1/auth/me` before showing the dashboard, and token reads must use `narmada_broadcast_token` rather than the old generic `token` key.
- MongoDB must be configured through `MONGO_URI`; rotate/delete any database user whose URI was ever committed or shared.
- Do not store pause/handoff state only in localStorage; it must be server-side state if it changes webhook behavior.
- Use placeholders in docs and examples. Production-looking DB, JWT, webhook, Meta, or Razorpay secrets do not belong in the repo.
- Keep `ws` pinned through npm overrides until upstream Socket.io dependency ranges allow the patched version without an override.

## Known Gotchas
- `express.json()` captures `req.rawBody` through its `verify` hook; do not remove that hook or Razorpay signature verification will stop working.
- `mergeSecretSettings()` preserves stored Razorpay secrets when the frontend sends blank strings. Treat blank secret updates as "unchanged", not "clear this secret".
- The smart responder uses local embeddings with lexical fallback. Do not make FAQ/product saves depend on any external provider key.
- `rg` returns exit code 1 when a secret-pattern scan finds no matches; that is a pass for this use case.

## How It Is Tested
- `backend/test/regression.test.js` covers env-only Mongo, `/auth/me` session validation, Smart Automation route contracts, Knowledge Base contracts, lexical fallback, absence of external provider key requirements, Razorpay signature validation, removal of public debug/unmounted mailer routes, labeled campaign schema support, realtime event key compatibility, persisted bot pause contracts, settings secret masking, deployment-doc placeholders, and frontend mobile regressions.
- Run `npm audit --audit-level=high` from both `frontend/` and `backend/`.
- Run a targeted secret scan from the repo root for project-specific production-looking examples. Keep exact guard patterns in tests or local scripts so documentation does not contain the literal banned tokens:

```powershell
rg -n "<project-specific-secret-patterns>" backend frontend knowledge-base README.md Dockerfile
```

## Links To Related KB Files
- `testing.md` for the full verification checklist.
- `DEPLOYMENT.md` for production environment placeholders and setup.
- `known-issues.md` for resolved security findings and regression-test pointers.
- `decisions.md` for the local transformer runtime and test framework decisions.
