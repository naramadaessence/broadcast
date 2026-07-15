# Project Overview

## What Is This?

A **multi-tenant SaaS platform** that lets businesses send WhatsApp broadcast messages and manage two-way WhatsApp conversations. Each tenant (customer) connects their own Meta WhatsApp Business API credentials. Meta bills them directly for message usage — we charge a platform subscription fee.

## Business Model

```
┌─────────────────────────────────────────────────────┐
│                  Revenue Model                       │
├─────────────────────────────────────────────────────┤
│ Customer pays US → Platform subscription (SaaS fee) │
│ Customer pays META → Per-message usage (direct)     │
│ We NEVER touch message billing — Meta handles it    │
└─────────────────────────────────────────────────────┘
```

- **Multi-tenant**: Each customer gets their own isolated data via `tenant_id`
- **Self-service credentials**: Customers enter their own Meta API token, phone_number_id, and WABA ID in Settings
- **No Razorpay/payment gateway needed**: Billing is manual or future integration

## Core Features (5 Views)

### 1. Contacts
- Unified contact list (no leads/clients separation)
- Each contact has: name, phone, email, **location**, **ticket_size**, tags, notes, source
- Location and ticket_size are used as broadcast filters
- Supports CSV import, tag management, search

### 2. WhatsApp Broadcast
- Send Meta-approved template messages to filtered contacts
- Filter recipients by: tags, location, ticket_size range
- 2-step flow: Select recipients → Choose template & send
- Template management: create, list, delete (submitted to Meta for approval)
- Campaign history with delivery tracking (sent/delivered/read/failed)

### 3. Chat Inbox
- Two-way WhatsApp messaging
- Split-panel UI: conversation list (left) + message thread (right)
- **24-hour window rule**: Free-form text replies only within 24h of customer's last message
- After window expires: must use approved templates to re-engage
- Auto-creates conversations when customers reply to broadcasts
- Incoming messages matched to contacts by phone number
- Polls every 8 seconds for new messages

### 4. Product Catalogue
- Manage products available for WhatsApp sharing
- Tracks MRP, selling price, category, and SKU
- Stores product image URLs

### 5. Settings
- Firm profile (name, email, phone, logo, brand color)
- WhatsApp credentials (access token, phone_number_id, WABA ID) — verified with Meta API on save
- Subscription plan display

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | Preact + Vite (JSX, no TypeScript) |
| **State** | Zustand |
| **Backend** | Express.js (Node.js 20+) |
| **Database** | MySQL 8.0 |
| **Process Manager** | PM2 |
| **Reverse Proxy** | Nginx |
| **Hosting** | Hostinger VPS (Ubuntu) |
| **WhatsApp API** | Meta Cloud API v21.0 |
| **Auth** | JWT (bcryptjs for passwords) |

## Multi-Tenant Architecture

- **Single domain**: `broadcast.innodify.in` (no per-tenant subdomains)
- **Tenant resolution is soft**: if slug not found, continues with null (doesn't block)
- **JWT is the source of truth**: auth middleware sets `req.tenantId` from token when tenant middleware can't resolve
- **Login is cross-tenant**: searches by email across all tenants (not scoped to a slug)
- Frontend stores `tenant_slug` in localStorage after login/signup, sends via `x-tenant-slug` header
- All database queries filter by `tenant_id`
- WhatsApp credentials stored per-tenant in `tenant_settings` table
- Webhook identifies tenant by matching `phone_number_id` from incoming messages

## WhatsApp Webhook Flow

```
Meta sends webhook POST to /webhook/whatsapp
  → Verify signature (optional)
  → Extract phone_number_id from payload
  → Look up tenant by phone_number_id in tenant_settings
  → For message events:
    → Find or create conversation
    → Store message in whatsapp_chat_messages
    → Match contact by phone number
    → Update conversation metadata (last_message, unread_count, window_expires_at)
  → For status events:
    → Update message status (sent → delivered → read)
```

## Key Design Decisions

1. **No batch limits on broadcasts** — contacts are managed/stored, no duplicates possible
2. **Minimal delay between sends** — 100ms default, no artificial throttling
3. **No de-duplication** — unnecessary since contacts are curated
4. **24-hour window enforcement** — server-side check before allowing free-form text
5. **Template-only after window** — follows Meta's policy strictly
6. **Polling (not WebSocket)** — 8-second interval for chat, simpler to deploy
7. **Preact (not React)** — smaller bundle, same JSX API
