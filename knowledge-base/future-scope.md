# Future Scope — Platform Improvements

> Last Updated: 2026-06-16
> Status: Documented for future implementation

This document captures all planned improvements identified during a full platform audit from an SMB WhatsApp commerce perspective.

---

## Phase 1: Orders Overhaul ✅ COMPLETED (2026-06-16)

| Feature | Status | Description |
|---------|--------|-------------|
| Search | ✅ Done | Search by order #, phone, name, address |
| Filter: Payment Status | ✅ Done | All / Paid / Pending / Failed |
| Filter: Fulfillment Status | ✅ Done | All / Pending / Processing / Shipped / Delivered / Cancelled |
| Filter: Date Range | ✅ Done | Today / 7 Days / 30 Days / Custom date pickers |
| Sort | ✅ Done | By Date, Amount, Payment Status, Fulfillment Status (asc/desc) |
| Pagination | ✅ Done | Page-based with 25/50/100 selector + first/prev/next/last |
| Revenue Summary Cards | ✅ Done | Total Revenue, Total Orders, Orders Today, Pending Payments, Avg Order Value |
| Export CSV | ✅ Done | Exports currently filtered orders as CSV |
| Bulk Actions | ✅ Done | Checkbox select + bulk payment/fulfillment status update |
| Order Notes | ✅ Done | Editable internal notes in order detail modal |

---

## Phase 2: Chat Inbox Polish (PARTIALLY DONE)

| Feature | Status | Description |
|---------|--------|-------------|
| Conversation Filters | ✅ Done | Tabs: All / Unread / Paid Orders (existed prior) |
| Quick Replies | ✅ Done | Type `/` to trigger popup with canned responses. Manage via ⚡ modal. |
| AI Pause Toggle | ✅ Done | Per-conversation bot pause/resume button in chat header |
| Load Older Messages | ✅ Done | Cursor-based pagination with "↑ Load Older Messages" button |
| Conversation Tags/Labels | ✅ Done | 6 color-coded labels (VIP, Follow Up, Complaint, New Order, Pending Payment, Resolved) |
| Assign to Team Member | Planned | Route conversations to specific employees |
| Internal Notes | Planned | Team-only notes on conversations |

---

## Phase 3: Catalogue & Contacts (PARTIALLY DONE)

### Catalogue
| Feature | Status | Description |
|---------|--------|-------------|
| Search | ✅ Done | Client-side search by name, SKU, description |
| Sort | ✅ Done | By Name (A-Z/Z-A), Price (Low/High), Newest |
| Category Filter | ✅ Done | Dropdown filter by product category |
| Pagination | Planned | Backend-side pagination (currently loads all at once) |
| Stock/Inventory Count | Planned | Actual inventory numbers + low-stock alerts |
| Bulk Actions | Planned | Select multiple → delete, hide, update |
| Product Variants | Planned | Sizes, colors, etc. |

### Contacts
| Feature | Status | Description |
|---------|--------|-------------|
| Tag Filter | ✅ Done | Dropdown filter by tag (wires existing `/tags/list` endpoint) |
| Location Filter | ✅ Done | Dropdown filter by location (wires existing `/locations/list` endpoint) |
| Sortable Columns | ✅ Done | Sort by Name, Location, Ticket Size (asc/desc) |
| Pagination UI | ✅ Done | Page-based with 25/50/100 per page selector |
| Export CSV | ✅ Done | Download filtered contacts as CSV |
| Bulk Delete | ✅ Done | Checkbox selection + delete selected |
| Quick Chat Button | ✅ Done | WhatsApp icon on each contact row |
| Contact Activity Timeline | Planned | Unified view of orders, chats, campaigns per contact |
| Duplicate Detection | Planned | Warn on importing duplicate phone numbers |

---

## Phase 4: Broadcast & Knowledge Base

### Broadcast
| Feature | Status | Description |
|---------|--------|-------------|
| Campaign Scheduling | Planned | Schedule broadcasts for future date/time |
| Campaign Analytics | Planned | Delivery rate, read rate charts |
| Template Preview | Planned | Visual preview of template before sending |
| A/B Testing | Planned | Test two templates against segments |

### Knowledge Base
| Feature | Status | Description |
|---------|--------|-------------|
| Test Bot | ✅ Done | "🧪 Test Your Bot" panel — type customer message, see matched answer + confidence scores |
| FAQ Categories | Planned | Group FAQs by topic |
| Bulk Import (CSV) | Planned | CSV import for FAQs |
| Usage Analytics | Planned | Track which FAQs are matched most often |

---

## Phase 5: Platform-Level Enhancements

| Feature | Status | Description |
|---------|--------|-------------|
| Generative AI (LLM) | Planned | Feed FAQ match + chat history into LLM for human-like responses |
| Secret Encryption | Planned | AES-256-GCM for Razorpay keys stored in DB |
| Human-Agent Handoff | Planned | Graceful AI → human transition in live chat |
