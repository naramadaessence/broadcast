# Option C UI/UX Overhaul Design

## Goal
Refresh the WhatsApp Broadcast SaaS into a cleaner merchant dashboard with a more polished visual system, smoother controls, stronger hierarchy, and reliable mobile usability across the authenticated app plus public landing/login flows.

## Visual Direction
- Use a crisp modern SaaS font stack based on Plus Jakarta Sans.
- Keep WhatsApp green as the primary action color, but balance it with neutral surfaces, slate text, blue informational accents, amber warnings, and red destructive states.
- Prefer flatter, calmer surfaces: light page background, white cards, subtle borders, soft shadows, and consistent 8-12px radii.
- Preserve the existing Preact/Zustand architecture and component names so the change remains frontend-focused and deploy-safe.

## UX Scope
- App shell: fix mobile drawer behavior, improve sidebar contrast, active states, unread badge, and mobile header affordance.
- Overview and shared surfaces: improve global spacing, table polish, form controls, buttons, cards, badges, modals, and tabs.
- Orders: replace the cramped mobile table experience with tappable order cards while keeping the desktop table.
- Admin nav: hide the platform Admin Panel from ordinary tenant admins because the backend route requires `superAdminOnly`.
- Auth and landing: replace dark/glowy styling with a cleaner professional product entry, smoother edges, and the same font system.

## QA Criteria
- Desktop store owner can log in, scan dashboard stats, navigate Contacts, Broadcast, Chat, Catalogue, Orders, Smart FAQs, and Settings.
- Mobile store owner can open the hamburger drawer, navigate from it, view chat list/detail, and inspect Orders without horizontal table clipping.
- Secret-bearing settings fields remain blank/masked after reload or account switching.
- Lint, build, backend regression tests, backend syntax, and high-level npm audits stay green.
