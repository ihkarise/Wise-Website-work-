# 24 - Wise Product Roadmap
## Version 1.5 — 2026-07-09

# Phase 1 — Public Website
Status: In Progress

Completed
- Documentation Framework
- Product Vision
- Website Audit
- Governance
- Batch 1
- Batch 2
- Batch 3 — Legal Pages

Remaining
- Dedicated Condition Pages
- Resources Hub
- Photography & Branding Assets

# Phase 1.5 — Platform Validation
Status: **Software Complete, Deployment Complete, Operationally Complete**
(Batches 4A-4H, plus live deployment on a free personal Google account —
`wisehomeopathicmc@gmail.com`, not Google Workspace; see docs/25's v1.3
deployment-account amendment). A real-patient pilot has been run and
reviewed by a doctor. Only docs/28's final governance sign-off
("Deployment approved") remains open — a clinic decision, not a technical
one. See docs/25 §10 (Definition of Done), docs/26 (validation report),
docs/27 (closeout), docs/28 (deployment checklist).

Completed
- Batch 4A — Sheet schema, Apps Script project skeleton, validation layer,
  audit logging, Sheet-write layer (no AI, no email, no public UI)
- Batch 4B — Staff entry form (`/internal/consultation-summary.html`),
  Workspace-domain-restricted, hard-gated consent checkbox
- Batch 4C — OpenRouter AI summarization step (normalization only,
  code-level drift flagging independent of the prompt)
- Batch 4D — Doctor review checkpoint (Sheet-bound custom menu) + gated
  send decision (`evaluateSendGate_`)
- Batch 4E — HTML email template + delivery (`Email.gs`, MailApp only),
  layered behind `Send.gs` so the gate stays independent of the provider
- Batch 4F — Automated 14-day retention purge (`Retention.gs`), fully
  independent of Review.gs/Send.gs/Email.gs, clears only
  `recipient_email` + stamps `purged_at`
- Batch 4G — Validation phase. No code changes to `apps-script/`. Built
  `validation/phase-1-5/` — a Node harness that runs the real committed
  source through every pipeline stage and the full end-to-end workflow,
  including every required failure mode. 37/37 checks passed. See
  docs/25 §10/§11 for exactly which Definition-of-Done items this closes
  versus which remain open pending a live Google Workspace deployment
  (Workspace-domain access, a real OpenRouter/MailApp call, the live
  retention trigger firing on schedule, and the required real-patient
  pilot).
- Batch 4H — Documentation, validation closeout, and project
  synchronization only. No code changes anywhere. Closed a documentation
  gap (docs/15 never got its promised Phase-1.5 security notes), and
  added docs/26 (validation report), docs/27 (official closeout), and
  docs/28 (deployment readiness checklist) — the formal end of the
  Phase 1.5 implementation sequence.

Remaining
- docs/28's final governance sign-off ("Deployment approved") — a clinic
  decision, not further code or deployment work.

# Phase 2A — My Health Journey v1
Status: **Software Complete, Deployment Verified, Frozen except for bug
fixes** (docs/43-PHASE-2A-CLOSEOUT.md). Architecture approved
(docs/29-PHASE-2A-TECHNICAL-PLAN.md, docs/30-ARCHITECTURE-PRINCIPLES.md,
docs/31-ADR-INDEX.md, docs/33-DOMAIN-MODEL.md,
docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md).
Foundation batches F1 (scaffolding), F2
(shared contracts + utilities), F3 (data layer + Patient Identity), F4
(session issuance/verification + route protection), and F5 (schema-
validator-based conformance testing) shipped — the full F1–F5 Foundation
Implementation Plan is now complete and frozen except for bug fixes.
See docs/29 §14 for batch-by-batch implementation notes and
docs/35-FOUNDATION-CLOSEOUT.md for the closeout summary and next-phase
entry criteria.

Identity & Access backend, split into two independent batches (docs/29
§15), is now complete and **frozen except for bug fixes**: IA-1
(infrastructure only — LoginToken generation, hashing, expiration,
single-use enforcement) and IA-2 (the magic-link request/consume flow,
rate limiting, account-enumeration protection, and Foundation's first
authenticated Web App route, `get_profile`) both shipped. See docs/29
§14/§15 for full batch-by-batch detail and
docs/36-IDENTITY-AND-ACCESS-CLOSEOUT.md for the closeout summary and
Patient Access entry criteria.

**Patient Access is the active milestone.** Batch PA-1 — `login.html` +
`verify.html`, the frontend half of docs/29 §13's original Batch 5B —
shipped. Batch PA-2 — the `assets/site.css` token extraction and the
`/my-health-journey/` dashboard shell (docs/29 §13 Batch 5C), wired to
PA-1's session — has also now shipped. Zero backend modification across
either batch. **Both are now frozen except for bug fixes** — see
docs/38-PATIENT-ACCESS-DASHBOARD-SHELL-CLOSEOUT.md for the closeout
summary and Batch PA-3 entry criteria (docs/37 remains the pre-PA-2
readiness review that preceded them; docs/29 §16 has the full
batch-by-batch implementation notes for both).

Batch PA-3 (docs/29 §13 Batch 5D) — the `ConsultationHistory` sheet and
data-access layer, the patient-facing read-only Timeline (list +
dashboard preview) and Consultation History detail view, and a
manually-run staff entry mechanism — has also now shipped, preceded by
docs/39-CONSULTATION-TIMELINE-READINESS-REVIEW.md and
docs/40-CONSULTATION-IDENTITY-STRATEGY.md's architectural clarification.
The Timeline card on `/my-health-journey/` now shows real data instead
of an empty state. Zero unauthorized modification to any frozen file —
the two disclosed, additive exceptions (`FoundationRouter.gs`'s two new
dispatch cases; `dashboard.js`'s Timeline-card wiring) are named in full
in docs/29 §16's Batch PA-3 notes.

Batch PA-4 (docs/29 §13 Batch 5E) — the `SymptomLogs` sheet and the
patient-facing Symptom Tracker (the platform's first patient-*writable*
feature, per docs/29 §9) — has also now shipped, preceded by
docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md. The Symptom Tracker card on
`/my-health-journey/` now shows a real quick-log form and most-recent-value
summary instead of an empty state, and a new full history page exists at
`/my-health-journey/symptoms/`. Zero unauthorized modification to any frozen
file — the disclosed, additive exceptions (`FoundationRouter.gs`'s two new
dispatch cases; `dashboard.js`'s Symptom Tracker-card wiring; `assets/site.css`'s
new `.field textarea`/`.field select` rules) are named in full in docs/29 §16's
Batch PA-4 notes.

Batch PA-5 (docs/29 §13 Batch 5F) — the `Reports` sheet, Drive integration, and
the platform's highest-risk feature, file upload — has also now shipped,
preceded by docs/42-REPORTS-UPLOAD-READINESS-REVIEW.md. The Reports card on
`/my-health-journey/` now shows a real upload form and recent-uploads list
instead of an empty state, and a new full history page exists at
`/my-health-journey/reports/`. Every dashboard card now shows real data or an
honest "planned for a future version" state — Reports was the last "Coming
later in Phase 2A" placeholder. Zero unauthorized modification to any frozen
file — the disclosed, additive exceptions (`FoundationRouter.gs`'s three new
dispatch cases; `dashboard.js`'s Reports-card wiring) are named in full in
docs/29 §16's Batch PA-5 notes.

Batch PA-6 (docs/29 §13 Batch 5G) — adding "Patient Login" to primary nav,
un-noindexing the real patient-facing pages, and a `sitemap.xml` entry for the
login entry point — has also now shipped, preceded by re-confirming PA-5's
deployment-verification fixes were still live and a full clean re-run of every
existing validation suite. This was the only batch in Phase 2A with a real
public-visibility change; My Health Journey is now genuinely reachable from
the public website rather than unlisted. Zero backend change of any kind
(verified via `git diff --name-only`). One deliberate, disclosed exception:
`my-health-journey/timeline/entry.html` (the per-record Consultation Detail
view) keeps its noindex tag, since it has no stable canonical URL to index —
recorded in docs/29 §16's Batch PA-6 notes, not a silent narrowing of scope.

Batch 5H / PA-7 (docs/29 §13) — the Phase 2A closeout batch — has also now
shipped: a full repository consistency review (architecture, schema, contract,
security, and documentation cross-checks), a clean re-run of every existing
validation suite (static analysis, conformance, Phase 1.5 regression, all five
browser-test suites — zero code changes required), the dedicated security
review of the magic-link/session-token mechanism docs/29 §11/docs/32/docs/34
had tracked as still-pending since Identity & Access (see
docs/15-SECURITY-STANDARDS.md; no vulnerabilities found), and a documentation
pass closing the one other genuine gap found (a stale, pre-Phase-1.5
`docs/CHANGELOG.md` superseded by root `CHANGELOG.md`, now marked as such).
**Phase 2A is now software-complete, deployment-verified, and frozen except
for bug fixes.** See docs/43-PHASE-2A-CLOSEOUT.md for the full closeout
report.

- Patient Login (passwordless, ADR-003)
- Dashboard shell
- Health Timeline (read-only)
- Consultation History
- Symptom Tracker v1
- Report Upload

Reconciled with docs/09-PHASE-2-ARCHITECTURE.md's roadmap per
docs/32-ARCHITECTURE-REVIEW.md Part 2 — Personal Care Plan is no longer
grouped into Phase 2A; it did not have a designed architecture and is
moved to its own phase below. Batch-level sequencing (5A–5H): docs/29 §13.

# Phase 2B — Wise Patient Experience Platform
Status: **Architecture-freeze finalized (Version 4.0, 2026-07-09).
Implementation not yet authorized.** This entry originally named only
"Personal Care Plan" (per docs/32 Part 2's recommendation), then "Personal
Care Plan, Module Engine & Personalized Check-ins" after the first
architecture-freeze pass (2026-07-04), then reframed again (2026-07-06) as
the **Wise Patient Experience Platform** — Personal Care Plan,
Personalized Daily Check-ins, and the Calculator Framework are
capabilities this platform delivers, not the phase's identity by itself.
A third review round (2026-07-08) settled most of the design questions the
prior two rounds had left open. A fourth, **documentation-only
finalization pass** (2026-07-09) renamed the implementation batch sequence
for platform-wide naming consistency, generalized Check-in templates into
a **Template Registry** (new ADR-016), refined the dashboard vision into a
registry-driven "Health Journey," and consolidated Doctor-Owned
Configuration into one explicit principle — no batch's scope, dependency,
or risk classification changed.

**Three core architectural pillars** carry this phase, per docs/44 §4:
**Doctor-Assigned Conditions** (`DoctorAssignedCondition`, an additive
entity — the frozen `Patient` schema is never widened; the patient never
selects a condition, diagnosis and assignment are the doctor's alone),
the **Module Engine** (a Module Registry plus per-patient enablement,
now committed to driving the **entire** patient dashboard — including
the pre-existing Timeline, Symptom Tracker, and Reports cards — from
enabled modules rather than fixed pages), and the **Calculator
Framework** (a Calculator Registry of independently pluggable,
deterministic, doctor-authored formulas — never hardcoded per disease). A
fourth registry — the **Template Registry** (ADR-016) — generalizes
Check-in templates into the same registry pattern, governing the *shape*
of any patient-facing form or questionnaire (Daily Check-in today; Weekly
Check-in, Monthly Review, Condition Review, Lifestyle Questionnaire,
Follow-up Questionnaire, and Doctor-created Templates named as reserved,
unscoped future categories, none claimed by any phase). **Module,
calculator, check-in, and template enablement/assignment is always an
explicit doctor/staff action** — never automatic from a condition
assignment, never patient-controlled; **patients never configure their
own dashboard.** Personalized Daily Check-ins (doctor-assigned templates,
patient never configures one; the designed successor to Symptom Tracker
v1, coexisting with it before any retirement), Personal Care Plan,
Patient Profile, and dashboard evolution (now framed as a dynamic,
registry-driven "Health Journey," docs/44 §13) are built on top of these
pillars.

**Persistent authentication is achieved through four cooperating
mechanisms — Magic Link (root of trust), Trusted Device, a Long-Lived
Session, and an optional, convenience-only PIN — with passwords
permanently reaffirmed as never mandatory** (ADR-015, which supersedes
ADR-014, which superseded ADR-011; all three records exist, only ADR-015
is current, per ADR-007). ADR-003's passwordless-by-default principle
remains fundamentally correct and unchanged for any patient who opts
into neither additive mechanism. Magic Link is never replaced by any
additive mechanism.

See docs/44-PHASE-2B-TECHNICAL-PLAN.md (Version 4.0) for the full design,
docs/45-PHASE-2B-ARCHITECTURE-READINESS-REVIEW.md (Version 4.0) for the
critique of every proposal, docs/46-PHASE-2B-REPOSITORY-CONSISTENCY-
REVIEW.md (Version 4.0) for the consistency check, ADR-012 (amended),
ADR-013 (confirmed), ADR-015 (current authentication ADR), and ADR-016
(Template Registry, new) for the binding decisions, and
**docs/47-PHASE-2B-IMPLEMENTATION-RULES.md** for the permanent per-batch
implementation standard (registry rules, entity rules, validation/
documentation/git rules, and the mandatory three-phase batch workflow)
every batch from PXP-1 onward must follow.

**Implementation has not begun and is not authorized by any of the above
documents.** docs/44 §22 now sequences **infrastructure before
features**: Patient Profile → Doctor-Assigned Conditions → Module
Registry → Dashboard Registry → Daily Check-in Engine → Calculator
Registry → Personal Care Plan → Trusted Device + Long-Lived Session +
Optional PIN → a reserved, unscoped "AI Integration" placeholder — plus
Symptom Tracker Migration and Closeout, eleven batches total (PXP-1
through PXP-11 — renamed from PCP-1 through PCP-11 for platform-wide
naming consistency, no scope change).
Digital Twin is explicitly **not** part of this sequence — it remains a
later roadmap consumer of Timeline, Reports, Check-ins, Care Plans, and
Calculators (Phase 2D), not tightly coupled to Phase 2B's implementation.
Each batch requires its own separate, explicit approval, per docs/43
§12's Phase 2B gate. docs/45 Part 5 flags the optional-PIN sub-batch
(within PXP-8) as requiring a dedicated security review before it
specifically can be approved, independent of the rest of the plan. The
Public (no-login) Calculator variant remains an unclaimed roadmap gap
(docs/46 Part 3) — only the Patient variant is claimed by this phase.

# Phase 2C — Health Milestones
- Scheduled progress reviews (30/90 days, 6 months, 1 year, per docs/21)
- No AI required — deliberately separated from Phase 2D, which carries the
  platform's AI-supervised work

# Phase 2D — Wise Digital Twin & AI Summaries
- Health Story
- AI Summaries
- Progress Analytics

Requires the full ADR-001/ADR-004/ADR-005 AI-supervision pattern before
any implementation begins.

# Phase 3 — WiseOS
- Doctor Dashboard
- Inventory
- PillFill Integration
- Holoscan
- AI Assistant
- Analytics

# Guiding Principle
Every roadmap item should support the North Star:

'Build the world's most trusted continuous digital homeopathy care platform.'
