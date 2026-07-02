# Changelog

All notable changes to the Wise Homeopathy website are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Dates are in `YYYY-MM-DD`.

See `WEBSITE-AUDIT.md` for the full audit this work is based on, and its Phase 4 log for roadmap-item-level tracking.

## [Unreleased]

Nothing pending.

## 2026-07-02 — Batch 3: Legal & Compliance pages

New: `privacy.html`, `terms.html`, `disclaimer.html` — Privacy Policy, Terms of Use, and Medical Disclaimer, written specifically for Wise Homeopathy from verified facts already in this repository (no generic templates, no invented certifications, retention periods, or grievance officers). Each covers what's collected, why, how it's used, and clearly marks not-yet-built functionality (Patient Login, My Health Journey, WiseOS) as "Future Update Required" instead of describing it as live.

### Added
- A "Legal" footer section (Privacy Policy · Terms of Use · Medical Disclaimer) on all 7 pages that carry the full footer nav: `index.html`, `team.html`, `contact.html`, `conditions/index.html`, `online-consultation/index.html`, `blog/index.html`. `gallery.html`'s lighter single-line footer got a matching small link row instead of the full grid, consistent with its existing minimal style. `thanks.html`/`booking-received.html` intentionally left unchanged (transient, `noindex` confirmation cards with no footer nav).

### Fixed
- `online-consultation/index.html` had a pre-existing invalid-markup bug — a stray `</body></html>` before its mobile-menu `<script>` block. Browsers silently recovered from it, but it was invalid HTML sitting next to a line this batch was already editing; removed.
- `online-consultation/index.html`'s footer "Book Consultation" link pointed to WhatsApp instead of `/contact.html` — Batch 1's changelog claimed this was already unified sitewide but missed this one footer instance. Corrected.

### Notes
- No separate Cookie Policy page — the site has no tracking/analytics cookies and only two third-party embeds (Google Fonts, Google Maps), fully covered by a short section inside the Privacy Policy. See `WEBSITE-AUDIT.md` Batch 3 entry for the full rationale.
- Legal pages are intentionally not added to `sitemap.xml` (standard practice for this content type); `robots.txt`'s existing `Allow: /` already permits indexing if search engines discover them via the new footer links.

## 2026-07-02 — Product Architecture Review (docs only)

Added `docs/20-PRODUCT-ARCHITECTURE-REVIEW.md`: a strategic review of the long-term
product architecture (Visitor → Trust → Consultation → Patient → My Health Journey →
WiseOS), covering information architecture, product roadmap, patient journey mapping,
content strategy, WiseOS integration readiness, navigation strategy, and a 12-month
growth plan. No site files, pages, or code changed. Reaffirms Batch B (dedicated
condition pages) as the correct next implementation step and identifies the absence of
Privacy/Terms/Disclaimer pages as a newly-documented gap.

## 2026-07-02 — Batch 2: conversion routing, social previews, testimonial claims

Copy/link/meta-tag fixes only — no layout, design, or new assets. Full rationale in `WEBSITE-AUDIT.md` → Phase 4 → Batch 2.

### Fixed
- **Homepage condition cards no longer skip straight to booking.** All 10 cards on `index.html` previously linked to `#book`, pushing an undecided visitor to commit before being educated. The 7 cards with a matching section on `/conditions/` (MCAS, Hashimoto's, Chronic Urticaria, Eczema, Allergic Rhinitis, Eosinophilic Esophagitis, POTS) now link to that anchor. The 3 without a matching section (Food Allergies, Lupus/RA, Allergic Asthma) link to `/conditions/` instead — no new clinical write-ups were invented to fill those gaps; adding them (or removing the cards) is a content decision for the clinic.
- **Missing/broken social preview images on Home and Team.** Added `og:image` tags to `index.html` (`assets/images/home-og.jpg`) and `team.html` (`assets/images/team-og.jpg`). Both files are added to the asset checklists in `README.md` and `PUBLISHING-GUIDE.md`; they don't exist yet, same status as every other missing image (logo, doctor/gallery photos) — tracked as one item under the outstanding "asset drop" roadmap entry.
- **Testimonial clinical claims softened.** Homepage testimonials previously cited exact, unverifiable lab values ("anti-TPO 890 → 210") and absolute outcome language ("off antihistamines completely," "the urticaria is gone") — a credibility/compliance risk for a medical site. Reworded to experience-focused language without altering the underlying patient stories.

### Added
- A visible "Individual results vary — always continue working with your treating physician" note directly under the homepage testimonials grid, reinforcing the existing footer disclaimer at the point where the claims are actually read.

### Notes
- Deferred to later batches (see `WEBSITE-AUDIT.md` roadmap): full condition-list alignment (adding the 3 missing condition sections or removing their homepage cards), the actual `*-og.jpg` image files, blog hub's og:image/retitle.

## 2026-07-02 — Batch 1: critical fixes (canonical domain, mobile nav, booking form)

Functional and SEO fixes only — no visual or design changes. Full rationale in `WEBSITE-AUDIT.md` → Phase 4 → Batch 1.

### Fixed
- **Canonical domain split resolved.** Home, Team, and Blog previously declared `wisehomeopathy.in` as canonical while the rest of the site (and `_redirects`, `robots.txt`, `sitemap.xml`) used `www.wisehomeopathy.com`, splitting SEO ranking signals across two domains. All three pages now use `www.wisehomeopathy.com` — updated in `<link rel="canonical">`, `og:url`, and JSON-LD `url`. Blog's canonical path bug (pointed at nonexistent `/blog.html`) fixed to `/blog/`. Home canonical fixed to `/` to match the sitemap.
- **Blog "Request a consultation" form now submits.** `blog/index.html`'s booking form previously called `preventDefault()` and displayed a fake "your request has been noted" message while sending the data nowhere. It's now a real Netlify Forms submission (`name="blog-consultation"`, honeypot spam field, `action="/booking-received.html"`), matching the pattern already working on `contact.html`.
- **Mobile navigation added to 4 pages that had none.** `online-consultation/`, `conditions/`, `contact.html`, and `gallery.html` hid their nav links below 820px with no replacement, leaving phone visitors unable to navigate. All four now have the same hamburger + slide-down mobile menu already used on Home/Team/Blog.
- **Homepage and Team header nav fixed.** Removed a duplicated "Conditions" link on both pages; both had no way to reach Home, Team, or Contact from their mobile menu. Desktop and mobile nav on both pages now read: Home · Online Consultation · Conditions · Team · Blog · Gallery.
- **Booking-confirmation page split from newsletter confirmation.** `thanks.html`'s "You're subscribed ✓" copy was shown to patients after submitting a *consultation* request, not just newsletter signups. New `booking-received.html` (noindex, same visual style) now handles both consultation forms (`contact.html` and `blog/index.html`); `thanks.html` is unchanged and serves only the newsletter form.

### Changed
- Standardized every page's "Book Now" / "Book Consultation" CTA to point to `/contact.html` (Online Consultation's previously went straight to WhatsApp, inconsistent with the rest of the site).
- Footer "Conditions" links on Home and Team previously pointed at homepage anchors (`#conditions`); now link to the actual per-condition anchors on `/conditions/`.
- Root-relative internal links standardized where pages previously used page-relative paths (e.g., `team.html`'s JS-generated profile-modal "Book a consultation" link, several `index.html`/`team.html` internal hrefs).

### Added
- `booking-received.html` — confirmation page for consultation-request form submissions.
- `<link rel="icon">` favicon tag to Home, Team, and Blog (previously present on the other 5 pages only).

### Verification
- Local static server + Playwright (390px mobile viewport) driving the hamburger menu on all 7 pages: menu opens, exposes all 7 nav links, closes correctly, zero new JS errors introduced.
- Repo-wide grep confirmed zero remaining `wisehomeopathy.in` references, correct form `action` targets on all three Netlify forms, and exactly one `menuBtn`/`mmenu` id pair per page.

### Notes
- Corrected an inaccurate finding in the original audit: `sitemap.xml` already included `team.html`; no sitemap change was needed.
- Deferred to later batches (see `WEBSITE-AUDIT.md` roadmap): homepage condition-card routing, og:image tags, blog article publishing, testimonial claim softening, the Gallery-in-nav decision, and the blog hub retitle.

## 2026-07-02 — Full website audit and master improvement plan

- Added `WEBSITE-AUDIT.md`: Phase 1 (project understanding), Phase 2 (page-by-page audit with KEEP/IMPROVE/REMOVE/ADD verdicts and cross-site critical findings), and Phase 3 (prioritized Critical/High/Medium/Low improvement roadmap). No site files modified in this entry.
