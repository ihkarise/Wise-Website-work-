# Changelog

All notable changes to the Wise Homeopathy website are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Dates are in `YYYY-MM-DD`.

See `WEBSITE-AUDIT.md` for the full audit this work is based on, and its Phase 4 log for roadmap-item-level tracking.

## [Unreleased]

Nothing pending.

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
