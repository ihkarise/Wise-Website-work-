# Wise Homeopathy Component Library
## Version 2.0

This document defines every reusable UI component.

# Principles

Every component must:

- Follow the Design System
- Be reusable
- Be responsive
- Be accessible
- Maintain visual consistency

---

# Core Components

## Hero

Purpose:
Introduce the page and communicate one primary message.

Contains:
- Eyebrow
- Heading
- Supporting copy
- Primary CTA
- Secondary CTA (optional)

---

## Feature Card

Contains:
- Icon
- Title
- Description
- Optional CTA

---

## Condition Card

Contains:
- Condition Name
- Short Summary
- Learn More

---

## Doctor Card

Contains:
- Photo
- Name
- Qualifications
- Specialty
- CTA

---

## FAQ

Accordion layout.

---

## Timeline

Vertical timeline with milestones.

---

## Statistics

Large number

Small description

---

## Trust Badge

Research

Experience

Technology

Transparency

---

## Forms

Large inputs

Helpful labels

Clear validation

---

## Floating Section Navigator

Desktop:
Sticky side navigation

Mobile:
Expandable bottom navigation

Highlights current section.

---

## Footer

Quick Links

Resources

Contact

Hours

Social

Legal

---

## Empty State

Explain what is missing.

Offer the next action.

---

## Loading State

Use skeletons.

Avoid spinners.

---

## Error State

Friendly.

Actionable.

Never technical.

---

## Phase 2A — Identity & Access Components (Batch PA-1)

Built against the general Forms/Loading State/Error State principles above — not new
component types, concrete instances of them.

### Login Form (`login.html`)

Contains:
- Email field (single field, per the Forms principle above: "Few fields")
- Primary CTA ("Send login link")
- Status region (loading / ok / err), reusing the Loading State and Error State
  patterns — the "ok" message is the backend's own generic, anti-enumeration-safe
  copy, displayed verbatim rather than re-authored client-side

### Sign-In / Verify (`verify.html`)

A multi-state single card, not a form — five mutually exclusive states swapped by
`hidden`, never more than one shown at once (one primary action per screen, docs/05):
- No token present — Error State variant, links back to Login Form
- Ready — explains the next step, one primary CTA ("Continue to sign in"); does not
  auto-advance (a deliberate security choice, docs/29 §16)
- Verifying — Loading State (skeleton bars, no spinner)
- Signed in — confirmation, honestly states any not-yet-built next step as "coming
  soon" (Empty State principle) rather than linking somewhere that doesn't exist yet
- Failed — Error State, backend's own friendly `error.message`, links back to Login
  Form

---

## Phase 2A — Dashboard Shell Components (Batch PA-2)

Built against docs/37's pre-implementation readiness review. Extracted the
shared design tokens and Login Form/Verify components above out of
`login.html`/`verify.html`'s duplicated `<style>` blocks into `assets/site.css`
— those two pages, and this batch's new dashboard shell, are its first three
consumers. `internal/consultation-summary.html` (Phase 1.5, frozen) and the
public marketing pages keep their own independent stylesheets, untouched.

### Authenticated Header (`my-health-journey/index.html`)

Contains exactly four elements, per the approved design decision — nothing
more:
- Wise logo
- "My Health Journey" (the page's one `h1`, living in the header rather than
  duplicated again in `<main>`)
- Patient greeting (real data — `full_name` from `get_profile`, Foundation's
  first authenticated route; a Loading State skeleton until it resolves)
- Sign out (clears the session and returns to Login Form)

### Dashboard Card Grid

A responsive `auto-fit` grid of six cards — Timeline, Symptom Tracker,
Reports, Care Plan, Messages, Digital Twin — each a `.card` instance (reused
from the Forms/Login Form component, unchanged) with its own `h2` and one
Empty State body. No card has a live data source in this batch (docs/29 §13
Batches 5D/5E/5F are what wire Timeline/Symptom Tracker/Reports respectively)
— every card in PA-2 renders an Empty State. Timeline (PA-3), Symptom
Tracker (PA-4), and Reports (PA-5) have since all been wired to real data —
see their own sections below. Every dashboard card now shows real data or an
honest "planned for a future version" state; none shows the original
"Coming later in Phase 2A" placeholder anymore.

### Empty State — three distinct types (Batch PA-2)

Generalizes the Empty State principle above ("explain what is missing, offer
the next action") into three tones, so a patient isn't given the same
expectation for every unfinished feature:

- **No data yet** — a real, wired feature with zero rows for this specific
  patient. Built and verified in PA-2 with no live consumer yet; Batch PA-3
  gave it its first real one (the Timeline card and the Timeline list page,
  for a patient with zero Consultation History entries) — see the Batch PA-3
  section below.
- **Coming later in Phase 2A** — used by Timeline, Symptom Tracker, and
  Reports before each was wired (Batches 5D/5E/5F respectively). No card
  renders it anymore as of Batch PA-5 (Reports was the last one) — the
  badge/CSS class are kept, unremoved, for the same "built, verified, no
  current consumer" reason the "No data yet" variant was kept through
  PA-2/PA-3 before it had one.
- **Planned for a future version** — Care Plan, Messages, Digital Twin. No
  architecture exists yet for any of the three (docs/29 §2.2); the copy
  deliberately does not imply a near-term date.

### Session-Expiry Notice

A `.status.warn` variant (new — added to `assets/site.css`, using the
`--color-warn-*` tokens already defined but previously only used by
`internal/consultation-summary.html`'s staff-only banner). Shown on
`login.html` when the dashboard's session guard redirects there after a
rejected/expired session: "For your privacy, your secure session has ended.
Please sign in again." — one generic message regardless of the specific
rejection reason, mirroring `FOUNDATION_UNAUTHORIZED`'s own generic code.

---

## Phase 2A — Timeline & Consultation History Components (Batch PA-3)

Built against docs/39's readiness review and docs/40's identity-strategy
clarification. Gives the Timeline card (PA-2) its first real data source and adds two
new pages, both reusing `assets/site.css` unchanged.

### Timeline Preview (dashboard card, `my-health-journey/dashboard.js`)

The Timeline card's Empty State is replaced with real data once loaded: the three
most recent entries (date + title) plus a "View full timeline" link — or the "No data
yet" Empty State for a patient with zero entries. A card-local skeleton shows while
its own `get_timeline` call is pending, independent of the header's `get_profile` call.

### Timeline List (`my-health-journey/timeline/`)

A real ordered list (`<ol>`), one `<li>` per entry — chronological order is content,
not decoration. Each entry: date, title (`h3`), a truncated summary, and a "View
details" link keyed by the entry's `record_id` (docs/40) — never by list position.
Visually adapted from the public site's `.journey`/`.j-step` vertical-timeline pattern
(docs/29 §5's named reuse target), freshly implemented rather than imported, to avoid
touching the frozen public stylesheet. Empty and error states follow the same
Empty-State/Error-State conventions as the dashboard shell.

### Consultation History Detail (`my-health-journey/timeline/entry.html`)

Read-only — full, untruncated entry text (unlike the list's truncated preview), a
"back to Timeline" link (no dead ends), and the backend's own error message displayed
verbatim on rejection (never a raw or invented message) — whether the requested
`record_id` doesn't exist or belongs to a different patient, the message and behavior
are identical, so no page ever reveals which case occurred.

### Shared Session Guard (`my-health-journey/session-guard.js`)

New — the first cross-page shared script in Phase 2A, consumed by the Timeline list
and detail pages (docs/39 §7's "ripe for extraction" recommendation, acted on now that
a second and third authenticated page exist). Deliberately does not replace
`dashboard.js`'s own independent implementation, which stays frozen except for its
explicitly-planned Timeline-wiring addition.

---

## Phase 2A — Symptom Tracker Components (Batch PA-4)

Built against docs/41's readiness review — the platform's first patient-*writable*
feature. Gives the Symptom Tracker card (PA-2) its first real data source and adds one
new page, reusing `assets/site.css` unchanged plus two small additive rules
(`.field textarea`, `.field select` — this phase's first multi-field form needing
either).

### Symptom Quick-Log Form (dashboard card, `my-health-journey/dashboard.js`)

The Symptom Tracker card's Empty State is replaced with a real, always-present
quick-log form — the only dashboard card whose primary content is a write affordance,
not a read preview (docs/41 §2). Four mandatory 1–10 scale fields (severity, sleep,
energy, stress) as plain `<input type="number">` elements, each with a real
`<label for>` (deliberately not a range slider, sidestepping the "bare slider with no
visible value" accessibility gap), plus an optional notes `<textarea>` and an optional
condition-tag `<select>` (`shared/constants/condition-slugs.json`'s canonical list).
Submission feedback uses the existing `.status`/`role="status"`/`aria-live="polite"`
component — this phase's first form where the patient stays on the same page after
submitting, so the live region is exercised for the first time. Once entries exist, a
bare most-recent-value summary (date + all four values, no chart, no trend) plus a
"View full history" link appears below the form; a zero-entry patient sees the "No
data yet" Empty State instead, with the form still present either way.

### Symptom History (`my-health-journey/symptoms/`)

A real ordered list (`<ol>`), one `<li>` per entry — reverse-chronological, no
per-entry detail page (docs/41 §2: a scale-values-plus-short-note row has no long-form
text that would benefit from its own page, unlike Consultation History). Each entry
shows its date, all four scale values, the optional note (HTML-escaped, never trusted
as markup), and the optional condition tag. Visually adapted from PA-3's own
`.tl-track`/`.tl-item` pattern (the same "reuse this pattern rather than invent a third
list style" discipline docs/41 §14 names), not a fresh list style. Empty and error
states follow the same conventions as Timeline and the dashboard shell. Reuses
`my-health-journey/session-guard.js` unchanged — the next consumer that module's own
PA-3 introduction anticipated.

---

## Phase 2A — Report Upload Components (Batch PA-5)

Built against docs/42's readiness review — the platform's highest-risk feature. Gives
the Reports card (PA-2) its first real data source and adds one new page, reusing
`assets/site.css` unchanged (zero new shared rules — even the file input reuses `.field
input` as-is).

### Report Upload Form (dashboard card, `my-health-journey/dashboard.js`)

The Reports card's Empty State is replaced with a real, always-present upload form — the
same "write affordance is the card's primary content" pattern PA-4's Symptom Tracker
card already established, now applied to a file picker instead of scale inputs. A
single `<input type="file" accept="...">` restricted to PDF/JPG/PNG, with a real `<label
for>`, plus an "Upload report" submit button. Client-side size/type pre-checks
(ported from `shared/constants/upload-limits.json`) give an immediate, friendly
rejection before any file is read or sent — UX only; the server performs the real,
content-based validation regardless (docs/29 §8, docs/42 §2). Submission feedback
reuses the existing `.status`/`role="status"`/`aria-live="polite"` component. Once
reports exist, a bare "recent uploads" list (date + filename, no thumbnails, no
preview) plus a "View full history" link appears below the form; a zero-report patient
sees the "No data yet" Empty State instead, with the form still present either way.

### Reports (`my-health-journey/reports/`)

A real ordered list (`<ol>`), one `<li>` per entry — reverse-chronological, visually
adapted from PA-3's/PA-4's own `.tl-track`/`.tl-item` pattern (the same "reuse this
pattern rather than invent a third list style" discipline docs/41 §14 named, extended
here to a fourth). Each entry shows its upload date, filename (HTML-escaped, never
trusted as markup), detected MIME type and a human-readable size, and a "Download"
button — the only per-entry action, since Reports has no edit/delete operation
(docs/42 §4/§5). Downloading never follows a Drive URL: clicking "Download" calls the
same session-gated `download_report` action, decodes the returned base64 payload
client-side, and triggers a real browser file download via a Blob/`<a download>` — the
patient's browser is never given any Drive-level access of its own (docs/42 §3). Empty
and error states follow the same conventions as Timeline and Symptom History. Reuses
`my-health-journey/session-guard.js` unchanged — the next consumer that module's own
PA-3 introduction anticipated.

---

## Future Components

Reserved for later phases — real data wiring, not the shell itself

- Personal Care Plan
- Wise Digital Twin
- AI Summary
- Progress Cards
