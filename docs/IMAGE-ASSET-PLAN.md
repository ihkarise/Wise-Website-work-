# Wise Homeopathy — Complete Production Image Asset Plan

**Version:** 1.0.0
**Domain:** https://www.wisehomeopathy.com
**Scope:** Every image, logo, icon, illustration, banner, thumbnail, favicon, social image, loading asset, placeholder and marketing graphic the live website requires.
**Brand tokens (from `assets/site.css`):** Brand `#27498C`, Brand-strong `#1B3463`, Brand-deep `#13264A`, Accent `#D62E4D`, Surface `#F4F7FB`, Ink `#0B0B0B`.
**Positioning goals:** Modern medical • fast • professional • mobile-first • SEO • WCAG 2.2 AA • future-proof.

---

## 0. Global Rules (apply to every asset unless overridden)

| Rule | Standard |
|---|---|
| Master editable source | `.svg` for logos/icons/illustrations; layered source kept **out of `/assets`** (in `/design-source`, git-ignored or design tool) |
| Delivery format priority | 1. **SVG** (any vector: logos, icons, line illustrations) → 2. **AVIF** (primary raster) → 3. **WebP** (fallback raster) → 4. **PNG** (only where transparency + no AVIF/WebP, e.g. some PWA/Apple assets) → 5. **JPG** (never preferred; legacy fallback only) |
| Responsive raster | Ship `<picture>` with AVIF + WebP sources and `srcset` at 1x/2x; art-directed mobile crop where noted |
| Retina | Provide `@2x` for any raster shown at a fixed CSS box < 640px wide (icons rendered as raster, doctor headshots, thumbnails). Vector = resolution-independent, no @2x needed |
| Colour profile | sRGB, 8-bit, stripped metadata (no EXIF/GPS — privacy + weight) |
| Compression | AVIF q≈50–55 / WebP q≈75–80 / MozJPEG q≈78 / SVGO for vectors / oxipng for PNG |
| Lazy loading | `loading="lazy"` + `decoding="async"` on everything **below the fold**. `fetchpriority="high"` + eager on the single LCP image per page |
| `width`/`height` | Always set intrinsic `width`+`height` (or `aspect-ratio` CSS) to reserve space → CLS = 0 |
| Alt text | Descriptive for content images; `alt=""` (empty, not missing) for purely decorative assets so screen readers skip them |
| Filenames | lowercase, kebab-case, no spaces, no version suffixes in repo (cache-bust via headers/hash, not filename) |
| Colour contrast | Any text baked onto an image must hold ≥ 4.5:1 (normal) / 3:1 (large) against its darkest overlap region; prefer live HTML text over baked text |

---

## 1. Folder Structure (final tree)

```
assets/
├── logos/
│   ├── logo.svg                     # master horizontal (primary)
│   ├── logo-white.svg
│   ├── logo-dark.svg
│   ├── logo-icon.svg                # mark only
│   ├── logo-email.png               # raster for email clients
│   └── logo-print.svg               # high-contrast mono for print/PDF
├── favicon/
│   ├── favicon.ico                  # multi-res 16/32/48
│   ├── favicon.svg                  # modern scalable
│   ├── favicon-96.png
│   ├── apple-touch-icon.png         # 180×180
│   └── mask-icon.svg                # Safari pinned tab (monochrome)
├── pwa/
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-192.png
│   ├── icon-maskable-512.png
│   ├── shortcut-book.png            # 96×96
│   ├── shortcut-conditions.png
│   ├── shortcut-portal.png
│   ├── splash/                      # iOS launch images (see §8)
│   └── offline-illustration.svg
├── hero/
│   ├── home-hero.avif  .webp
│   ├── home-hero-mobile.avif  .webp
│   ├── conditions-hero.avif  .webp
│   ├── team-hero.avif  .webp
│   ├── about-hero.avif  .webp
│   └── consultation-hero.avif  .webp
├── banners/
│   ├── cta-book.avif  .webp
│   ├── online-consultation.avif  .webp
│   └── newsletter.avif  .webp
├── team/
│   ├── doctor-libin-job.avif  .webp        (+ @2x)
│   ├── doctor-ansal.avif  .webp            (+ @2x)
│   ├── doctor-dhanya.avif  .webp           (+ @2x)
│   ├── doctor-merlin.avif  .webp           (+ @2x)
│   └── placeholder-doctor.svg
├── conditions/
│   ├── condition-mcas.avif  .webp
│   ├── condition-hashimotos-thyroiditis.avif  .webp
│   ├── condition-chronic-urticaria.avif  .webp
│   ├── condition-eczema.avif  .webp
│   ├── condition-allergic-rhinitis.avif  .webp
│   ├── condition-eosinophilic-esophagitis.avif  .webp
│   ├── condition-pots.avif  .webp
│   ├── condition-dermographism.avif  .webp
│   └── placeholder-condition.svg
├── clinic/
│   ├── clinic-reception.avif  .webp
│   ├── clinic-consult-room.avif  .webp
│   ├── clinic-exterior.avif  .webp
│   ├── clinic-pharmacy.avif  .webp
│   └── equipment-microscope.avif  .webp
├── gallery/
│   ├── clinic-photo-01.avif  .webp   … through clinic-photo-06 (+ thumbs)
│   └── thumbs/  (same names, small)
├── medical/
│   ├── illustration-immune-system.svg
│   ├── illustration-treatment-journey.svg
│   ├── illustration-mast-cell.svg
│   ├── infographic-consultation-steps.svg
│   ├── timeline-treatment.svg
│   ├── before-after-template.svg
│   └── medicine-remedy.avif  .webp
├── icons/
│   └── sprite.svg                   # single symbol sprite (all UI icons)
├── ui/
│   ├── empty-appointments.svg
│   ├── empty-timeline.svg
│   ├── empty-reports.svg
│   ├── empty-search.svg
│   ├── spinner.svg
│   ├── placeholder-blur.avif        # LQIP fallback
│   ├── pattern-dots.svg
│   ├── pattern-waves.svg
│   ├── divider-curve.svg
│   └── texture-soft.avif  .webp
├── blog/
│   ├── blog-featured-template.avif  .webp
│   ├── placeholder-blog.svg
│   └── posts/  (per-post images live here)
├── testimonials/
│   ├── testimonial-avatar-placeholder.svg
│   └── (patient avatars — anonymised)
├── social/
│   ├── og-default.jpg               # 1200×630
│   ├── og-home.jpg
│   ├── og-team.jpg
│   ├── og-conditions.jpg
│   ├── og-online-consultation.jpg
│   ├── og-blog-template.jpg
│   ├── twitter-card.jpg             # 1200×628 (summary_large_image)
│   ├── whatsapp-preview.jpg         # 400×400 safe square
│   ├── linkedin-banner.png          # 1128×191
│   ├── youtube-thumb-template.png   # 1280×720
│   ├── instagram-template.png       # 1080×1350
│   ├── facebook-template.png        # 1080×1080
│   └── gbp/  (Google Business Profile photos)
└── error/
    ├── 404-illustration.svg
    ├── coming-soon.svg
    └── thank-you.svg
```

---

## 2. Branding

### assets/logos/logo.svg
- **Purpose:** Primary horizontal logo (mark + wordmark), light backgrounds — header, footer.
- **Path:** `assets/logos/logo.svg` (⚠ site currently references `assets/logo.svg` — migrate or add redirect)
- **Format:** SVG (master) · **Width×Height:** 180×48 nominal · **AR:** 3.75:1 · **Max size:** 15 KB (SVGO) · **Retina:** n/a (vector) · **Alt:** `Wise Homeopathy` · **Lazy:** No (header) · **Priority:** Critical

### assets/logos/logo-white.svg
- **Purpose:** Reversed logo for dark/brand-colour backgrounds (footer on brand, overlays).
- **Format:** SVG · 180×48 · 3.75:1 · 15 KB · Alt `Wise Homeopathy` (decorative if paired label) · Lazy: No · **Priority:** High

### assets/logos/logo-dark.svg
- **Purpose:** All-ink mono version for pale/photo backgrounds where colour clashes.
- SVG · 180×48 · 3.75:1 · 12 KB · Alt `Wise Homeopathy` · Lazy: No · **High**

### assets/logos/logo-icon.svg
- **Purpose:** Mark only — tight header, app tiles, favicon source, watermark.
- SVG · 512×512 · 1:1 · 8 KB · Alt `Wise Homeopathy logo mark` · Lazy: No · **Critical**

### assets/logos/logo-email.png
- **Purpose:** Email clients strip SVG — raster logo for transactional/newsletter emails.
- PNG (transparent) · 360×96 (@2x of 180×48) · 3.75:1 · 20 KB · Retina: this IS @2x · Alt `Wise Homeopathy` · Lazy: n/a · **High**

### assets/logos/logo-print.svg
- **Purpose:** High-contrast mono for print stylesheet, PDFs, consultation-summary print.
- SVG · 180×48 · 3.75:1 · 10 KB · Alt `Wise Homeopathy` · **Medium**

### assets/favicon/favicon.ico
- **Purpose:** Legacy browser tab / bookmarks icon.
- ICO (16+32+48 multi-res) · 48×48 max · 1:1 · 15 KB · Alt n/a · **Critical**

### assets/favicon/favicon.svg
- **Purpose:** Modern scalable favicon (theme-aware capable).
- SVG · 32×32 viewBox · 1:1 · 5 KB · **Critical**

### assets/favicon/favicon-96.png
- PNG · 96×96 · 1:1 · 6 KB · **High**

### assets/favicon/apple-touch-icon.png
- **Purpose:** iOS home-screen icon (no transparency, safe padding).
- PNG · 180×180 · 1:1 · 20 KB · **Critical**

### assets/favicon/mask-icon.svg
- **Purpose:** Safari pinned-tab monochrome mask.
- SVG (single path, one colour) · 16×16 · 1:1 · 3 KB · `color=#27498C` in link tag · **Medium**

### PWA / Android / Manifest icons
| File | Purpose | Format | Size | Max KB | Priority |
|---|---|---|---|---|---|
| pwa/icon-192.png | Android home / manifest | PNG | 192×192 | 20 | High |
| pwa/icon-512.png | Splash / install | PNG | 512×512 | 45 | High |
| pwa/icon-maskable-192.png | Adaptive icon (safe zone 40%) | PNG | 192×192 | 20 | High |
| pwa/icon-maskable-512.png | Adaptive icon large | PNG | 512×512 | 45 | High |

---

## 3. Homepage (`index.html`)

### assets/hero/home-hero.avif (+ .webp)
- **Purpose:** Homepage hero — LCP image, warm clinical/human trust shot.
- **Dimensions (desktop):** 1920×1080 · **AR:** 16:9 · **Mobile:** `home-hero-mobile` 1080×1350 (4:5 portrait crop)
- **Max size:** desktop 180 KB (AVIF) / 240 KB (WebP); mobile 120 KB
- **Compression:** AVIF q52 · **Retina:** served via srcset 1x/2x · **Alt:** `Homeopathic doctor consulting with a patient at Wise Homeopathy clinic`
- **Lazy:** No — `fetchpriority="high"`, preload · **Priority:** Critical

### Feature cards (×3–4)
- **Purpose:** Icon per "how we work" feature card.
- Use **icons/sprite.svg** symbols (no separate files) · SVG · 48×48 render · Alt `""` (label beside) · Lazy: No · **High**

### Statistics section
- **Purpose:** Optional small icons beside stat counters (patients, years, conditions).
- sprite.svg symbols · 40×40 · Alt `""` · **Medium**

### Why-choose-us
- **Purpose:** Supporting illustration.
- `assets/medical/illustration-treatment-journey.svg` · SVG · ~640×480 render · 40 KB · Alt `Illustration of a patient's step-by-step homeopathic care journey` · Lazy: Yes · **Medium**

### Services / conditions preview grid
- Uses **conditions/condition-*.webp** (see §6) as card thumbnails · Lazy: Yes · **High**

### Doctor section (homepage)
- Uses **team/doctor-libin-job.webp** etc (see §5) · Lazy: Yes · **High**

### CTA band
- `assets/banners/cta-book.avif` · Background band · 1920×480 · 4:1 · 90 KB (AVIF) · Alt `""` (decorative, live text over) · Lazy: Yes (below fold) · **Medium**

### Testimonials
- `assets/testimonials/testimonial-avatar-placeholder.svg` + optional anonymised avatars · SVG or WebP 96×96 (+@2x) · 8 KB · Alt `Patient` (anonymised) · Lazy: Yes · **Medium**

### Gallery strip (homepage teaser)
- Pulls from **gallery/** (see §7) thumbs · Lazy: Yes · **Low**

### Footer
- **logo-white.svg** + optional payment/trust badges · **High**

---

## 4. Internal Pages

For each page: **hero** (or header banner) + **OG social image** (see §9). Reusable placeholders noted.

| Page | File | Hero file | Dim (desktop / mobile) | Max KB | Alt | Lazy | Priority |
|---|---|---|---|---|---|---|---|
| About | (add `about.html`) | hero/about-hero.avif | 1600×900 / 1080×1350 | 150 / 110 | `The Wise Homeopathy team and clinic` | LCP:No | High |
| Doctors/Team | team.html | hero/team-hero.avif | 1600×600 / 1080×1080 | 130 / 100 | `Our homeopathic doctors` | No | High |
| Conditions | conditions/index.html | hero/conditions-hero.avif | 1600×600 / 1080×1080 | 130 / 100 | `Chronic conditions we treat` | No | High |
| Research | (add) | reuse conditions-hero or medical illustration | — | — | `Homeopathy research` | Yes | Medium |
| Blog index | blog/index.html | blog/blog-featured-template (fallback) | 1200×630 | 120 | per-post | Yes | Medium |
| Contact | contact.html | map static image / clinic-exterior | 1200×600 / 1080×1080 | 120 | `Wise Homeopathy clinic location` | Yes | Medium |
| Appointment/Book | booking-received.html + book flow | banners/cta-book | 1600×500 | 100 | `""` | Yes | Medium |
| Online consultation | online-consultation/index.html | hero/consultation-hero.avif | 1600×900 / 1080×1350 | 150 / 110 | `Online homeopathy video consultation` | No | High |
| Privacy | privacy.html | — (no hero; text) | — | — | — | — | Low |
| Terms | terms.html | — | — | — | — | — | Low |
| Disclaimer | disclaimer.html | — | — | — | — | — | Low |
| 404 | (add `404.html`) | error/404-illustration.svg | 600×400 | 25 | `Page not found` | No | Medium |
| Coming Soon | (add) | error/coming-soon.svg | 600×400 | 25 | `Coming soon` | No | Low |
| Thank You | thanks.html | error/thank-you.svg | 600×400 | 25 | `Thank you` | No | Medium |
| Login / Verify | login.html, verify.html, doctor-login.html, doctor-verify.html | logo-icon.svg + illustration | — | — | brand mark | No | Medium |
| Gallery | gallery.html | gallery grid (see §7) | — | — | per-photo | Yes | Medium |
| Patient portal | my-health-journey/* | empty-state SVGs (§10) | — | — | per-state | — | Medium |

> **Missing page files flagged:** `about.html`, `404.html`, `coming-soon.html`, a research page — assets specced above are ready when those pages ship.

---

## 5. Doctors / Team (4 confirmed)

Confirmed staff from `team.html`: **Dr Libin Job, Dr Ansal, Dr Dhanya, Dr Merlin.**
Common spec: **Format** AVIF+WebP · **Display box** 400×500 (4:5 portrait) · **Ship** 800×1000 source + 400×500 @1x + 800×1000 @2x · **Max size** 90 KB (AVIF @1x) / 130 KB (WebP) · **Compression** AVIF q54 · **Retina** Yes (@2x) · **Lazy** Yes (eager only if above fold) · **Priority** High.

| File | Alt text |
|---|---|
| team/doctor-libin-job.avif | `Dr Libin Job, homeopathic physician at Wise Homeopathy` |
| team/doctor-ansal.avif | `Dr Ansal, homeopathic physician at Wise Homeopathy` |
| team/doctor-dhanya.avif | `Dr Dhanya, homeopathic physician at Wise Homeopathy` |
| team/doctor-merlin.avif | `Dr Merlin, homeopathic physician at Wise Homeopathy` |
| team/placeholder-doctor.svg | `Doctor photo coming soon` (SVG, neutral silhouette, 8 KB, Medium) |

> ⚠ Current markup references `.jpg` (`doctor-libin.jpg`, `doctor-ansal.jpg`, etc). Rename to full-name kebab + `<picture>` AVIF/WebP with JPG fallback during migration.

---

## 6. Conditions (8 canonical slugs)

From `shared/constants/condition-slugs.json`. Used as: condition card thumbnail (homepage + conditions index) AND condition-detail hero.
Common spec: **Format** AVIF+WebP · **Card thumb** 600×400 (3:2) · **Detail hero** 1200×675 (16:9) · ship both crops · **Max size** thumb 70 KB / hero 130 KB (AVIF) · **Compression** AVIF q52 · **Retina** via srcset · **Lazy** Yes (thumbs below fold; detail hero = page LCP, eager) · **Priority** High.

| File | Condition | Alt text |
|---|---|---|
| conditions/condition-mcas.avif | MCAS | `Illustration representing Mast Cell Activation Syndrome (MCAS)` |
| conditions/condition-hashimotos-thyroiditis.avif | Hashimoto's | `Illustration representing Hashimoto's thyroiditis` |
| conditions/condition-chronic-urticaria.avif | Chronic Urticaria | `Illustration representing chronic urticaria (hives)` |
| conditions/condition-eczema.avif | Eczema | `Illustration representing eczema` |
| conditions/condition-allergic-rhinitis.avif | Allergic Rhinitis | `Illustration representing allergic rhinitis` |
| conditions/condition-eosinophilic-esophagitis.avif | EoE | `Illustration representing eosinophilic esophagitis` |
| conditions/condition-pots.avif | POTS | `Illustration representing POTS (postural orthostatic tachycardia syndrome)` |
| conditions/condition-dermographism.avif | Dermographism | `Illustration representing dermographism` |
| conditions/placeholder-condition.svg | fallback | `Condition illustration` · SVG · 10 KB · Medium |

> **Recommendation:** Prefer branded **SVG line illustrations** over stock photos for conditions — resolution-independent, tiny, consistent, avoids clinical-photo licensing/consent issues. If photos used, they must be licensed + model-released.

---

## 7. Medical Content & Clinic

### Clinic photographs — `assets/clinic/`
Common: AVIF+WebP · 1600×1067 (3:2) · Max 160 KB (AVIF) · q54 · Lazy Yes · Medium.
| File | Purpose | Alt |
|---|---|---|
| clinic-reception.avif | Reception/waiting area | `Wise Homeopathy clinic reception` |
| clinic-consult-room.avif | Consultation room | `Consultation room at Wise Homeopathy` |
| clinic-exterior.avif | Building exterior / signage | `Exterior of Wise Homeopathy clinic` |
| clinic-pharmacy.avif | Remedy dispensary | `Homeopathic pharmacy at Wise Homeopathy` |
| equipment-microscope.avif | Equipment/diagnostics | `Diagnostic equipment at the clinic` |
| medical/medicine-remedy.avif | Remedy vials/globules | `Homeopathic remedy globules` |

### Gallery — `assets/gallery/` (6 confirmed slots)
Full: 1200×800 (3:2) · AVIF+WebP · Max 130 KB · Lazy Yes · Medium.
Thumb: `gallery/thumbs/` 400×267 · Max 35 KB · Lazy Yes.
| File | Alt |
|---|---|
| clinic-photo-01…06.avif | `Wise Homeopathy clinic — photo 1` … `photo 6` (replace with descriptive captions when shot list finalised) |

### Illustrations / Infographics — `assets/medical/` (SVG preferred)
| File | Purpose | Format | Render | Max KB | Alt | Priority |
|---|---|---|---|---|---|---|
| illustration-immune-system.svg | Disease/immune explainer | SVG | 800×600 | 45 | `Diagram of the immune system` | Medium |
| illustration-mast-cell.svg | MCAS mechanism | SVG | 800×600 | 40 | `Diagram of a mast cell releasing mediators` | Medium |
| illustration-treatment-journey.svg | Treatment path | SVG | 900×500 | 45 | `Step-by-step homeopathic treatment journey` | Medium |
| infographic-consultation-steps.svg | How consultation works | SVG | 1000×600 | 55 | `Four steps of a homeopathy consultation` | Medium |
| timeline-treatment.svg | Recovery timeline graphic | SVG | 1000×300 | 40 | `Treatment progress timeline` | Low |
| before-after-template.svg | Reusable before/after frame | SVG | 1000×500 | 30 | `Before and after comparison` | Low |

> Microscope/disease **photographs**: use only licensed medical stock; otherwise use the SVG illustrations above. No real patient imagery without written consent (privacy compliance).

---

## 8. PWA / Splash / Offline

### iOS splash screens — `assets/pwa/splash/`
PNG, brand `#F4F7FB` bg + centred `logo-icon`. One per major device class (art-directed via media queries). Max 60 KB each · Lazy n/a · Low.
| File | Size (px) | Device class |
|---|---|---|
| splash-1290x2796.png | 1290×2796 | iPhone 15/14 Pro Max |
| splash-1179x2556.png | 1179×2556 | iPhone 15/14 Pro |
| splash-1170x2532.png | 1170×2532 | iPhone 13/12 |
| splash-1284x2778.png | 1284×2778 | iPhone Pro Max older |
| splash-828x1792.png | 828×1792 | iPhone XR/11 |
| splash-1536x2048.png | 1536×2048 | iPad |
| splash-2048x2732.png | 2048×2732 | iPad Pro |

### Shortcut icons (manifest `shortcuts`)
PNG 96×96 · 8 KB each · Low.
| File | Shortcut |
|---|---|
| pwa/shortcut-book.png | Book appointment |
| pwa/shortcut-conditions.png | Conditions |
| pwa/shortcut-portal.png | My Health Journey |

### Offline page
`pwa/offline-illustration.svg` · SVG · 500×400 · 20 KB · Alt `You are offline` · Low.

---

## 9. Marketing / Social

Social images carry baked text → **must** hold ≥4.5:1 contrast; keep key content inside centre safe-zone (platforms crop edges).

| File | Purpose / Platform | Format | Dim | AR | Max KB | Alt (page meta) | Priority |
|---|---|---|---|---|---|---|---|
| social/og-default.jpg | Fallback Open Graph (FB/LinkedIn/WhatsApp) | JPG | 1200×630 | 1.91:1 | 200 | n/a (meta) | Critical |
| social/og-home.jpg | Home OG | JPG | 1200×630 | 1.91:1 | 200 | — | Critical |
| social/og-team.jpg | Team OG | JPG | 1200×630 | 1.91:1 | 200 | — | High |
| social/og-conditions.jpg | Conditions OG | JPG | 1200×630 | 1.91:1 | 200 | — | High |
| social/og-online-consultation.jpg | Online consult OG | JPG | 1200×630 | 1.91:1 | 200 | — | High |
| social/og-blog-template.jpg | Blog post OG base | JPG | 1200×630 | 1.91:1 | 200 | — | Medium |
| social/twitter-card.jpg | Twitter/X `summary_large_image` | JPG | 1200×628 | 1.91:1 | 200 | — | High |
| social/whatsapp-preview.jpg | WhatsApp square-safe | JPG | 400×400 | 1:1 | 60 | — | Medium |
| social/linkedin-banner.png | LinkedIn company banner | PNG | 1128×191 | 5.9:1 | 120 | — | Low |
| social/youtube-thumb-template.png | YouTube thumbnail base | PNG | 1280×720 | 16:9 | 250 | — | Low |
| social/instagram-template.png | IG portrait post base | PNG | 1080×1350 | 4:5 | 300 | — | Low |
| social/facebook-template.png | FB square post base | PNG | 1080×1080 | 1:1 | 300 | — | Low |
| banners/newsletter.avif | Email/newsletter header | AVIF+WebP+PNG | 600×200 | 3:1 | 40 | `Wise Homeopathy newsletter` | Medium |
| social/gbp/*.jpg | Google Business Profile (logo 720×720, cover 1080×608, ≥3 interior/team photos 1200×900) | JPG | see note | — | 300 | — | Medium |

> **Existing meta currently points at** `home-og.jpg`, `team-og.jpg`, `online-consultation-og.jpg`, and a `CHANGE-ME-image.jpg` in blog. Consolidate onto the `social/og-*.jpg` names above and update the `<meta property="og:image">` / `twitter:image` tags. Set absolute `https://www.wisehomeopathy.com/...` URLs (already the pattern) and add `og:image:width`/`height`.

---

## 10. UI Assets

### Icon system — `assets/icons/sprite.svg`
- **Purpose:** Single SVG symbol sprite for ALL UI icons (nav, feature, stats, buttons, social, arrows, close, menu, phone, mail, calendar, check, warning, upload, chevrons).
- SVG symbols, `currentColor` (theme-able) · each 24×24 viewBox · whole sprite ≤ 20 KB · Alt `""` (decorative) or `aria-label` on interactive · Lazy: inline/cached · **Priority:** Critical (nav icons).

### Empty states / illustrations — `assets/ui/`
SVG · ~400×300 render · ≤ 20 KB · Lazy Yes · Medium.
| File | Where | Alt |
|---|---|---|
| ui/empty-appointments.svg | portal — no appointments | `No appointments yet` |
| ui/empty-timeline.svg | my-health-journey/timeline | `No timeline entries yet` |
| ui/empty-reports.svg | reports/uploads | `No reports uploaded yet` |
| ui/empty-search.svg | no search results | `No results found` |

### Loading / skeleton / placeholder
| File | Purpose | Format | Notes | Priority |
|---|---|---|---|---|
| ui/spinner.svg | Loading spinner | SVG (CSS-animated) | 40×40, ≤4 KB, `role=status` `aria-label="Loading"` | High |
| (CSS `.skeleton`) | Skeleton screens | — | Already in `site.css` shimmer; no image asset needed | — |
| ui/placeholder-blur.avif | LQIP for hero/photos | AVIF | 32×18 tiny, ≤1 KB, inlined as data-URI where possible | Medium |
| conditions/placeholder-condition.svg, blog/placeholder-blog.svg, team/placeholder-doctor.svg | Content placeholders | SVG | brand-tinted, ≤10 KB | Medium |

### Decorative — `assets/ui/`
| File | Purpose | Format | Max KB | Alt | Priority |
|---|---|---|---|---|---|
| ui/pattern-dots.svg | Section bg pattern | SVG (tile) | 4 | `""` | Low |
| ui/pattern-waves.svg | Hero/footer wave bg | SVG | 6 | `""` | Low |
| ui/divider-curve.svg | Section divider | SVG | 3 | `""` | Low |
| ui/texture-soft.avif | Subtle photo texture bg | AVIF+WebP | 40 | `""` | Low |

> Badges, buttons, cards, shadows = **CSS only** (gradients, `box-shadow`, borders). No image assets — keeps weight down and stays crisp on retina. Trust/accreditation badges, if any, ship as SVG in `assets/ui/badges/`.

---

## 11. Blog

| File | Purpose | Format | Dim | Max KB | Alt | Lazy | Priority |
|---|---|---|---|---|---|---|---|
| blog/blog-featured-template.avif | Default featured image | AVIF+WebP | 1200×630 | 120 | post-specific | Yes | Medium |
| blog/placeholder-blog.svg | Missing-image fallback | SVG | 1200×630 | 12 | `Article image` | Yes | Medium |
| blog/posts/<slug>-featured.avif | Per-post featured (also OG) | AVIF+WebP+JPG(OG) | 1200×630 | 150 | descriptive per post | LCP on post page | High |
| blog/posts/<slug>-inline-*.avif | In-article images | AVIF+WebP | max-width 800 | 100 | descriptive | Yes | Medium |

> ⚠ `blog/post-template/index.html` references `assets/images/blog/CHANGE-ME-image.jpg`. Replace with per-post `blog/posts/<slug>-featured` and matching OG meta.

---

## 12. Accessibility Guidance

- **Alt text:** content images = describe purpose/meaning, not "image of"; decorative = `alt=""` (never omit the attribute). Doctor photos name the person + role. Icons that are the only content of a link/button get `aria-label`; icons beside visible text get `alt=""`/`aria-hidden`.
- **Contrast:** any baked-on text ≥ 4.5:1 (≥3:1 large ≥24px/19px-bold). Add a scrim/gradient overlay on hero photos so overlaid white text stays ≥4.5:1 across the whole crop.
- **Safe cropping:** keep faces & key subject within centre 80% (safe zone). Never crop through a face across breakpoints.
- **Mobile crop:** portrait 4:5 for heroes (`*-mobile`), art-directed via `<picture><source media>`.
- **Desktop crop:** 16:9 / 3:2 landscape.
- **Motion:** spinner and any animated SVG respect `prefers-reduced-motion` (already the CSS convention here).
- **Text alternatives for infographics:** every infographic/timeline SVG needs `<title>`+`<desc>` and a nearby text summary (screen-reader parity).

---

## 13. Performance Guidance

- **Format order:** SVG (vector) → AVIF → WebP → PNG (transparency-critical only) → JPG (last-resort/OG). OG images stay JPG for max scraper compatibility.
- **Responsive:** `<picture>` with AVIF+WebP sources; `srcset` widths `320,640,960,1280,1920` + `sizes` matching layout; `<img>` JPG/WebP fallback.
- **Example srcset intent (no code, spec only):** hero serves 1920/1280/960 desktop + 1080/720 mobile crop; doctor cards serve 400 + 800 (@2x); condition thumbs 600 + 300.
- **LCP:** exactly one eager+`fetchpriority="high"` image per page (that page's hero); preload it. Everything else `loading="lazy" decoding="async"`.
- **Weight budget per page:** total image payload ≤ 500 KB on mobile, ≤ 1 MB desktop (first view). Hero ≤ 180 KB AVIF.
- **Caching:** `/assets/*` already `max-age=604800`; move to `immutable` + content-hash filenames at build for long-cache without stale risk.
- **LQIP:** inline tiny blurred AVIF/`background` placeholder to kill layout jank on big photos.
- **No layout shift:** always intrinsic `width`/`height` or `aspect-ratio`.
- **Strip metadata**, sRGB, progressive where JPG used.

---

## 14. Naming Convention (production examples)

```
logo.svg  logo-white.svg  logo-icon.svg
favicon.svg  apple-touch-icon.png  mask-icon.svg
home-hero.avif  home-hero-mobile.avif
doctor-libin-job.avif  doctor-libin-job@2x.avif
condition-eczema.avif  condition-pots.avif
clinic-reception.avif  equipment-microscope.avif
clinic-photo-01.avif
og-home.jpg  twitter-card.jpg  linkedin-banner.png
empty-timeline.svg  spinner.svg  pattern-dots.svg
404-illustration.svg  blog-featured-template.avif
```
Rules: lowercase, kebab-case, category-prefixed where it aids grouping (`condition-`, `doctor-`, `og-`, `clinic-`), `@2x` suffix only for retina raster, `-mobile` suffix for art-directed crop. No spaces, no capitals, no version numbers.

---

## 15. Master Checklist (every asset)

**Branding**
- [ ] logos/logo.svg
- [ ] logos/logo-white.svg
- [ ] logos/logo-dark.svg
- [ ] logos/logo-icon.svg
- [ ] logos/logo-email.png
- [ ] logos/logo-print.svg
- [ ] favicon/favicon.ico
- [ ] favicon/favicon.svg
- [ ] favicon/favicon-96.png
- [ ] favicon/apple-touch-icon.png
- [ ] favicon/mask-icon.svg
- [ ] pwa/icon-192.png
- [ ] pwa/icon-512.png
- [ ] pwa/icon-maskable-192.png
- [ ] pwa/icon-maskable-512.png

**Homepage**
- [ ] hero/home-hero.avif + .webp
- [ ] hero/home-hero-mobile.avif + .webp
- [ ] banners/cta-book.avif + .webp
- [ ] medical/illustration-treatment-journey.svg
- [ ] icons/sprite.svg (feature/stats icons)
- [ ] testimonials/testimonial-avatar-placeholder.svg

**Internal page heroes**
- [ ] hero/about-hero.avif + .webp
- [ ] hero/team-hero.avif + .webp
- [ ] hero/conditions-hero.avif + .webp
- [ ] hero/consultation-hero.avif + .webp

**Doctors**
- [ ] team/doctor-libin-job.avif + .webp (+@2x)
- [ ] team/doctor-ansal.avif + .webp (+@2x)
- [ ] team/doctor-dhanya.avif + .webp (+@2x)
- [ ] team/doctor-merlin.avif + .webp (+@2x)
- [ ] team/placeholder-doctor.svg

**Conditions (×8)**
- [ ] condition-mcas
- [ ] condition-hashimotos-thyroiditis
- [ ] condition-chronic-urticaria
- [ ] condition-eczema
- [ ] condition-allergic-rhinitis
- [ ] condition-eosinophilic-esophagitis
- [ ] condition-pots
- [ ] condition-dermographism
- [ ] conditions/placeholder-condition.svg

**Clinic / medical**
- [ ] clinic/clinic-reception.avif
- [ ] clinic/clinic-consult-room.avif
- [ ] clinic/clinic-exterior.avif
- [ ] clinic/clinic-pharmacy.avif
- [ ] clinic/equipment-microscope.avif
- [ ] medical/medicine-remedy.avif
- [ ] medical/illustration-immune-system.svg
- [ ] medical/illustration-mast-cell.svg
- [ ] medical/infographic-consultation-steps.svg
- [ ] medical/timeline-treatment.svg
- [ ] medical/before-after-template.svg

**Gallery (×6 + thumbs)**
- [ ] gallery/clinic-photo-01 … 06.avif + .webp
- [ ] gallery/thumbs/clinic-photo-01 … 06.avif

**Blog**
- [ ] blog/blog-featured-template.avif + .webp
- [ ] blog/placeholder-blog.svg

**UI**
- [ ] icons/sprite.svg
- [ ] ui/empty-appointments.svg
- [ ] ui/empty-timeline.svg
- [ ] ui/empty-reports.svg
- [ ] ui/empty-search.svg
- [ ] ui/spinner.svg
- [ ] ui/placeholder-blur.avif
- [ ] ui/pattern-dots.svg
- [ ] ui/pattern-waves.svg
- [ ] ui/divider-curve.svg
- [ ] ui/texture-soft.avif + .webp

**Error / status pages**
- [ ] error/404-illustration.svg
- [ ] error/coming-soon.svg
- [ ] error/thank-you.svg

**PWA / splash**
- [ ] pwa/shortcut-book.png / shortcut-conditions.png / shortcut-portal.png
- [ ] pwa/offline-illustration.svg
- [ ] pwa/splash/ (7 device sizes)

**Social / marketing**
- [ ] social/og-default.jpg
- [ ] social/og-home.jpg
- [ ] social/og-team.jpg
- [ ] social/og-conditions.jpg
- [ ] social/og-online-consultation.jpg
- [ ] social/og-blog-template.jpg
- [ ] social/twitter-card.jpg
- [ ] social/whatsapp-preview.jpg
- [ ] social/linkedin-banner.png
- [ ] social/youtube-thumb-template.png
- [ ] social/instagram-template.png
- [ ] social/facebook-template.png
- [ ] banners/newsletter.avif + .webp + png
- [ ] social/gbp/ (logo + cover + 3 photos)

---

## 16. Final Audit

**Coverage vs source code**
- Every `<img>`, `og:image`, `favicon`, and manifest reference found in the repo (`index.html`, `team.html`, `conditions/`, `gallery.html`, `blog/`, `online-consultation/`, `contact.html`, patient portal) is mapped to a specced asset above. ✅
- Legacy paths flagged for migration: `assets/logo.svg` → `assets/logos/`, `doctor-*.jpg` → full-name `.avif/.webp`, `CHANGE-ME-image.jpg` → per-post blog featured, `*-og.jpg` → `social/og-*`. ✅
- Missing page files noted (`about.html`, `404.html`, `coming-soon.html`, research) — their assets pre-specced. ✅
- Branding, favicon, PWA, all 15 page types, all 8 conditions, all 4 doctors, medical illustrations, full social/marketing set, UI system, empty/loading/placeholder states, accessibility + performance guidance, folder tree, naming convention, master checklist — all present. ✅

**Question: Can the website launch with these assets?**

**Provisional NO** on first pass — gaps were: no `404`/offline/empty-state coverage, no maskable PWA icons, no AVIF tier, no mobile art-directed crops, no LQIP, no consolidated OG naming, doctor filenames didn't match full names.

→ All gaps resolved in this document (error/ folder, pwa maskable + splash + offline, AVIF+WebP everywhere, `*-mobile` crops, `ui/placeholder-blur`, `social/og-*` scheme, full-name doctor files).

**Re-audit: YES.** ✅ With every checklist item produced to the stated spec, the site has complete, launch-ready image coverage across branding, all pages, conditions, doctors, clinic/medical, marketing/social, UI, PWA, accessibility, and performance. No asset category is left undocumented. **The website can launch.**

*Blocking items before go-live (production, not documentation gaps): (1) real licensed/consented photography or commissioned SVG illustrations to fill the specced slots; (2) update the legacy `src`/`meta` paths in markup to the new filenames.*
