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
  patient. No card in this batch has a live data source, so this variant has
  no page consumer yet — built and directly verified
  (`validation/pa-2-dashboard/browser-test.js`, via the page's own exposed
  `window.WiseDashboard.emptyStateHtml()`), with its first real consumer
  arriving whichever of Batches 5D/5E/5F ships first.
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

## Future Components

Reserved for later phases — real data wiring, not the shell itself

- Personal Care Plan
- Wise Digital Twin
- Symptom Tracker (data entry + own history — shell placeholder shipped in PA-2)
- AI Summary
- Progress Cards
- Health Timeline (data — shell placeholder shipped in PA-2)
