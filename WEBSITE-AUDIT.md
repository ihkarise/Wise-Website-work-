# Wise Homeopathy — Website Audit & Master Improvement Plan

**Scope:** Phases 1–3 (Understanding → Audit → Roadmap). No site files have been modified.
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
| Online Consultation | `online-consultation/index.html` (1061 lines) | "Simple" header system | ❌ No |
| Conditions | `conditions/index.html` (205 lines) | Simple system | ❌ No |
| Contact / Book | `contact.html` (213 lines) | Simple system | ❌ No |
| Gallery | `gallery.html` (141 lines) | Third, lighter system | ❌ No |
| Thanks | `thanks.html` (7 lines) | Standalone card | n/a |

**Two page generations coexist.** Home/Team/Blog share one design system (sticky header with hamburger menu, world-map hero, reveal animations). Consultation/Conditions/Contact/Gallery share a simpler header whose nav links simply *disappear* below 820px with no hamburger replacement.

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

### C2. No mobile navigation on 4 pages
On Online Consultation, Conditions, Contact, and Gallery, the nav links are hidden below 820px with no hamburger menu. A phone visitor landing on the Conditions page (a likely SEO entry point) can only reach the logo and, on some pages, "Book Now." This is a dead end on the device most patients use.

### C3. The blog booking form is a non-functional demo
`blog/index.html` has a full "Request a consultation" form whose JS calls `preventDefault()` and shows a fake **"Thank you — your request has been noted"** message. **No data is sent anywhere.** A patient who fills this in believes the clinic will call back. This silently loses real consultation requests and, if discovered, damages trust severely. It must be wired to Netlify Forms (like `contact.html`) or replaced with a link to the working booking page.

### C4. Homepage navigation is broken/duplicated
`index.html:323` renders: *Online Consultation · Conditions (page) · Book Now · **Conditions (anchor, duplicate)** · How It Works · Why Wise · Stories · Blog*. Two "Conditions" items, no Home/Team links, and the mobile menu contains only same-page anchors + Blog — from the homepage's mobile menu you cannot reach Online Consultation, Conditions, Team, or Contact at all. `team.html:297` has the same duplicated pattern.

### C5. Inconsistent navigation model across the site
Every page has a different menu: Home shows anchors, Contact shows 7 items including Gallery, Conditions omits Gallery, Online Consultation's "Book Now" goes to WhatsApp while everywhere else it goes to `contact.html`, Home's "Book Consultation" goes to `#book` (a homepage section) instead of the booking page. Patients get a different mental map on every page.

---

## Per-page audit

### 1. Homepage — `index.html`
**Primary question: "Why choose Wise?" — largely answered well.**

**Strengths:** Premium hero with the world-map heat signature (a genuine brand asset); the "Direct answer" AEO card is smart for AI search; conditions grid, journey timeline, comparison table, and testimonials are a strong trust ladder; excellent reduced-motion handling; skip link; count-up stats respect `prefers-reduced-motion`.

**Weaknesses:** Nav duplication (C4); condition cards all link to `#book` instead of `/conditions/#anchor` — the visitor asking "can you help my condition?" is pushed to book before being educated; blog teaser cards all link to `/blog/` generically with a fake ▶ play affordance; footer "Conditions" links go to homepage anchors, not the conditions page; no favicon link; no og:image; the comparison-table intro sentence ("The question above is one patients ask AI tools…") is written for search engines, not humans; testimonials contain precise clinical claims (see Trust note below).

| Section | Verdict |
|---|---|
| Hero + world map + AEO card | 🟢 KEEP |
| Header nav | 🔴 REMOVE duplicate link / 🟡 IMPROVE to unified nav |
| Geo marquee | 🟢 KEEP |
| Conditions grid | 🟡 IMPROVE — link each card to `/conditions/#anchor` |
| Journey timeline | 🟢 KEEP |
| Compare table | 🟡 IMPROVE — rewrite intro copy for humans |
| Testimonials | 🟡 IMPROVE — soften unverifiable clinical specifics |
| Blog teasers | 🟡 IMPROVE — link to real posts once they exist; drop fake play button |
| Final CTA | 🟢 KEEP |
| Footer | 🟡 IMPROVE — link to real pages, unify domain |
| Favicon/og:image | 🔵 ADD |

### 2. Conditions — `conditions/index.html`
**Primary question: "Can you help my condition?" — good page, under-leveraged.**

**Strengths:** Clean TOC chips with anchor targets; honest, complementary-care wording ("alongside your specialist's management") is exactly right for healthcare trust; per-condition CTAs; `scroll-padding-top` handled.

**Weaknesses:** No mobile menu (C2); condition set differs from homepage (homepage lists Lupus/RA, Food Allergies, Asthma — this page doesn't; this page has Dermographism — homepage doesn't); no JSON-LD (each condition is a natural `MedicalCondition`/`MedicalWebPage` schema candidate and this is the page AI engines should quote); no links to related blog articles; each entry is a single paragraph — a "symptoms we commonly see" line would improve scannability and long-tail SEO.

| Section | Verdict |
|---|---|
| Hero + TOC chips | 🟢 KEEP |
| Condition entries | 🟡 IMPROVE — align list with homepage, add schema, interlink to blog |
| Mobile nav | 🔵 ADD |
| Final CTA | 🟢 KEEP |

### 3. Online Consultation — `online-consultation/index.html`
**Primary question: "How does this work?" — strongest page on the site.**

**Strengths:** Full FAQPage JSON-LD; complete section flow (hero → conditions → how it works → where we serve → what's included → doctor → FAQ → CTA); good internal links into `/conditions/#anchors`; og:image declared.

**Weaknesses:** No mobile menu (C2); "Book Now" CTA goes straight to WhatsApp, inconsistent with the rest of the site (fine as a secondary CTA, confusing as the primary); og:image points at a file that doesn't exist; at 1061 lines the page carries leftover template commentary in comments (harmless but noisy).

| Section | Verdict |
|---|---|
| All content sections | 🟢 KEEP |
| FAQ + schema | 🟢 KEEP |
| Mobile nav | 🔵 ADD |
| CTA consistency | 🟡 IMPROVE |

### 4. Team — `team.html`
**Primary question: "Can I trust this clinic?" — good structure, held back by shared defects.**

**Strengths:** Employee JSON-LD with credentials incl. TCMC registration number (excellent trust/E-E-A-T signal); profile-modal pattern; honest "Coming soon" roles signal a growing clinic.

**Weaknesses:** Same duplicated nav as homepage (C4); canonical on `.in` (C1); all photos missing — a trust page without a single human face is the weakest possible version of itself; relative links (`index.html#book`) instead of root-relative like other pages; two "Coming soon" placeholder cards may read as padding if they stay for months.

| Section | Verdict |
|---|---|
| Hero + stats | 🟢 KEEP |
| Team grid + modals | 🟡 IMPROVE — photos are the single highest-impact trust addition |
| "Coming soon" cards | 🟡 IMPROVE — keep short-term, remove if roles don't fill |
| Nav | 🔴 REMOVE duplicate / 🟡 unify |

### 5. Blog hub — `blog/index.html`
**Primary question: should be "What can I learn?" — currently trying to be two pages.**

**Strengths:** Blog + FAQPage JSON-LD; featured-article layout; working Netlify newsletter form with honeypot; FAQ accordion.

**Weaknesses:** Fake booking form (C3); title is "Blog **& Contact**" and the page duplicates the contact role — competing with `contact.html` and diluting both; canonical points to non-existent `/blog.html` on the wrong domain (C1); article cards link to `#contact` or `/blog/` — **there are no actual blog posts yet**, so cards advertise articles that can't be read; nav omits Conditions/Team pages.

| Section | Verdict |
|---|---|
| Featured + article grid | 🟡 IMPROVE — publish the 3 written articles as real posts, or mark as "coming soon" |
| FAQ accordion | 🟢 KEEP |
| Booking form | 🔴 REMOVE (replace with CTA to `/contact.html`) or wire to Netlify Forms |
| Newsletter | 🟢 KEEP |
| Title/meta "Blog & Contact" | 🟡 IMPROVE — retitle as Blog only |

### 6. Contact / Book — `contact.html`
**Primary question: "How do I book?" — best-converting page, minor fixes only.**

**Strengths:** Real working Netlify form with honeypot; WhatsApp + email + map + hours in one column; sensible fields; privacy note under submit.

**Weaknesses:** No mobile menu (C2); form redirects to `thanks.html` which says **"You're subscribed ✓ — weekly root-cause insights are on their way"** — the wrong message for someone requesting a medical consultation (see thanks.html); no LocalBusiness/MedicalClinic JSON-LD on the one page where NAP data is most complete; no link back to Online Consultation for patients unsure about the process.

| Section | Verdict |
|---|---|
| Form | 🟢 KEEP (fix redirect target) |
| Direct contact / hours / map | 🟢 KEEP |
| Mobile nav | 🔵 ADD |
| JSON-LD | 🔵 ADD |

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

| Item | Verdict |
|---|---|
| Newsletter copy for booking submissions | 🔴 REMOVE — split or neutralise |
| Separate booking confirmation page | 🔵 ADD |

### 9. Infrastructure & publishing
- **`sitemap.xml`**: missing `team.html`. 🟡
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

| # | Improvement | Files | Why it matters |
|---|---|---|---|
| 1 | **Unify canonical domain** (pick `.com` or `.in`) across canonicals, og:url, JSON-LD, footers, sitemap; fix blog canonical to `/blog/`; home canonical to `/` | index, team, blog/index, sitemap | Split canonicals actively sabotage all SEO effort; one page canonicalises to a 404 |
| 2 | **Wire or remove the fake blog booking form** | blog/index | Real patient requests are currently silently discarded — direct revenue and trust loss |
| 3 | **Add mobile menu to the 4 simple-header pages** (reuse the existing hamburger pattern from index) | online-consultation, conditions, contact, gallery | Majority of health-seekers browse on phones; these pages are navigation dead ends |
| 4 | **Fix homepage/team nav**: remove duplicate "Conditions", add Home/Team/Contact, make mobile menu include real pages | index, team | First impression currently shows a visibly broken menu |
| 5 | **Fix thanks-page mismatch**: neutral copy or a dedicated booking-confirmation page | thanks.html (+1 new) | The moment after booking is the highest-anxiety moment in the funnel |

## 🟠 High — the conversion & trust layer

| # | Improvement | Files | Why it matters |
|---|---|---|---|
| 6 | **One navigation model everywhere**: Home · Online Consultation · Conditions · Team · Blog · [Book Now CTA] (Gallery in footer until it has photos). Book Now → `/contact.html` on all pages | all pages | Patients think in one map; consistent nav = less confusion, more bookings |
| 7 | **Homepage condition cards → `/conditions/#anchor`** instead of `#book`; align the condition lists between the two pages | index, conditions | Educate → trust → book, in that order; also builds internal-link relevance |
| 8 | **Publish the 3 blog articles** (content already summarised in schema) using the post template; point homepage/blog cards at them; add to sitemap | blog/* , index, sitemap | Cards advertising unreadable articles break trust; content is the SEO engine |
| 9 | **Add favicon links + og:image to Home/Team/Blog**; add team.html to sitemap | index, team, blog/index, sitemap | Basic SEO hygiene; social shares currently render blank |
| 10 | **Soften clinical claims in testimonials** + inline "results vary" note | index | Healthcare compliance and credibility with the educated-patient audience |
| 11 | **Asset drop**: logo.svg, favicon, team photos (biggest single trust upgrade), OG images. Until gallery photos exist, remove Gallery from nav | assets/, nav on all pages | Faces build trust faster than any copy; an empty gallery destroys it |

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

## Suggested implementation order (Phase 4, upon approval)

1. **Batch 1 (Critical, ~1 session):** items 1–5. Pure fixes, zero design change.
2. **Batch 2 (Navigation & funnel):** items 6, 7, 9 — unified nav/footer applied to all 8 pages in one pass so the site never ships inconsistent.
3. **Batch 3 (Content & trust):** items 8, 10, 13, 14 — blog posts live, claims softened, interlinking.
4. **Batch 4 (Schema & a11y):** items 12, 16.
5. **Batch 5 (Hygiene):** items 15, 17–19, plus asset integration (11) whenever the clinic supplies files.

Each batch is independently shippable and reviewable.
