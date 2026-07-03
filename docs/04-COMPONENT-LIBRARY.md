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

## Future Components

Reserved for Phase 2

- My Health Journey
- Personal Care Plan
- Wise Digital Twin
- Symptom Tracker
- AI Summary
- Progress Cards
- Health Timeline
