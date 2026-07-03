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
— every card in PA-2 renders an Empty State.

### Empty State — three distinct types (Batch PA-2)

Generalizes the Empty State principle above ("explain what is missing, offer
the next action") into three tones, so a patient isn't given the same
expectation for every unfinished feature:

- **No data yet** — a real, wired feature with zero rows for this specific
  patient. Built and verified in PA-2 with no live consumer yet; Batch PA-3
  gave it its first real one (the Timeline card and the Timeline list page,
  for a patient with zero Consultation History entries) — see the Batch PA-3
  section below.
- **Coming later in Phase 2A** — Timeline, Symptom Tracker, Reports. Named,
  sequenced batches already exist for each (5D/5E/5F).
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

Built against docs/41's readiness review and the three decisions it confirmed before
implementation (draft/submitted lifecycle; no offline support). Gives the Symptom
Tracker card (PA-2) its first real data source and adds one new page, reusing
`assets/site.css` and `my-health-journey/session-guard.js` unchanged.

### Symptom Tracker Card (dashboard card, `my-health-journey/dashboard.js`)

The card's Empty State is replaced with one of three real states once loaded: a
draft-in-progress message + "Continue draft" link; the most recent submitted entry's
summary + "Log a new entry" link; or the "No data yet" Empty State (its second real
consumer, alongside Timeline) + "Log your first entry" link. A card-local skeleton
shows while its own `get_symptom_logs` call is pending, independent of the header's
`get_profile` call and of the Timeline card's own `get_timeline` call.

### Symptom Log Form (`my-health-journey/symptom-tracker/`)

The first genuinely **multi-field** authenticated form in Phase 2A (every prior form —
Login, Verify — has exactly one field). Four scale inputs (`<input type="number"
min="1" max="10">`, each optional, each with a real associated `<label for>`), an
optional notes `<textarea>`, and two actions: "Save draft" (updates the draft in
place, shows a confirmation status) and "Submit entry" (irreversible — saves any
pending edits, then transitions the draft to submitted). A `role="status"
aria-live="polite"` region carries save/submit confirmation and error feedback,
including the backend's own message shown verbatim on rejection — the first Phase 2A
form to give post-submission feedback without navigating away, so this live region is
new territory relative to Login/Verify's own per-page status pattern.

Only one of two states is ever shown for the draft section: the form itself (an open
draft exists), or a single "Log a new entry" button (none exists yet — clicking it
creates one). Never both, and never a draft silently created just by visiting the
page.

### Symptom Log History (read-only list, same page)

Reuses PA-3's `.tl-track`/`.tl-item` vertical-list visual, adapted (not literally
imported) into the page's own `<style>` block — the same "reverse-chronological list
of dated entries" shape Timeline already established. Each item shows the submission
date and a synthesized summary (e.g. "Severity 6, Sleep 7" plus any notes) — computed
at render time from the raw stored fields, never a separately persisted summary field.
No "View details" link — unlike a Consultation History entry, a symptom log entry's
few scalar values don't warrant a separate detail page (docs/41 §2).

### Offline / Network-Failure Messaging

A new, specific variant of the Error State principle: on a network failure during
save or submit, the form's typed values are left exactly as they were (never
cleared, never queued to local storage or a background sync mechanism) and a friendly,
specific message is shown — "You appear to be offline. Check your connection and try
again — your entry has not been lost." Distinct from a rejected-session message
(session-guard.js's own concern, unchanged) and from a validation error (the backend's
own specific message, shown verbatim, not re-worded).

---

## Future Components

Reserved for later phases — real data wiring, not the shell itself

- Personal Care Plan
- Wise Digital Twin
- Report Upload (Batch 5F)
- AI Summary
- Progress Cards
