# Wise Homeopathy — Website Audit & Master Improvement Plan

**Scope:** Phases 1–4 (Understanding → Audit → Roadmap → Implementation, in progress). This is a living document — findings are marked as resolved as batches ship. See [Phase 4 — Implementation Log](#phase-4--implementation-log) at the end for current status. See also `CHANGELOG.md` for a chronological record of shipped changes.
**Method:** Every page, config file, and workflow file in the repository was reviewed. Refinement, not replacement — the existing design language, branding, and architecture are preserved throughout this plan.

---

# Phase 1 — Project Understanding

## Architecture

| Layer | Implementation |
|---|---|
| Hosting | Netlify, static publish from repo root (`netlify.toml`) |
| Pages | 8 public pages, pure static HTML |
| CSS | **Fully inline per page** — no shared stylesheet. Design tokens (`--color-brand`, `--font-display`, etc.) are duplicated in each page's `<style>` block |
| JS | Small inline scripts per page (reveal-on-scroll, marquee, counters, accordion, lightbox, mobile menu) |
| Forms | Netlify Forms on `contact.html` (consultation) and `blog/index.html` (newsletter) |
| Fonts | Google Fonts: Poppins (body) + Fraunces (display), `display=swap` |
| CMS | Decap CMS in `/admin/` (configured but not functional — see audit) |
| SEO | Per-page meta, JSON-LD (MedicalClinic, Blog, FAQPage), sitemap.xml, robots.txt, canonical domain redirect in `_redirects` |

## Page inventory

| Page | File | Design system | Mobile menu? |
|---|---|---|---|
| Home | `index.html` (598 lines) | "Rich" system: world-map hero, marquee, journey timeline | ✅ Yes |
| Team | `team.html` (654 lines) | Same rich system as Home | ✅ Yes |
| Blog hub | `blog/index.html` (461 lines) | Same rich system | ✅ Yes |
| Online Consultation | `online-consultation/index.html` (1061 lines) | "Simple" header system | ✅ Yes *(Batch 1)* |
| Conditions | `conditions/index.html` (205 lines) | Simple system | ✅ Yes *(Batch 1)* |
| Contact / Book | `contact.html` (213 lines) | Simple system | ✅ Yes *(Batch 1)* |
| Gallery | `gallery.html` (141 lines) | Third, lighter system | ✅ Yes *(Batch 1)* |
| Thanks | `thanks.html` (7 lines) | Standalone card | n/a |
| Booking confirmation | `booking-received.html` (new, Batch 1) | Standalone card | n/a |

**Two page generations coexist.** Home/Team/Blog share one design system (sticky header with hamburger menu, world-map hero, reveal animations). Consultation/Conditions/Contact/Gallery share a simpler header. ~~whose nav links simply *disappear* below 820px with no hamburger replacement~~ — **Resolved in Batch 1**: all four simple-header pages now have the same hamburger mobile-menu pattern as the rich pages, reusing the existing CSS/JS approach rather than introducing a new one. The two visual "generations" still coexist (that's an intentional, unchanged design decision), but every page now has working navigation on every screen size.

## Assets

`assets/` contains only `PUT-YOUR-FILES-HERE.txt`. **Every image referenced on the site is missing**: `logo.svg`, `favicon.ico`, 4 team photos, 6 gallery photos, blog/OG images. Fallbacks are wired everywhere (logo → "W" brand mark, team photos → initials, gallery tiles → "Add photo" placeholders), so nothing breaks — but the Gallery page is currently six empty placeholder tiles in production.

---

# Phase 2 — Website Audit

## 🚨 Cross-site critical findings (affect every page)

### C1. Split canonical domain — the single biggest SEO problem
The site declares **two different domains as canonical** on different pages:

| Page | Canonical |
|---|---|
| `index.html` | `https://wisehomeopathy.in/index.html` |
| `team.html` | `https://wisehomeopathy.in/team.html` |
| `blog/index.html` | `https://wisehomeopathy.in/blog.html` ← also the **wrong path** (page lives at `/blog/`) |
| `contact.html`, `conditions/`, `gallery.html`, `online-consultation/` | `https://www.wisehomeopathy.com/...` |
| `_redirects`, `robots.txt`, `sitemap.xml` | `www.wisehomeopathy.com` |

Search engines are being told half the site lives on `.in` and half on `.com`. This splits ranking signals, and the blog canonical points at a URL that doesn't exist. Footers also disagree (`wisehomeopathy.in` on Home/Team vs `wisehomeopathy.com` elsewhere). **One domain must be chosen and applied everywhere** (canonicals, og:url, JSON-LD `url`, footer text, sitemap).

Also: `index.html` canonical should be `/` (not `/index.html`) to match the sitemap entry.

> **Status: ✅ Resolved in Batch 1** (commit `d748df0`). `www.wisehomeopathy.com` chosen as the single canonical (it already matched `_redirects`, `robots.txt`, `sitemap.xml`, and 5 of 8 pages). Applied to canonical tags, og:url, JSON-LD `url`, and footer text on Home, Team, and Blog. Blog canonical fixed to `/blog/`; Home canonical fixed to `/`.

### C2. No mobile navigation on 4 pages
On Online Consultation, Conditions, Contact, and Gallery, the nav links are hidden below 820px with no hamburger menu. A phone visitor landing on the Conditions page (a likely SEO entry point) can only reach the logo and, on some pages, "Book Now." This is a dead end on the device most patients use.

> **Status: ✅ Resolved in Batch 1.** All four pages now have the same hamburger/slide-down mobile menu pattern used on Home/Team/Blog. Verified with Playwright at a 390px viewport: menu opens, shows all 7 nav links, and closes on every page, with zero new JS errors.

### C3. The blog booking form is a non-functional demo
`blog/index.html` has a full "Request a consultation" form whose JS calls `preventDefault()` and shows a fake **"Thank you — your request has been noted"** message. **No data is sent anywhere.** A patient who fills this in believes the clinic will call back. This silently loses real consultation requests and, if discovered, damages trust severely. It must be wired to Netlify Forms (like `contact.html`) or replaced with a link to the working booking page.

> **Status: ✅ Resolved in Batch 1.** Form now submits to Netlify Forms (`name="blog-consultation"`, honeypot field, `action="/booking-received.html"`), matching the working `contact.html` pattern. The fake `preventDefault()` handler was removed entirely.

### C4. Homepage navigation is broken/duplicated
`index.html:323` renders: *Online Consultation · Conditions (page) · Book Now · **Conditions (anchor, duplicate)** · How It Works · Why Wise · Stories · Blog*. Two "Conditions" items, no Home/Team links, and the mobile menu contains only same-page anchors + Blog — from the homepage's mobile menu you cannot reach Online Consultation, Conditions, Team, or Contact at all. `team.html:297` has the same duplicated pattern.

> **Status: ✅ Resolved in Batch 1.** Duplicate removed; Home and Team desktop + mobile nav now read Home · Online Consultation · Conditions · Team · Blog · Gallery, matching the rest of the site.

### C5. Inconsistent navigation model across the site
Every page has a different menu: Home shows anchors, Contact shows 7 items including Gallery, Conditions omits Gallery, Online Consultation's "Book Now" goes to WhatsApp while everywhere else it goes to `contact.html`, Home's "Book Consultation" goes to `#book` (a homepage section) instead of the booking page. Patients get a different mental map on every page.

> **Status: ✅ Resolved as part of Batch 1.** This was filed separately from C4 for prioritization, but fixing C4 correctly required unifying the model rather than just deduplicating one link, so both landed together. All 7 pages now share one nav set (Home · Online Consultation · Conditions · Team · Blog · Gallery) with a consistent "Book Now" → `/contact.html` CTA, including Online Consultation's, which previously went straight to WhatsApp. This also completes **Roadmap item 6** (High priority, originally scoped for Batch 2) as a side effect — see the Phase 4 log.

---

## Per-page audit

### 1. Homepage — `index.html`
**Primary question: "Why choose Wise?" — largely answered well.**

**Strengths:** Premium hero with the world-map heat signature (a genuine brand asset); the "Direct answer" AEO card is smart for AI search; conditions grid, journey timeline, comparison table, and testimonials are a strong trust ladder; excellent reduced-motion handling; skip link; count-up stats respect `prefers-reduced-motion`.

**Weaknesses:** ~~Nav duplication (C4)~~ **fixed in Batch 1**; condition cards all link to `#book` instead of `/conditions/#anchor` — the visitor asking "can you help my condition?" is pushed to book before being educated (still open — Roadmap item 7); blog teaser cards all link to `/blog/` generically with a fake ▶ play affordance (still open — Roadmap item 8); ~~footer "Conditions" links go to homepage anchors, not the conditions page~~ **fixed in Batch 1**, now link to `/conditions/#anchor`; ~~no favicon link~~ **fixed in Batch 1**; no og:image (still open); the comparison-table intro sentence ("The question above is one patients ask AI tools…") is written for search engines, not humans (still open); testimonials contain precise clinical claims (see Trust note below, still open — Roadmap item 10).

| Section | Verdict |
|---|---|
| Hero + world map + AEO card | 🟢 KEEP |
| Header nav | ✅ Fixed (Batch 1) — duplicate removed, unified nav applied |
| Geo marquee | 🟢 KEEP |
| Conditions grid | 🟡 IMPROVE — link each card to `/conditions/#anchor` |
| Journey timeline | 🟢 KEEP |
| Compare table | 🟡 IMPROVE — rewrite intro copy for humans |
| Testimonials | 🟡 IMPROVE — soften unverifiable clinical specifics |
| Blog teasers | 🟡 IMPROVE — link to real posts once they exist; drop fake play button |
| Final CTA | 🟢 KEEP |
| Footer | ✅ Fixed (Batch 1) — domain unified, condition links point to `/conditions/#anchor` |
| Favicon | ✅ Added (Batch 1) |
| og:image | 🔵 ADD — still open |

### 2. Conditions — `conditions/index.html`
**Primary question: "Can you help my condition?" — good page, under-leveraged.**

**Strengths:** Clean TOC chips with anchor targets; honest, complementary-care wording ("alongside your specialist's management") is exactly right for healthcare trust; per-condition CTAs; `scroll-padding-top` handled.

**Weaknesses:** ~~No mobile menu (C2)~~ **fixed in Batch 1**; condition set differs from homepage (homepage lists Lupus/RA, Food Allergies, Asthma — this page doesn't; this page has Dermographism — homepage doesn't); no JSON-LD (each condition is a natural `MedicalCondition`/`MedicalWebPage` schema candidate and this is the page AI engines should quote); no links to related blog articles; each entry is a single paragraph — a "symptoms we commonly see" line would improve scannability and long-tail SEO.

| Section | Verdict |
|---|---|
| Hero + TOC chips | 🟢 KEEP |
| Condition entries | 🟡 IMPROVE — align list with homepage, add schema, interlink to blog |
| Mobile nav | ✅ Added (Batch 1) |
| Final CTA | 🟢 KEEP |

### 3. Online Consultation — `online-consultation/index.html`
**Primary question: "How does this work?" — strongest page on the site.**

**Strengths:** Full FAQPage JSON-LD; complete section flow (hero → conditions → how it works → where we serve → what's included → doctor → FAQ → CTA); good internal links into `/conditions/#anchors`; og:image declared.

**Weaknesses:** ~~No mobile menu (C2)~~ **fixed in Batch 1**; ~~"Book Now" CTA goes straight to WhatsApp, inconsistent with the rest of the site~~ **fixed in Batch 1**, now goes to `/contact.html` like every other page; og:image points at a file that doesn't exist (still open); at 1061 lines the page carries leftover template commentary in comments (harmless but noisy, still open).

| Section | Verdict |
|---|---|
| All content sections | 🟢 KEEP |
| FAQ + schema | 🟢 KEEP |
| Mobile nav | ✅ Added (Batch 1) |
| CTA consistency | ✅ Fixed (Batch 1) — Book Now → `/contact.html` |

### 4. Team — `team.html`
**Primary question: "Can I trust this clinic?" — good structure, held back by shared defects.**

**Strengths:** Employee JSON-LD with credentials incl. TCMC registration number (excellent trust/E-E-A-T signal); profile-modal pattern; honest "Coming soon" roles signal a growing clinic.

**Weaknesses:** ~~Same duplicated nav as homepage (C4)~~ **fixed in Batch 1**; ~~canonical on `.in` (C1)~~ **fixed in Batch 1**; all photos missing — a trust page without a single human face is the weakest possible version of itself (still open — Roadmap item 11); ~~relative links (`index.html#book`) instead of root-relative like other pages~~ **fixed in Batch 1** — all internal links (including the profile-modal "Book a consultation" link generated by JS) are now root-relative; two "Coming soon" placeholder cards may read as padding if they stay for months (still open).

| Section | Verdict |
|---|---|
| Hero + stats | 🟢 KEEP |
| Team grid + modals | 🟡 IMPROVE — photos are the single highest-impact trust addition |
| "Coming soon" cards | 🟡 IMPROVE — keep short-term, remove if roles don't fill |
| Nav | ✅ Fixed (Batch 1) — duplicate removed, unified, root-relative |

### 5. Blog hub — `blog/index.html`
**Primary question: should be "What can I learn?" — currently trying to be two pages.**

**Strengths:** Blog + FAQPage JSON-LD; featured-article layout; working Netlify newsletter form with honeypot; FAQ accordion.

**Weaknesses:** ~~Fake booking form (C3)~~ **fixed in Batch 1**; title is "Blog **& Contact**" and the page duplicates the contact role — competing with `contact.html` and diluting both (still open — Roadmap item 13); ~~canonical points to non-existent `/blog.html` on the wrong domain (C1)~~ **fixed in Batch 1**, now `https://www.wisehomeopathy.com/blog/`; article cards link to `#contact` or `/blog/` — **there are no actual blog posts yet**, so cards advertise articles that can't be read (still open — Roadmap item 8); ~~nav omits Conditions/Team pages~~ **fixed in Batch 1**.

| Section | Verdict |
|---|---|
| Featured + article grid | 🟡 IMPROVE — publish the 3 written articles as real posts, or mark as "coming soon" |
| FAQ accordion | 🟢 KEEP |
| Booking form | ✅ Fixed (Batch 1) — now a real Netlify Forms submission |
| Newsletter | 🟢 KEEP |
| Title/meta "Blog & Contact" | 🟡 IMPROVE — retitle as Blog only (still open) |
| Nav | ✅ Fixed (Batch 1) — now includes Conditions/Team/Gallery |

### 6. Contact / Book — `contact.html`
**Primary question: "How do I book?" — best-converting page, minor fixes only.**

**Strengths:** Real working Netlify form with honeypot; WhatsApp + email + map + hours in one column; sensible fields; privacy note under submit.

**Weaknesses:** ~~No mobile menu (C2)~~ **fixed in Batch 1**; ~~form redirects to `thanks.html` which says "You're subscribed ✓ — weekly root-cause insights are on their way" — the wrong message for someone requesting a medical consultation~~ **fixed in Batch 1**, now redirects to the new `booking-received.html`; no LocalBusiness/MedicalClinic JSON-LD on the one page where NAP data is most complete (still open); no link back to Online Consultation for patients unsure about the process (still open).

| Section | Verdict |
|---|---|
| Form | ✅ Fixed (Batch 1) — redirects to `booking-received.html` |
| Direct contact / hours / map | 🟢 KEEP |
| Mobile nav | ✅ Added (Batch 1) |
| JSON-LD | 🔵 ADD — still open |

### 7. Gallery — `gallery.html`
**Currently six "Add photo" placeholders in production.**

An empty gallery actively harms trust ("is this clinic real?"). Until photos exist, the page should either be unlinked from navigation or the placeholder tiles hidden. Lightbox also lacks focus management (no focus trap, close button not focused on open). Third divergent header/nav style.

| Section | Verdict |
|---|---|
| Page concept + lightbox | 🟢 KEEP (once photos exist) |
| Empty placeholder tiles in prod | 🔴 REMOVE from nav until photos are added |
| Lightbox a11y | 🟡 IMPROVE |

### 8. Thanks — `thanks.html`
Serves as the success page for **both** the newsletter and the consultation form, but its copy is newsletter-only. A booking patient sees "You're subscribed" — confusing at the most emotionally important moment of the funnel (did my request go through?). Needs either a second `booking-received.html` or neutral copy covering both. Has `noindex` ✅.

> **Status: ✅ Resolved in Batch 1.** Created `booking-received.html` (also `noindex`) with copy appropriate for a consultation request (WhatsApp + home links instead of a newsletter "back to blog" link). `thanks.html` is untouched and now serves only the newsletter form on `blog/index.html`. Both consultation forms (`contact.html`, `blog/index.html`) now target `/booking-received.html`.

| Item | Verdict |
|---|---|
| Newsletter copy for booking submissions | ✅ Fixed (Batch 1) — booking forms no longer use this page |
| Separate booking confirmation page | ✅ Added (Batch 1) — `booking-received.html` |

### 9. Infrastructure & publishing
- **`sitemap.xml`**: ~~missing `team.html`~~ — correction: `team.html` was already present when checked during Batch 1 implementation. This line in the original audit was inaccurate; no sitemap change was needed. 🟢
- **`admin/` (Decap CMS)**: config writes markdown to a `blog-posts/` folder that doesn't exist and nothing renders — publishing via the CMS produces invisible posts. Either remove `/admin/` for now or note it as non-functional; the folder-copy workflow in PUBLISHING-GUIDE is the real path. 🟡
- **`netlify.toml` / `_redirects` / `robots.txt`**: solid. 🟢
- **Blog post template**: good SEO scaffolding with clear CHANGE-ME markers. 🟢

## Cross-cutting themes

**Trust (healthcare-specific):** Testimonials cite exact lab values ("anti-TPO 890 → 210") and medication cessation. For a medical site these are high-risk claims — unverifiable, potentially non-compliant with Indian medical advertising norms, and they invite skepticism from the exact educated-patient audience this site targets. Soften to experience-focused language and add a visible "individual results vary" note near the testimonials (the footer disclaimer exists but is far away). The "5000+ patients / 40+ countries" claims should be numbers the clinic can stand behind.

**Accessibility:** Skip links only on Home/Team/Blog; decorative emoji icons not `aria-hidden`; gallery lightbox lacks focus trap; simple-header pages lose all nav on mobile (C2). Contrast and focus-visible handling are otherwise good.

**Performance:** Already strong (static, preconnected fonts, lazy images, cache headers). The ~40 KB inline world-map SVG is duplicated in three pages — acceptable, but extracting it (or the shared CSS) is a low-priority win. No render-blocking scripts. 🟢 overall.

**My Health Journey readiness (Phase 2 future):** No changes needed now. The unified navigation + consistent booking funnel recommended below is exactly the structure a future patient-portal link slots into (one more nav item, one more post-consultation touchpoint). Nothing in this plan blocks it.

---

# Phase 3 — Master Improvement Plan

Ordered by impact. Each item lists why it matters. **No implementation until approved.**

## 🔴 Critical — fix before anything else

| # | Improvement | Files | Why it matters | Status |
|---|---|---|---|---|
| 1 | **Unify canonical domain** (pick `.com` or `.in`) across canonicals, og:url, JSON-LD, footers, sitemap; fix blog canonical to `/blog/`; home canonical to `/` | index, team, blog/index, sitemap | Split canonicals actively sabotage all SEO effort; one page canonicalises to a 404 | ✅ **Done — Batch 1** |
| 2 | **Wire or remove the fake blog booking form** | blog/index | Real patient requests are currently silently discarded — direct revenue and trust loss | ✅ **Done — Batch 1** |
| 3 | **Add mobile menu to the 4 simple-header pages** (reuse the existing hamburger pattern from index) | online-consultation, conditions, contact, gallery | Majority of health-seekers browse on phones; these pages are navigation dead ends | ✅ **Done — Batch 1** |
| 4 | **Fix homepage/team nav**: remove duplicate "Conditions", add Home/Team/Contact, make mobile menu include real pages | index, team | First impression currently shows a visibly broken menu | ✅ **Done — Batch 1** |
| 5 | **Fix thanks-page mismatch**: neutral copy or a dedicated booking-confirmation page | thanks.html (+1 new) | The moment after booking is the highest-anxiety moment in the funnel | ✅ **Done — Batch 1** |

## 🟠 High — the conversion & trust layer

| # | Improvement | Files | Why it matters | Status |
|---|---|---|---|---|
| 6 | **One navigation model everywhere**: Home · Online Consultation · Conditions · Team · Blog · [Book Now CTA] (Gallery in footer until it has photos). Book Now → `/contact.html` on all pages | all pages | Patients think in one map; consistent nav = less confusion, more bookings | ✅ **Done — Batch 1** (shipped as a side effect of items 3–4; Gallery kept in the primary nav rather than demoted to footer-only — see note below) |
| 7 | **Homepage condition cards → `/conditions/#anchor`** instead of `#book`; align the condition lists between the two pages | index, conditions | Educate → trust → book, in that order; also builds internal-link relevance | ⬜ Open |
| 8 | **Publish the 3 blog articles** (content already summarised in schema) using the post template; point homepage/blog cards at them; add to sitemap | blog/* , index, sitemap | Cards advertising unreadable articles break trust; content is the SEO engine | ⬜ Open |
| 9 | **Add favicon links + og:image to Home/Team/Blog**; add team.html to sitemap | index, team, blog/index, sitemap | Basic SEO hygiene; social shares currently render blank | 🟡 **Partially done — Batch 1** added favicon links to Home/Team/Blog. og:image still missing on Home/Team. team.html was already in sitemap (original finding was inaccurate). |
| 10 | **Soften clinical claims in testimonials** + inline "results vary" note | index | Healthcare compliance and credibility with the educated-patient audience | ⬜ Open |
| 11 | **Asset drop**: logo.svg, favicon, team photos (biggest single trust upgrade), OG images. Until gallery photos exist, remove Gallery from nav | assets/, nav on all pages | Faces build trust faster than any copy; an empty gallery destroys it | ⬜ Open — note: Batch 1 kept Gallery in the primary nav on all pages (for cross-site consistency) rather than removing it; the "hide Gallery until photos exist" call in this item is a content/business decision still awaiting owner input, not implemented |

## 🟡 Medium — SEO depth & polish

| # | Improvement | Why it matters |
|---|---|---|
| 12 | JSON-LD on Conditions (`MedicalWebPage`/`MedicalCondition` per section) and Contact (`MedicalClinic` with `openingHours`) | These are the pages AI search engines and Google's local pack should quote |
| 13 | Retitle blog hub to Blog-only; replace its contact section with a compact CTA banner → `/contact.html` | One page, one question; stops cannibalising the contact page |
| 14 | Interlink conditions ↔ blog posts ↔ online-consultation ("Read how we approach Hashimoto's →") | No dead ends; every page guides to the next step |
| 15 | Decide on `/admin/` CMS: remove, or restructure so CMS output actually renders | A publishing path that silently produces invisible posts will burn the owner's time |
| 16 | Breadcrumb JSON-LD on inner pages; `aria-hidden` on decorative emoji; skip links on all pages; lightbox focus trap | Accessibility + rich-result eligibility |

## 🟢 Low — architecture hygiene (no visual change)

| # | Improvement | Why it matters |
|---|---|---|
| 17 | Extract shared design tokens + header/footer CSS into one `assets/site.css` (keep page-specific CSS inline) | Ends the drift that created two design generations; every future nav fix becomes one-file |
| 18 | Extract the world-map SVG to a shared include or reduce duplication | ~40 KB × 3 pages of identical markup |
| 19 | Standardise root-relative URLs everywhere (team.html still uses relative links) | Prevents subtle breakage if pages move into folders |

## What NOT to change

- The visual design system, colour tokens, typography, world-map hero, journey timeline, comparison table — these are premium and on-brand. 🟢
- The static-HTML + Netlify architecture. It is fast, free, secure, and right for this clinic.
- `netlify.toml`, `_redirects`, `robots.txt`, the post template, the contact form structure.
- No frameworks, no build step, no new infrastructure.

## Suggested implementation order (Phase 4)

1. **Batch 1 (Critical, ~1 session):** items 1–5, plus item 6 and part of item 9 as a side effect. ✅ **Shipped** — see [Phase 4 — Implementation Log](#phase-4--implementation-log).
2. **Batch 2 (Conversion & remaining trust items):** items 7, 9 (og:image), 10 — condition cards route to `/conditions/` before booking, social preview images, softened testimonial claims.
3. **Batch 3 (Content & trust):** items 8, 13, 14 — blog posts live, blog hub retitled, interlinking.
4. **Batch 4 (Schema & a11y):** items 12, 16.
5. **Batch 5 (Hygiene):** items 15, 17–19, plus asset integration (11 — logo, favicon, team/gallery photos) whenever the clinic supplies files.

Each batch is independently shippable and reviewable.

---

# Phase 4 — Implementation Log

Chronological record of what shipped, batch by batch. Full detail of each change lives in `CHANGELOG.md`; this section tracks which roadmap items are closed.

## Batch 1 — Critical fixes ✅ Shipped

**Commit:** `d748df0` on branch `claude/wise-homeopathy-audit-61ukcb`
**Roadmap items closed:** 1, 2, 3, 4, 5, 6 (early), 9 (partial)
**Files changed:** `index.html`, `team.html`, `blog/index.html`, `contact.html`, `conditions/index.html`, `gallery.html`, `online-consultation/index.html`, `booking-received.html` (new)

**Summary:** Domain canonicalization, dead mobile navigation, and a booking form that silently discarded submissions were the three highest-risk defects on the site — all fixed with no visual/design changes. Fixing the homepage's broken duplicate nav (item 4) required unifying the nav model across all 7 pages to do correctly, which also closed item 6 (originally scoped for a later batch) as a byproduct. Adding favicon links while touching each page's `<head>` also partially closed item 9.

**Verification performed:** Local static server + Playwright at a 390px mobile viewport, driving the hamburger menu open/closed on all 7 pages and confirming all 7 nav links are present with zero new JS errors. Grep sweep confirmed zero remaining `wisehomeopathy.in` references, correct form `action` targets, and exactly one `menuBtn`/`mmenu` pair per page.

**Deferred / explicitly not done in this batch** (left for later batches per scope):
- Condition-card routing on the homepage (`#book` → `/conditions/#anchor`) — item 7
- og:image on Home/Team, blog article publishing — items 8, 9
- Testimonial claim softening — item 10
- Removing Gallery from nav until photos exist — item 11 (business decision, not made unilaterally)
- Blog hub retitle/CTA-banner replacement — item 13

**Correction to the original audit:** The Phase 2 finding that `sitemap.xml` was missing `team.html` was inaccurate — it was already present. No sitemap change was made or needed.
