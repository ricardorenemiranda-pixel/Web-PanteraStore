---
version: 1
slug: "app"
primary_target: "app"
related_targets: []
---

## Scope

Global visual redesign — applies to the entire PanteraStore frontend (public site, auth, catalog, item detail, sell flow, admin). Mode: Persuade for the home/landing surface; Operate for catalog, item detail, sell flow, and the admin panel.

## Direction contract

**THESIS:** The site reads like an Apple product page: light, quiet, spacious, letting one clear action and one clean number (the price) carry each screen — refusing the earlier "Casa de Cambio" LED-board identity, which the user explicitly asked to replace wholesale, not blend with.

**OWN-WORLD:** Near-white ground (`#FBFBFD`), white surfaces (`#FFFFFF`) on a very light gray section tint (`#F5F5F7`), near-black text (`#1D1D1F`), warm neutral gray for secondary text (`#6E6E73`). One brand accent — a deep red (`#C6392A`) used sparingly for CTAs and links, white text on it. A single type family (Manrope) for both display and body — hierarchy comes from weight/size, not a display/body pairing — with JetBrains Mono reserved for tabular figures only (price columns, reference codes). Valve's 8 rarity colors remain the only other color on the page, used strictly on item art/edges. No custom cursor, no glow effects, no dark bezel panels — cards are plain white with large radii (1.25rem) and reveal depth only via a soft, large-blur shadow on hover, never a border doing the work.

**STORY:** A visitor lands on a mostly-empty, generously spaced hero with one big headline and one action. Scrolling reveals sections one at a time with a single fade-up-on-scroll moment (not scattered effects). Prices and market data stay legible via tabular numerals, without any "trading terminal" costume.

**FIRST VIEWPORT:** Centered hero, no panel/box: a large headline (~64px desktop), one-line subhead, one primary pill CTA plus one text-style secondary action, both centered, with heavy vertical whitespace above and below (py-28 to py-40). No image, no card — the whitespace itself is the opening statement.

**FORM:** Direct client-pinned direction ("estilo Apple"), confirmed via follow-up questions: full replacement (not a blend with the prior direction), emphasizing whitespace, single-family clean typography, light background, and scroll-triggered reveal animations. This pin overrides the earlier "Casa de Cambio" contract and the concept-seed roll entirely — a brief-pinned direction always beats the roll.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Signature interaction

One IntersectionObserver-driven fade-up reveal (`components/Reveal.tsx` + `.reveal-on-scroll` in globals.css), applied once per section, never per element. Starts visible in markup (no FOUC / no permanently-hidden content without JS). Respects `prefers-reduced-motion`.

## Unresolved decisions

- Whether the admin panel and sell/inventory flow should also drop their remaining `border-black/*` dark-theme-era overlay patterns in favor of fully bespoke light-mode styling, or continue relying on the token remap (current approach: token remap + spot-fixes, not a full rebuild of every admin screen).
- Whether the intro splash (full-screen animated wordmark on every navigation) still fits an Apple-style site, which normally has no such interstitial — kept for now since the user didn't flag it as something to remove.
