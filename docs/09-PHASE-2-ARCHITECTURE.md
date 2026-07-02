# Wise Homeopathy Phase 2 Architecture
## Version 2.1

> Blueprint for the patient ecosystem.
> Governed by docs/30-ARCHITECTURE-PRINCIPLES.md and the ADRs indexed in
> docs/31-ADR-INDEX.md — where this document's wording and those ADRs
> disagree, the ADR is authoritative (docs/CLAUDE.md's Architecture Freeze
> rule). Phase 2A's binding implementation detail lives in
> docs/29-PHASE-2A-TECHNICAL-PLAN.md and docs/33-DOMAIN-MODEL.md; this
> document remains the long-term Phase 2 vision.

# Vision

Transform the relationship from single consultation to continuous digital care.

---

# Entry Point

Only verified patients receive access.

**Authentication is passwordless by default (ADR-003):** a patient requests a login
link with their registered email; the platform emails a single-use, time-limited
magic link; clicking it authenticates the session. No patient password is collected
or stored.

Per ADR-002, this is a login *mechanism* attached to a patient's identity, not the
identity itself — a patient's permanent `patient_id` never depends on how they log
in. A second factor (e.g., SMS OTP, once a provider exists, or Workspace SSO if the
clinic adopts Google Workspace) can be added later as an additional option without
redesigning identity or migrating existing records. Full mechanics: docs/29 §3.

No public registration.

---

# Core Modules

## My Health Journey

Patient home.

Contains:

- Welcome
- Today's Care Plan
- Health Timeline
- Symptom Tracker
- Messages
- Follow-up

---

## Personal Care Plan

Displays:

- Current goals
- Medicines
- Lifestyle guidance
- Doctor instructions
- Next review

---

## Wise Digital Twin

AI-generated summary of the patient's journey.

Includes:

- Timeline
- Progress
- Consultation summaries
- Investigation history
- Symptom trends

AI organizes information only.
Doctors remain responsible for clinical decisions.

---

## Symptom Tracker

Patient logs:

- Severity
- Sleep
- Energy
- Stress
- Notes

Stored in Google Sheets.

---

## AI Summary

Not a standalone module — a cross-cutting **pattern** every AI-generated,
patient-facing artifact on the platform must follow (ADR-005, docs/33-DOMAIN-MODEL.md
§2.4): a constrained prompt, an independent code-level traceability check, and
mandatory doctor review and approval before anything reaches a patient. Converts
doctor notes into patient-friendly updates by rephrasing only — never inventing.

No diagnosis.
No prescriptions.
No treatment changes.

Phase 1.5's consultation-summary pipeline is the first working instance of this
pattern (docs/13-AI-GUIDELINES.md's worked example); Wise Digital Twin's future AI
narrative would be a second instance of the same pattern, not a separate design.

---

# Doctor Workflow

Consultation
→ Notes
→ Google Sheets
→ AI Summary (drafted, never sent unreviewed)
→ Doctor Review & Approval Gate (mandatory — ADR-005; blocks on missing consent or
  a non-approved review status, re-checked against live values, not submission-time
  state)
→ Patient Timeline

---

# Technology

Frontend:
- HTML
- CSS
- JavaScript

Backend:
- Google Apps Script

Storage:
- Google Sheets

Hosting:
- Netlify

AI:
- OpenRouter

---

# Security

- Private patient records
- Role-based access
- Audit logs
- HTTPS
- Least-privilege access

Governed by ADR-010 (security decisions take precedence over convenience). Phase 2A's
concrete implementation of every bullet above: docs/29-PHASE-2A-TECHNICAL-PLAN.md §10.

---

# Roadmap

Reconciled with docs/24-ROADMAP.md and locked by docs/32-ARCHITECTURE-REVIEW.md Part 2
(this document and docs/24 previously disagreed on what "Phase 2A" contained — resolved
here; both now state the same sequence):

Phase 2A — My Health Journey v1 (binding detail: docs/29-PHASE-2A-TECHNICAL-PLAN.md)
- Login (passwordless, ADR-003)
- Dashboard shell
- Health Timeline (read-only)
- Consultation History
- Symptom Tracker v1
- Report Upload

Phase 2B — Personal Care Plan
- Requires its own architecture-freeze pass before implementation (docs/32's
  recommendation — no technical plan exists yet)

Phase 2C — Health Milestones
- Scheduled progress reviews (30/90 days, 6 months, 1 year, per docs/21)
- No AI required — deliberately separated from Phase 2D's AI-supervised work

Phase 2D — Wise Digital Twin & AI Summaries
- Requires the full ADR-001/ADR-004/ADR-005 AI-supervision pattern
- Progress analytics and reminders fold into this phase, not a separate one
