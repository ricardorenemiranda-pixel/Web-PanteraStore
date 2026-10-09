# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: a casual Dota 2 player in Peru who wants a specific skin (e.g. an Arcana they liked) or wants to sell one or two items from their inventory. They come in for a one-off transaction, not a recurring trading habit — they need to find the item, trust the price, and get to a human (WhatsApp) fast. They are not power-trader collectors optimizing spreads; dense market data (price history charts, deep filtering) is secondary to clarity and speed for this audience. A secondary, smaller audience of frequent collectors/traders exists but is not the design priority.

Operator: the store admin, who manually curates every catalog item, sets markup (global/per-rarity/per-item), manages orders, and is the only account that can reach the admin role (gated by Steam ID allowlist, not self-service).

## Product Purpose

A marketplace to buy and sell Dota 2 cosmetic items in Peru. Prices are calculated from the live Steam Community Market value plus a configurable markup, so buyers and sellers both see a number anchored to a real, checkable reference rather than an arbitrary asking price. The actual trade (payment, item transfer) is coordinated manually over WhatsApp after a buyer finds an item in the catalog — the site is the storefront and price authority, not an automated escrow/checkout system.

## Positioning

The functional mechanism (Steam-anchored pricing, manual curation, WhatsApp handoff) is comparable to what an organized informal seller could offer. The actual differentiator, per the person running this project, is presentation: PanteraStore's edge over Facebook groups and Discord sellers is reading as a real, professional storefront rather than a personal reseller profile. This makes the visual/interaction quality itself the product's competitive claim, not just polish on top of an equivalent product — a generic or "AI template" look directly undermines the thing PanteraStore is selling.

## Operating Context

- Login is Steam OAuth only; admin role depends on `ADMIN_STEAM_IDS` in the backend env, email/self-registration never grants it.
- Buyer flow: browse/filter catalog → item detail page (with a reference code) → contact via WhatsApp to close the deal.
- Seller flow: inventory page → select items to sell → summary → WhatsApp handoff.
- Admin flow: manual catalog CRUD, price/markup configuration (global, per-rarity, per-item), PDF catalog export, order management — all inside `/admin`.
- Currency is Peruvian Soles (S/); reference prices are shown against the Steam Market USD-equivalent value.

## Capabilities and Constraints

- Never use real Dota 2 assets (Valve-owned 3D models, textures, or original in-game icons) anywhere in the UI — legal/IP constraint, not a style preference.
- Custom confirmation dialogs only — never the browser's native `confirm()`.
- Image lazy-loading is already in place for performance; avoid adding heavy client-side libraries (WebGL, large animation/3D libs) without clear justification.
- The homepage trust stats ("+50k trades exitosos", "24/7 soporte en vivo", "100% seguro por Steam") are confirmed real figures/claims by the person running the business, not placeholder marketing copy — they should be preserved and can be presented with more specific/organic numbers, but are not fabricated claims to soften or remove.
- Dev servers run in the user's own terminals (backend :3001, frontend :3000); do not start them from here.

## Brand Commitments

- Name: PanteraStore (pantera = panther). No existing logo mark beyond a wordmark; no other binding visual assets.

## Evidence on Hand

- Live backend-driven catalog (item names, hero associations, rarities, prices) — not placeholder data; `lib/mock-data.ts` holds label/rarity/icon lookup tables used alongside real API data from `lib/catalogApi.ts`.
- Full 127-hero Dota 2 roster and the 8 official Valve rarity tiers are real domain vocabulary already encoded in the app (`lib/mock-data.ts`) — safe to lean on as content.
- No existing user research, testimonials, or case studies — none should be fabricated.

## Product Principles

1. Speed to a human: every buyer/seller path should get a casual, one-off user to the WhatsApp handoff with minimal friction — this is the actual conversion event, not an in-app checkout.
2. Trust through legibility, not decoration: since presentation *is* the differentiator, price logic (Steam reference vs. final price), item authenticity signals, and rarity/category information must read as clear and credible, not just decorated.
3. Casual-first, collector-second: default views and information density should serve a one-time visitor; deeper market data (price trends, filters) stays available but never dominates the primary path.
4. Preserve all existing functionality (admin tooling, filters, auth, PDF export) — this is a presentation-layer redesign, not a feature or logic change.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established beyond standard web accessibility practice (visible focus states, sufficient contrast, keyboard navigation).
