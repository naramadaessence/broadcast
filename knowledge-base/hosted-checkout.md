# Hosted Checkout

## What This Subsystem Does

Hosted Checkout lets a customer open a public checkout session for a catalogue
product, submit delivery details, and receive a Razorpay payment link when
Razorpay is configured. Chat Inbox reads the same Mongo `Order` state to filter
and tag conversations by paid orders, unpaid payment-link orders, and abandoned
carts.

## How It Is Structured

| Path | Responsibility |
|------|----------------|
| `backend/src/routes/checkout.js` | Public checkout session create/read/place routes. |
| `backend/src/models/Order.js` | Checkout/order state, payment status, payment link IDs, fulfilment status, checkout token, and order items. |
| `backend/src/models/Product.js` | Product catalogue data used to price and populate checkout items. |
| `backend/src/routes/whatsapp-chat.js` | Reads `Order` rows by phone to compute Chat Inbox commerce filters and chips. |
| `frontend/src/styles/main.css` | Public checkout page styles plus Chat Inbox commerce chip styles. |

## Conventions And Rules

- Hosted checkout sessions create `Order` documents with
  `source_channel: 'hosted_checkout'`, `checkout_status: 'open'`, and
  `payment_status: 'pending'`.
- Placing an order changes `checkout_status` to `ordered` and tries to create a
  Razorpay payment link when `razorpay_key_id` and `razorpay_key_secret` exist
  in settings.
- Chat Inbox treats `payment_status: 'paid'` as the paid-order filter.
- Chat Inbox treats hosted-checkout `ordered` + pending-payment orders with a
  non-empty `payment_link` as `unpaid_orders`.
- Chat Inbox treats hosted-checkout `open` + pending-payment sessions with no
  payment link, a future `checkout_expires_at`, and `created_at` older than
  `CHECKOUT_ABANDONED_AFTER_MINUTES` as `abandoned_carts`.
- `CHECKOUT_ABANDONED_AFTER_MINUTES` defaults to 30, has a minimum of 5, and is
  capped at 1440 minutes.
- `Order.tenant_id` defaults to `single-tenant`. Chat Inbox keeps compatibility
  for older order documents that may not have this field.

## Known Gotchas

- Checkout routes are public because customers reach them from product links.
  Do not add admin-only middleware to `/api/v1/checkout/*`.
- The checkout route still uses single-client assumptions; do not turn this
  into a SaaS tenant flow unless the client requirement changes.
- Razorpay payment-link creation is best-effort during order placement. A
  placed order can exist without a payment link if Razorpay settings are
  missing or the provider call fails.
- Chat Inbox commerce filters match orders to conversations by exact phone
  string. If phone normalization changes in checkout, update the filters at the
  same time.

## How It Is Tested

- `backend/test/regression.test.js` covers the Chat Inbox commerce-filter
  contract, including Mongo order predicates, filter counts, frontend dropdown
  state, and paid/unpaid/abandoned chips.
- `npm run build` from `frontend/` verifies the public checkout page and Chat
  Inbox UI still compile.

> Not yet covered: live Mongo integration tests for checkout session placement
> and Razorpay payment-link creation. Avoid relying on live Razorpay calls in
> automated tests without a deterministic fake.

## Related KB Files

- `chat-inbox.md` for how checkout order states appear in the support desk.
- `frontend.md` for UI conventions and browser QA rules.
- `security.md` for secret handling and webhook-signature rules.
- `testing.md` for verification commands.
