# Option C UI/UX Overhaul Plan

## Phase 1: Regression Contracts
- Add static backend regression coverage for the mobile drawer class contract.
- Add static backend regression coverage for the Orders mobile-card surface.
- Add static backend regression coverage that ordinary tenant admins do not see a misleading platform admin nav item.

## Phase 2: App Shell and Design System
- Refresh global CSS tokens, font import, surfaces, cards, buttons, forms, tables, tabs, mobile header, sidebar, and chat polish.
- Fix the `.sidebar--open` mobile drawer selector.
- Add reusable mobile order-card CSS.

## Phase 3: Component Updates
- Update `Sidebar.jsx` so the drawer exposes a mobile close button and hides the platform admin item unless a future super-admin flag exists.
- Update `App.jsx` mobile menu accessibility and use Overview as the first login/reset view.
- Update `Orders.jsx` with mobile order cards that preserve selection, status, amount, customer, and view-details behavior.
- Update `Login.jsx` and landing CSS for the cleaner polished visual direction.

## Phase 4: Verification and QA
- Run targeted regression tests after implementation.
- Run backend tests, backend syntax check, frontend lint, frontend build, and npm audits.
- Run local browser QA against the live API as the provided store-owner user.
- Fix any QA issues found, rerun the affected checks, then commit and push.
