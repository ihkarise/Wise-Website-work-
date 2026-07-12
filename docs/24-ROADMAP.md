# 24 - Wise Product Roadmap
## Version 1.24 — 2026-07-16

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
Status: **Closed — frozen except for genuine bug fixes (Batch PXP-11 Closeout,
2026-07-15, docs/48-PHASE-2B-CLOSEOUT.md).
Architecture-freeze finalized (Version 4.0, 2026-07-09).
Implementation: Batch PXP-1 (Patient Profile) shipped 2026-07-09;
Batch PXP-2 (Doctor-Assigned Conditions) shipped 2026-07-09; Batch PXP-3
(Module Registry) shipped 2026-07-10; Batch PXP-4 (Dashboard Registry)
shipped 2026-07-11; Batch PXP-5 (Daily Check-in Engine) shipped 2026-07-12;
Batch PXP-6 (Calculator Registry, backend only) shipped 2026-07-13; Batch
PXP-7 (Personal Care Plan) shipped 2026-07-14; Batch PXP-8 (Trusted Device +
Long-Lived Session, PIN out of scope) shipped 2026-07-14; Batch PXP-10
(Symptom Tracker Migration) shipped 2026-07-15, approved as this phase's
ninth shipped batch per docs/47's per-batch gate. **PXP-9 (AI Integration)
remains an intentionally unscoped, reserved placeholder** — docs/44 §22 and
docs/45's own readiness verdict both name it as "not ready for any scoping
at all," so it was skipped rather than implemented; PXP-10 was approved and
built directly, out of numeric order, since it carries no dependency on
PXP-9 (docs/44 §22's own dependency column: PXP-10 depends only on PXP-5
proven in production).** Batch PXP-11 (Closeout) shipped 2026-07-15 —
**Phase 2B is now closed and frozen except for genuine bug fixes**, per
docs/48-PHASE-2B-CLOSEOUT.md. A fresh, aggregate re-run of every validation
suite (710 automated checks across 13 suites, 0 failures) and a repository
consistency review (docs/47 §14) found and fixed three genuine, disclosed,
documentation-only inconsistencies in docs/33-DOMAIN-MODEL.md (stale status
tags left over from Batches PXP-6/PXP-10, corrected — no entity's shape,
schema, or code changed). Next roadmap milestone: **Phase 2C — Health
Milestones**, or a future, separately-proposed **PXP-9 — AI Integration**
design — neither is authorized to begin by this document; each requires
its own explicit approval, per docs/47 §9's per-batch gate.
This entry originally named only
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

**Batch PXP-1 (Patient Profile, docs/44 §17/§22)** — the recommended first
batch, per docs/45 Version 4.0's readiness verdict — has now shipped:
`PatientProfile` (`shared/schemas/patient-profile.schema.json`,
`apps-script/FoundationPatientProfile.gs`, `get_patient_profile`/
`save_patient_profile` dispatch cases) and the patient-facing
`/my-health-journey/profile/` view/edit page. The platform's first
patient-mutable, upsert-style entity — a single 1:1 row per patient,
created lazily on first save rather than eagerly at patient creation, with
no gating on `Patient.status` (resolving both open lifecycle questions
docs/45 carried forward). Zero dependency on any other Phase 2B batch, zero
modification to any frozen Foundation/Identity & Access/Patient Access
file — one small, disclosed exception (`my-health-journey/index.html`'s
new "My Profile" header link; no `dashboard.js` logic touched, no new
dashboard card added in this batch).

**Batch PXP-2 (Doctor-Assigned Conditions, docs/44 §6/§22)** — Pillar 1 —
has now shipped: `DoctorAssignedCondition`
(`shared/schemas/doctor-assigned-condition.schema.json`,
`apps-script/DoctorAssignedCondition.gs`) and the one new, read-only
`get_doctor_assigned_conditions` dispatch case. Doctor/staff-owned, a hard
boundary — the patient never creates, edits, or resolves an assignment. No
real Doctor identity/authentication exists yet (docs/33 §1.4), so
assignment/resolution are manually-run Apps Script editor functions
(mirroring `PatientIdentity.gs`'s `createFoundationPatient()` precedent),
not a Web App route. The one patient-facing surface is the read-only route,
session-derived, returning only the caller's own assignment history — no
UI is built on top of it in this batch (docs/44 §22's "zero patient-facing
surface beyond a read-only reflection, if any"), and it is infrastructure
for later batches (Module Registry, Dashboard Registry, Daily Check-in
Engine, Calculator Registry, Personal Care Plan) to eventually consume.
docs/45 Version 3.0/4.0 Part 1.2's `DoctorAssignedCondition`/`Patient.
condition_slug` coexistence loose end is resolved: this batch is purely
additive, no existing reader migrates. Zero dependency on any other Phase
2B batch, zero modification to any frozen file.

**Batch PXP-3 (Module Registry, docs/44 §7/§22)** — Pillar 2's backend half
— has now shipped: `shared/constants/module-registry.json`
(`apps-script/ModuleRegistry.gs`) defines which capabilities exist at all
(availability), seeded only with the three already-implemented Phase 2A
capabilities (Timeline, Symptom Tracker, Reports) — Daily Check-ins,
Calculators, and Personal Care Plan are deliberately not pre-declared, so
their own future batches make their own design decisions rather than this
one guessing them. `shared/schemas/patient-module-state.schema.json`
(`apps-script/PatientModuleState.gs`) implements per-patient *enablement*,
fail-closed by absence of a row (ADR-010) — never automatic from a Doctor
Assigned Condition, never patient-controlled (docs/44 §14). No real Doctor
identity/authentication exists yet, so enable/disable stays a manually-run
editor function, mirroring `DoctorAssignedCondition.gs`'s own precedent. One
new, read-only `get_patient_module_states` route is this batch's minimal
patient-facing surface — infrastructure for the still-unbuilt Dashboard
Registry batch (PXP-4) to eventually consume; **no dashboard rendering
change ships in this batch** (`dashboard.js` is untouched). ADR-012 was
amended a second time, generalizing the registry's framing from
dashboard-specific infrastructure to a platform-wide capability-exposure
mechanism — the dashboard remains its first and, as of this batch, its only
implemented consumer; Timeline, Personal Care Plan, and a future AI system
are named, not scoped, as potential future consumers, the same "name it,
don't scope it" discipline ADR-016 already established. Zero dependency on
any other Phase 2B batch beyond the registry itself, zero modification to
any frozen file.

**Batch PXP-4 (Dashboard Registry, docs/44 §7.3/§13)** — Pillar 2's
frontend consumer half — has now shipped: the "My Health Journey" dashboard
(`my-health-journey/dashboard.js`) is now a registry-driven consumer of
PXP-3's Module Registry plus `PatientModuleState`. Every card that renders
on the dashboard corresponds to a registry entry the patient is enabled
for, ordered by `display_order`; there is no hardcoded knowledge of any
specific module in `renderDashboard()`'s render path. `PatientModuleState`
is now the sole source of enablement (fail-closed: absence of an
`enabled === true` row means the card does not render); the Module
Registry is the sole source of presentation (title, ordering, empty-state
type, `data_source` string). A loader-dispatcher maps each registry
`data_source` to its registered loader function — adding a new module
later means (i) add its registry entry, (ii) register a loader — nothing
in `renderDashboard()` itself changes. The three pre-PXP-4 hardcoded
"future" placeholder cards (Care Plan, Messages, Digital Twin) no longer
render on any patient's dashboard, since none are in the Module Registry
(docs/47 §4: a not-yet-built module is not pre-declared by an earlier
batch guessing its shape; a future batch will re-add each via the
registry, not a hardcoded call in `dashboard.js`). One frozen-file
exception, explicitly disclosed: `my-health-journey/dashboard.js` is
Phase 2A-frozen except for genuine bug fixes, and this batch is the exact
"authorized migration" case ADR-012 (amended) commits to and docs/44 §7.3
requires — not a bug fix. Zero backend change (no new Apps Script route,
no new schema, no `.gs` file added or edited — the batch is entirely a
frontend consumer of PXP-3's already-shipped `get_patient_module_states`
route). Zero dependency on any other Phase 2B batch beyond PXP-3, zero
modification to any other frozen file (`my-health-journey/index.html`,
every `.gs` file, every `shared/schemas/*.schema.json`, every
`shared/constants/*.json` — all untouched).

**Batch PXP-5 (Daily Check-in Engine, docs/44 §10/§11/§22, ADR-016)** — a consumer
of Pillars 1 and 2 — has now shipped: the Template Registry's first concrete
category, `CheckInTemplate` (`shared/constants/template-registry.json`,
`apps-script/TemplateRegistry.gs`, seeded with one template,
`daily_wellness_checkin` v1), and `CheckInResponse`
(`shared/schemas/check-in-response.schema.json`,
`apps-script/CheckInResponse.gs`) — the platform's first entity implementing
docs/44 §11.4's JSON storage policy in full (flat-object answers, validated
against the referenced template version's own question list, size-bounded,
deterministically serialized). Shipped alongside, never replacing, Symptom
Tracker (docs/44 §10.1) — `SymptomLogs` and its own routes are completely
untouched. One disclosed, additive gap-fill: docs/44 §10.2 settles that "a
doctor explicitly assigns which template(s) apply" but names no persisted
shape for that assignment anywhere in docs/44 §17 or docs/33 §6.5;
`CheckInTemplateAssignment` (`shared/schemas/
check-in-template-assignment.schema.json`,
`apps-script/CheckInTemplateAssignment.gs`) fills it — an exact structural
mirror of the already-twice-approved `DoctorAssignedCondition` pattern
(doctor/staff-only, manually-run editor functions, no Web App write route),
not a new pattern or a new ADR. Three new, additive `FoundationRouter.gs`
dispatch cases (`get_checkin_template`, `submit_checkin_response`,
`get_checkin_responses`) and one new, additive Module Registry entry
(`daily_checkin`) register the capability through PXP-3/PXP-4's existing
mechanisms — no registry redesign. The "My Health Journey" dashboard gains
one new card, generated dynamically from the caller's own current template's
question metadata (the first dashboard form not hardcoded to a fixed field
set), plus a new full-history page (`/my-health-journey/checkins/`). Zero
modification to any frozen Foundation/Identity & Access/Patient Access/
PXP-1..4 file — one disclosed, mechanical test-infrastructure update
(`validation/phase-2a-foundation/conformance.js`'s Stage 12 module-count
assertions, `3`→`4`, since the Module Registry is designed to grow).

**Batch PXP-6 (Calculator Registry, docs/44 §8/§22, ADR-013)** — Pillar 3 —
has now shipped, **backend infrastructure only, a deliberate and disclosed
scope decision:** `shared/constants/calculator-registry.json`
(`apps-script/CalculatorRegistry.gs`) defines the generic, pluggable
Calculator Registry mechanism, mirroring Module Registry (ADR-012) and
Template Registry (ADR-016) exactly — **seeded with zero registered
calculators**, disease-specific or otherwise. This batch's own scope is the
registry-and-result mechanism itself, not a concrete `CalculatorDefinition`;
a future calculator becomes real only once a later, separately-approved
batch adds its own registry entry (docs/47 §4's "a new calculator is a new
registry entry, never new architecture"). `shared/schemas/
calculator-result.schema.json` (`apps-script/CalculatorResult.gs`) backs
two new, additive `FoundationRouter.gs` dispatch cases
(`submit_calculator_result`, `get_calculator_results`) — the platform's
second entity implementing docs/44 §11.4's JSON storage policy in full
(`check-in-response.schema.json`'s own documentation had already anticipated
this as its "second use"). `result_value` is never computed by this generic
layer — ADR-013's deterministic formula logic remains a future batch's
responsibility once a real calculator is authored; this batch only
validates a submitted `input_snapshot` against a registry entry's declared
input fields and stores whatever `result_value` the caller supplies. **No
Module Registry entry, no dashboard card, no patient-facing UI ships in this
batch** — docs/44 §22's own PXP-6 row names "Patient Calculator UI" as part
of this batch's architectural scope, but this batch's own explicit approval
narrows that to backend infrastructure only, mirroring the exact Module
Registry (PXP-3, backend) / Dashboard Registry (PXP-4, frontend) split
precedent: the registry-and-storage mechanism ships first, patient-facing
rendering is a later, separately-scoped batch once a real calculator exists
to render. No new ADR was required — ADR-013 and ADR-012's registry-driven
principle already fully govern this pattern. Zero modification to any
frozen Foundation/Identity & Access/Patient Access/PXP-1..5 file.

**Batch PXP-7 (Personal Care Plan, docs/44 §12/§22)** — a consumer of
Pillars 1 and 2 — has now shipped: `CarePlan`
(`shared/schemas/care-plan.schema.json`, `apps-script/CarePlan.gs`) and
`DoctorInstruction` (`shared/schemas/doctor-instruction.schema.json`,
`apps-script/DoctorInstruction.gs`), matching docs/44 §12's design exactly.
`CarePlan` is one evolving, append-only-versioned plan per patient — editing
a plan never mutates an existing row, it appends a new version sharing the
same stable `care_plan_id` and automatically flips the prior version's own
row to `status: superseded`, exactly one `active` row per plan at any time.
`DoctorInstruction` rows attach to a plan via that same stable
`care_plan_id`, remaining correctly attached across every later version;
each instruction's own `status` (active/discontinued/completed) transitions
one-way, exactly once, mirroring `DoctorAssignedCondition`'s own precedent.
One disclosed, additive field beyond docs/44 §12's literal list:
`CarePlan.version_key` (server-derived, `care_plan_id + '::' + version`),
mirroring `PatientModuleState.state_key`'s own precedent for addressing one
row among several sharing the same logical identity. Doctor/staff-owned, a
hard boundary — no real Doctor identity/authentication exists yet
(docs/33 §1.4), so authoring/instruction-writes remain manually-run Apps
Script editor functions (`CarePlan.gs`'s `saveFoundationCarePlan()`;
`DoctorInstruction.gs`'s `createFoundationDoctorInstruction()`/
`updateFoundationDoctorInstructionStatus()`), mirroring
`DoctorAssignedCondition.gs`'s precedent exactly. Two new, additive
`FoundationRouter.gs` read-only dispatch cases (`get_care_plan`,
`get_doctor_instructions`) and one new, additive Module Registry entry
(`care_plan`, `display_order: 40`) register the capability through
PXP-3/PXP-4's existing mechanisms — no registry redesign. The "My Health
Journey" dashboard gains one new, read-only card (a short goals preview plus
a link to the full plan), and a new full-detail page
(`/my-health-journey/care-plan/`) shows the current plan's full goals text
plus every attached instruction, newest first. **Disclosed, deliberate scope
decision:** docs/44 §12 states a new Care Plan version "emits a
`TimelineEvent` (`entry_type: care_plan`)" — implementing this would require
widening the frozen `consultation-history.schema.json`'s `entry_type` enum
and changing `FoundationConsultationHistory.gs`, both Phase 2A files frozen
except for a genuine bug fix (docs/43 §12); this batch makes the disclosed
choice not to touch either frozen file, per docs/47 §6, and defers Timeline
integration to a future, separately-approved change (full reasoning:
`shared/schemas/care-plan.md`). Zero modification to any frozen
Foundation/Identity & Access/Patient Access/PXP-1..6 file.

**Batch PXP-8 (Trusted Device + Long-Lived Session, docs/44 §5/§22, ADR-015)** —
Persistent Authentication — has also now shipped: `TrustedDevice`
(`shared/schemas/trusted-device.schema.json`, `apps-script/TrustedDevice.gs`), the
platform's first Phase 2B entity that is *patient*-owned rather than doctor/staff-owned
— every write is a real, session-authenticated Web App route
(`mark_device_trusted`/`revoke_trusted_device`), with no manually-run editor
counterpart at all, unlike every prior PXP-1..7 entity. **PIN
(`PatientCredential`) is explicitly out of scope for this batch** — docs/45 Part 5's
finding that it "requires its own dedicated security review... independent of Trusted
Device/Long-Lived Session" remains an open gate, unchanged. docs/44 §5.5's
implementation-time question (whether Long-Lived Session touches the frozen
`FoundationSession.gs`) is resolved as an additive wrapper: `TrustedDevice.gs`'s
`foundationIssueLongLivedSessionToken_()` reuses that file's own unmodified signing
primitives with a longer, local TTL constant (14 days, materially longer than the
default 60-minute Session) — **zero lines changed in `FoundationSession.gs`,
`FoundationRouteGuard.gs`, or `session.schema.json`**, verified directly in
`validation/phase-2a-foundation/conformance.js`'s new Stage 16 (a magic-link-issued
session still carries exactly its unchanged 3600-second TTL). The device token
(90-day sliding expiry) rotates on every successful presentation
(`consume_trusted_device`, unauthenticated — the token itself is the credential),
which is also this design's "session renewal" mechanic — no separate renew action
exists. Four new, additive `FoundationRouter.gs` dispatch cases
(`mark_device_trusted`, `consume_trusted_device`, `get_trusted_devices`,
`revoke_trusted_device`) register the capability; no Module Registry entry was added —
Persistent Authentication is infrastructure available to every patient, mirroring
Patient Profile's own plain-nav-link precedent, not a doctor-enabled dashboard module.
**Disclosed, deliberately minimized frozen-file footprint:** `login.html` (the one
universal silent-recovery point every session-guarded page's existing redirect already
lands on), `verify.html` (an opt-in, unchecked-by-default "Keep me signed in on this
device" checkbox), and `my-health-journey/index.html` (one new "Manage Devices" nav
link, mirroring PXP-1's own "My Profile" link exception exactly, plus one mechanical,
disclosed update to `validation/pa-2-dashboard/browser-test.js`'s own keyboard-Tab-order
assertion). **`my-health-journey/dashboard.js` and `my-health-journey/session-guard.js`
are both completely untouched** (`git diff --stat` empty on both) — a deliberate design
choice to route all silent recovery through `login.html` alone rather than touching
every page that might redirect there. A disclosed, honest limitation, not an oversight:
since `FoundationSession.gs` stays untouched and stateless (no revocation list),
revoking a `TrustedDevice` stops it from renewing again but cannot retroactively kill an
already-issued Long-Lived Session token still held client-side, which simply expires
naturally within 14 days (full reasoning: `shared/schemas/trusted-device.md`). A patient
who never opts into Trusted Device experiences no behavior change at all — Magic Link
alone remains the complete, unconditional default (docs/44 §5.2). Zero modification to
any frozen Foundation/Identity & Access/Patient Access/PXP-1..7 file beyond the three
disclosed exceptions above.

**PXP-9 (AI Integration) is intentionally skipped, not built.** docs/44 §22 names it a
*"reserved placeholder"* with nothing concrete to implement and docs/45 independently
confirms it is *"correctly not ready for any scoping at all"* — building anything under
that name would mean inventing an unapproved AI feature outside the ADR-001/004/005/013
gate docs/44 §15 requires before any such feature is even designed. No code, schema, or
documentation exists for PXP-9; it remains reserved for a future, separately-proposed
and separately-approved AI Integration batch.

**Batch PXP-10 (Symptom Tracker Migration, docs/44 §10.1/§22, docs/47)** — has now
shipped, built directly after PXP-8 since it depends only on Daily Check-in (PXP-5)
being proven in production, not on PXP-9. Retires Symptom Tracker's dashboard entry now
that Daily Check-in (§10.3) is its proven successor: the `symptom_tracker` Module
Registry entry is removed from all three hand-ported copies
(`shared/constants/module-registry.json`, `apps-script/ModuleRegistry.gs`,
`my-health-journey/dashboard.js`), which is sufficient on its own to stop the card
rendering, since the dashboard has been fully registry-driven since PXP-4 — zero change
to `renderDashboard()`/`filterEnabledModules()`/`dispatchLoaders()`. Symptom Tracker's
own dead card-rendering code (quick-log form, summary, condition options) is removed
from `dashboard.js` in the same change. **`log_symptom`/`get_symptom_logs`
(`apps-script/FoundationSymptomLog.gs`, `FoundationRouter.gs`'s existing dispatch
cases) are deprecated by documentation disclosure only — zero lines changed in either
frozen Phase 2A file**, mirroring PXP-8's own "zero lines changed in a frozen file"
discipline; both routes stay fully functional, no breaking API contract (docs/47 §6).
**`SymptomLogs` rows are retained permanently, exactly as docs/44 §10.1/§19 already
promised** — no row is touched, migrated, or deleted. The standalone Symptom History
page (`my-health-journey/symptoms/`) is unchanged and still reachable by direct URL; it
is simply no longer linked from the dashboard, since its only link lived inside the
now-removed card — a disclosed, deliberate scope boundary (full reasoning:
`shared/constants/module-registry.md`'s "Batch PXP-10 removal" section,
`shared/schemas/symptom-log.md`'s "Deprecated" section). Zero modification to any
frozen Foundation/Identity & Access/Patient Access file beyond the disclosed,
documentation-only touches above.

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

**Implementation is complete: Batch PXP-1 (Patient Profile), Batch PXP-2
(Doctor-Assigned Conditions), Batch PXP-3 (Module Registry), Batch PXP-4
(Dashboard Registry), Batch PXP-5 (Daily Check-in Engine), Batch PXP-6
(Calculator Registry, backend only), Batch PXP-7 (Personal Care Plan),
Batch PXP-8 (Trusted Device + Long-Lived Session, PIN out of scope),
Batch PXP-10 (Symptom Tracker Migration), and Batch PXP-11 (Closeout) are
all explicitly approved and shipped; no batch beyond PXP-11 is authorized by
any of the above documents.** docs/44 §22 sequences **infrastructure before
features**:
Patient Profile → Doctor-Assigned Conditions → Module Registry → Dashboard
Registry → Daily Check-in Engine → Calculator Registry → Personal Care
Plan → Trusted Device + Long-Lived Session + Optional PIN → a reserved,
unscoped "AI Integration" placeholder — plus Symptom Tracker Migration and
Closeout, eleven named batch slots (PXP-1 through PXP-11 — renamed from
PCP-1 through PCP-11 for platform-wide naming consistency, no scope
change), ten shipped and one (PXP-9) intentionally left unbuilt.
**PXP-9 (AI Integration) remains unbuilt, per its own "reserved
placeholder, not ready for any scoping at all" status (docs/44 §22,
docs/45)** — PXP-10 (Symptom Tracker Migration) was approved and shipped
directly after PXP-8, out of the sequence's numeric order but not out of
its dependency order, since docs/44 §22's own dependency column names only
"PXP-5 proven in production" as PXP-10's prerequisite, not PXP-9. No batch
numbers were renumbered; PXP-9's slot stays reserved for a future,
separately-approved AI Integration proposal. **Batch PXP-11 (Closeout,
2026-07-15, docs/48-PHASE-2B-CLOSEOUT.md)** re-ran every validation suite
fresh as one platform (710 checks across 13 suites, 0 failures), performed
docs/47 §14's repository consistency review, and found and fixed three
genuine, disclosed, documentation-only inconsistencies in
docs/33-DOMAIN-MODEL.md (stale status tags, §5 of docs/48) — no code,
schema, or architecture changed. **Phase 2B is now closed and frozen except
for genuine bug fixes.**
Digital Twin is explicitly **not** part of this sequence — it remains a
later roadmap consumer of Timeline, Reports, Check-ins, Care Plans, and
Calculators (Phase 2D), not tightly coupled to Phase 2B's implementation.
Any future batch (a real PXP-9 design, or Phase 2C) requires its own
separate, explicit approval, per docs/47 §9's per-batch gate — the same
gate every batch through PXP-11 already passed through. docs/45 Part 5
flagged the optional-PIN sub-batch (within PXP-8) as requiring a dedicated
security review before it specifically could be approved, independent of
the rest of the plan — **that gate remains open and unbuilt; PXP-8's
shipped scope explicitly excluded PIN**, per that same finding, unchanged
by Phase 2B's closeout. The Public (no-login) Calculator variant remains an
unclaimed roadmap gap (docs/46 Part 3) — only the Patient variant is
claimed by this phase (and only its backend, Batch PXP-6).

# Phase 2C — Health Milestones
Status: **Architecture frozen (2026-07-16, docs/58-PHASE-2C-HEALTH-MILESTONES-ARCHITECTURE-FREEZE.md,
Version 1.0; ADR-027) — implementation NOT yet authorized.** The dedicated, feature-scoped
architecture-freeze pass docs/24/docs/48 §1/§7 required before Phase 2C could be taken up
has now been performed, the identical single-feature-freeze discipline docs/55 (AI Assistant)
and docs/56 (Holoscan) already followed, adapted here for a **non-AI, patient-facing** feature.
**The freeze does not authorize implementation** — a separate, explicit approval naming the
Phase 2C batch is still required, mirroring docs/53 §9/§13/§15 exactly.

- Scheduled progress reviews (30/90 days, 6 months, 1 year, per docs/21) — now defined as
  four fixed **care-start-anchored** points, each a **doctor-authored, patient-viewable-when-
  published** progress review of the six dimensions docs/21 names (progress, improvements,
  medicines, investigations, recommendations, next goals). docs/58 §11 designs two new
  Sheet-backed entities (`MilestoneTrack`, the per-patient doctor-set care-start anchor;
  `MilestoneReview`, the doctor-authored review) plus one **computed** Milestone Schedule
  (never a stored table, mirroring Analytics/Digital Twin) — all *Designed*, none implemented.
- No AI required — deliberately separated from Phase 2D, which carries the
  platform's AI-supervised work. **ADR-027 makes this permanent and statically enforced**:
  Health Milestones generates no AI content, makes no model call, and marks a milestone
  `completed` only when a doctor publishes its review, never on elapsed time alone.
- Named-but-unbuilt future integrations (docs/58 §12), each requiring its own separate
  approval: a `TimelineEvent:milestone` source (the same frozen-`entry_type`-enum deferral
  Care Plan and Holoscan already made), a `Notification` "milestone due" prompt, and a Digital
  Twin (Phase 2D) input. Five new router dispatch cases, two new registry entries (patient
  `health_milestones`; doctor `milestone_review`, **normal rollout — not disabled-by-default**,
  since it reviews doctor-authored content, not model output), and two new dashboard cards are
  named, none built (docs/58 §17–§19).

# Phase 2D — Wise Digital Twin & AI Summaries
- Health Story
- AI Summaries
- Progress Analytics

Requires the full ADR-001/ADR-004/ADR-005 AI-supervision pattern before
any implementation begins.

# Phase 3 — WHIMS Patient Intelligence Platform (formerly "WiseOS")
Status: **Closed (Batch WPI-12 Closeout, 2026-07-16, docs/57-PHASE-3-CLOSEOUT.md) —
frozen except for genuine bug fixes.** Architecture freeze complete (Version 1.0,
2026-07-16). Implementation
history: Batch WPI-1 (Doctor Identity & Session) shipped 2026-07-16, Batch WPI-2
(Specialty Registry) shipped 2026-07-16, Batch WPI-3 (Doctor Module Registry,
backend) shipped 2026-07-16, Batch WPI-4 (Doctor Dashboard, frontend consumer)
shipped 2026-07-16, Batch WPI-5 (Appointment) shipped 2026-07-16, Batch WPI-6
(Notification, unification) shipped 2026-07-16, Batch WPI-7 (Inventory) shipped
2026-07-16, Batch WPI-8 (PillFill Integration) shipped 2026-07-16, Batch WPI-9
(Analytics) shipped 2026-07-16, and Batch WPI-10 (AI Assistant) shipped 2026-07-16,
each explicitly approved and scoped to its own batch only. **WPI-10's own dedicated
architecture was frozen first** (docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-FREEZE.md,
ADR-021/022/023, 2026-07-16), then separately, explicitly approved for implementation,
per docs/53 §9/§13/§15 — the same Architecture Freeze → Implementation → Validation →
Closeout → Release sequence every prior WPI batch already followed. **WPI-11's own
dedicated architecture has now also been frozen** (docs/56-WPI-11-HOLOSCAN-
ARCHITECTURE-FREEZE.md, ADR-024/025/026, 2026-07-16) — Holoscan is now defined as the
Patient Medication Recognition Engine, replacing its prior "reserved, unscoped
placeholder" status. **No batch's implementation beyond WPI-10 (WPI-11 onward) is
authorized to begin — WPI-11's own architecture freeze does not itself authorize its
implementation, per docs/53 §9/§13/§15, unchanged.**

Renamed from "WiseOS" per this architecture-freeze pass (docs/49 §2) — no scope
change from the rename itself. **Reordered ahead of Phase 2C (Health Milestones) and
Phase 2D (Digital Twin & AI Summaries)** on dependency grounds, not roadmap position,
the same test Batch PXP-10 already passed when it shipped ahead of PXP-9 (docs/49 §1):
none of Doctor Dashboard, Inventory, PillFill Integration, or Analytics depend on
Health Milestones or the Digital Twin existing first, and Doctor Identity specifically
repays a gap every doctor-owned Phase 2B entity has disclosed since Batch PXP-2 ("no
real Doctor identity/authentication exists yet"). **Phase 2C and Phase 2D remain fully
open, unscoped, and unaffected by this reordering** — each still requires its own
separate architecture-freeze pass whenever next taken up.

Architecture: docs/49-PHASE-3-ARCHITECTURE-REVIEW.md (vision, scope decision, four
pillars), docs/50-PHASE-3-TECHNICAL-PLAN.md (entity-level design),
docs/51-PHASE-3-ARCHITECTURE-READINESS-REVIEW.md (critique), docs/52-PHASE-3-
REPOSITORY-CONSISTENCY-REVIEW.md (consistency check), docs/53-PHASE-3-IMPLEMENTATION-
RULES.md (permanent per-batch governance standard), docs/54-SHEETS-PRODUCTION-SCALE-
REVIEW.md (the dedicated capacity review closing the WPI-7/WPI-9 Sheets-at-scale gate),
and four new ADRs: ADR-017 (Doctor Identity), ADR-018 (Specialty-Scoped Registries),
ADR-019 (AI/Advanced Extension Points Reserved Platform-Wide), ADR-020 (Doctor
Dashboard Registry-Driven).

**Four pillars** (docs/49 §4): Doctor Identity & Access, Doctor-Facing
Registry-Driven Capabilities, Specialty-Scoped Extensibility, and Reserved AI/Advanced
Extension Points — with Inventory, PillFill Integration, and Analytics as consumers,
not pillars in their own right.

**Twelve named batch slots** (docs/50 §19, prefixed `WPI-` for "WHIMS Patient
Intelligence" batch, mirroring exactly how `PXP-` was derived for Phase 2B),
infrastructure before features: WPI-1 (Doctor Identity & Session) → WPI-2 (Specialty
Registry) → WPI-3 (Doctor Module Registry, backend) → WPI-4 (Doctor Dashboard,
frontend consumer) → WPI-5 (Appointment) → WPI-6 (Notification) → WPI-7 (Inventory) →
WPI-8 (PillFill Integration) → WPI-9 (Analytics) → WPI-10 (AI Assistant — **architecture
frozen** (docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-FREEZE.md, ADR-021/022/023),
**implemented** — disabled by default per ADR-023, doctor-facing only, seeded with one
capability, `summarize_patient_status`) → WPI-11 (Holoscan — **architecture frozen**
(docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md, ADR-024/025/026), defined as the
Patient Medication Recognition Engine, **implemented** as a post-Phase-3-closure batch,
disabled by default for the doctor-facing review surface per ADR-026) → WPI-12
(Closeout).

**No WPI batch beyond WPI-10 is authorized to begin by any of the above documents.**
Each requires its own separate, explicit approval, per docs/53's per-batch gate — the
same discipline every Phase 2B batch already passed through. Two documentation-only
closures identified by docs/51's readiness review were resolved within this same
version (docs/52 §1.1/Part 5): the "WiseOS" cross-reference in docs/33 §1.4, and an
explicit disclosure of the patient-roster derivation's limitation at
multi-doctor-per-specialty scale (docs/50 §7.4). The Sheets-at-production-scale
question (docs/49 §7), named as a gate before WPI-7/WPI-9 specifically (docs/51 Part 3
item 1/Part 5, docs/52), is now **closed by docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md
(2026-07-08)** — Green zone at clinic launch and Year 1, Yellow-adjacent (not Red)
through Year 5 projections, conditional on WPI-7 shipping docs/54 §19's required
`LockService` mitigation for `InventoryItem.quantity_on_hand`. **This closes the named
pre-condition only — it does not itself authorize WPI-7 (or WPI-9) to begin; each still
requires its own separate, explicit approval per docs/53 §13, unchanged.**

**Batch WPI-1 (Doctor Identity & Session, docs/50 §5, ADR-017)** — Pillar 1, the
platform's first doctor-facing infrastructure batch — has now shipped, preceded by a
dedicated `DoctorSession` security review (`shared/schemas/doctor-session.md`) per
docs/50 §14/docs/51/docs/52's own explicit, non-deferrable pre-ship gate (a deliberate
correction to Phase 2A's own equivalent review only happening at PA-7 closeout, after
Session had already shipped). `DoctorIdentity`/`Doctor`/`DoctorSession`/
`DoctorLoginToken` (`shared/schemas/doctor-identity.schema.json`,
`doctor-session.schema.json`, `doctor-login-token.schema.json`;
`apps-script/DoctorIdentity.gs`, `DoctorSession.gs`, `DoctorLoginTokens.gs`,
`DoctorEmail.gs`, `DoctorLoginFlow.gs`, `DoctorRouteGuard.gs`) mirror Patient Identity/
Session/LoginTokens structurally, permanently separate per ADR-017 — staff/
administrative provisioning only (`createFoundationDoctor()`, no public
self-registration), the same passwordless magic-link mechanism ADR-003 already
establishes for patients. `DoctorSession` reuses `FoundationSession.gs`'s signing
secret and HMAC primitive unchanged — zero lines touched in that frozen file, the same
"additive wrapper" pattern `TrustedDevice.gs`'s Long-Lived Session already proved out at
Batch PXP-8. Cross-identity-type authorization confusion (a Doctor Session authorizing a
patient route, or vice versa) is structurally prevented by disjoint payload shapes, not
merely asserted — proven directly by `validation/phase-2a-foundation/conformance.js`'s
new Stage 17 (37 new checks, 461/461 total passing). Three new, additive
`FoundationRouter.gs` dispatch cases (`request_doctor_login_link`,
`consume_doctor_login_link`, `get_doctor_profile`) register the flow — `get_doctor_profile`
is the doctor-side proof point mirroring `get_profile`'s own role at Batch IA-2. **Zero
patient-facing surface, zero doctor-facing frontend page** (the Doctor Dashboard is
WPI-4's scope, not WPI-1's) — every doctor-owned Phase 2B entity's schema is
unchanged; only a future, separately-approved batch migrates any of their write paths
onto a real `doctor_id`. Zero modification to any frozen Foundation/Identity &
Access/Patient Access/PXP-1..11 file. **No batch beyond WPI-1 is authorized by this
approval.**

**Batch WPI-2 (Specialty Registry, docs/50 §6, ADR-018)** — Pillar 3, independent of
WPI-1 — has now shipped: `Specialty` (`shared/constants/specialty-registry.json`,
`apps-script/SpecialtyRegistry.gs`), seeded with exactly one entry (`homeopathy`), the
platform's current, implicit specialty named explicitly for the first time. Also ships
the Condition-to-Specialty Map (`shared/constants/condition-specialty-map.json`) docs/50
§6.3 named but did not design — resolved at this batch per docs/51 Part 1.4's own
recommendation, mapping every real condition slug (`shared/constants/
condition-slugs.json`) to `homeopathy`, with a fail-open-to-default fallback for any
unmapped slug. **Does not add a populated `specialty_scope` entry to Module Registry,
Calculator Registry, or Template Registry** — none has a second specialty's entry to
scope yet (docs/53 §4: each registry adopts the field independently, at whichever
future WPI batch actually needs it for that specific registry) — `shared/constants/
module-registry.json`, `calculator-registry.json`, `template-registry.json`, and their
Apps Script counterparts (`ModuleRegistry.gs`, `CalculatorRegistry.gs`,
`TemplateRegistry.gs`) are all untouched, zero lines, per docs/50 §3. `Doctor.
specialty_slug` (WPI-1) is not retroactively validated against this new registry in
this batch — `apps-script/DoctorIdentity.gs` is itself a frozen WPI-1 file; wiring that
validation is a disclosed, deferred decision for a future batch. Zero patient-facing
surface, zero doctor-facing frontend page, no new `FoundationRouter.gs` dispatch case
(no consumer exists yet — the Doctor Dashboard is WPI-3/WPI-4's scope), zero
modification to any frozen Foundation/Identity & Access/Patient Access/PXP-1..11/WPI-1
file. **No batch beyond WPI-2 is authorized by this approval.**

**Batch WPI-3 (Doctor Module Registry, backend, docs/50 §7.1/§7.2, ADR-020)** —
Pillar 2, dependent on WPI-1 (needs `doctor_id` to key enablement) — has now shipped:
`DoctorModuleRegistry` (`shared/constants/doctor-module-registry.json`,
`apps-script/DoctorModuleRegistry.gs`) and `DoctorModuleState`
(`shared/schemas/doctor-module-state.schema.json`,
`apps-script/DoctorModuleState.gs`), structurally parallel to Module Registry/Patient
Module State (docs/33 §6.3) but a separate registry and enablement table — never
merged with the patient-facing ones (ADR-020, docs/53 §2). **Ships empty** — no
concrete doctor-facing capability (patient roster, condition assignment, care-plan
authoring, module/calculator/template enablement, inventory, PillFill orders,
analytics) is registered here; this batch delivers only the generic
registry-and-state mechanism, the same disclosed "mechanism before any concrete
instance" precedent `calculator-registry.json` (Batch PXP-6) already established, no
doctor-facing capability yet having a real, authenticated `data_source` route for a
registry entry to point at. `DoctorModuleState` is fail-closed by absence of a row
(ADR-010), staff/administrative-owned only (`setFoundationDoctorModuleState()`, a
manually-run editor function mirroring `setFoundationModuleState()` exactly — every
real invocation is rejected with `FOUNDATION_INVALID_INPUT` today, since the registry
ships empty, a disclosed consequence, not a defect). One new, additive
`FoundationRouter.gs` dispatch case (`get_doctor_module_states`) — read-only,
`doctor_id` derived only from a verified `DoctorSession`, mirroring
`get_patient_module_states`'s exact WPI-1/PXP-3-era precedent, including a direct,
conformance-proven rejection of a real Patient Session token presented to this
doctor-scoped route. Zero patient-facing surface, zero doctor-facing frontend page
(the Doctor Dashboard is WPI-4's scope, not WPI-3's) — Module Registry, Calculator
Registry, Template Registry, and Specialty Registry are all untouched, zero lines.
Zero modification to any frozen Foundation/Identity & Access/Patient
Access/PXP-1..11/WPI-1/WPI-2 file. **No batch beyond WPI-3 is authorized by this
approval.**

**Batch WPI-4 (Doctor Dashboard, frontend consumer, docs/50 §7.3/§7.4/§19, ADR-020)**
— Pillar 2's frontend consumer half, dependent on WPI-3 — has now shipped: a new,
authenticated, doctor-facing page (`doctor-dashboard/index.html` + `dashboard.js`) is
now a registry-driven consumer of WPI-3's Doctor Module Registry plus
`DoctorModuleState`, structurally parallel to `my-health-journey/dashboard.js`'s own
post-PXP-4 discipline — every card corresponds to a registry entry the doctor is
enabled for; there is no hardcoded per-capability rendering logic in
`renderDashboard()`. This batch registers the Doctor Module Registry's first real
entry, `patient_roster` (`shared/constants/doctor-module-registry.json` version
1.0.0 → 1.1.0), implementing docs/50 §7.4's derived patient roster exactly: a new,
read-only, `DoctorSession`-authenticated route (`get_doctor_patient_roster`,
`apps-script/DoctorPatientRoster.gs`) returns every distinct patient with at least one
active Doctor Assigned Condition whose `condition_slug` maps (via WPI-2's
Condition-to-Specialty Map) to the doctor's own `specialty_slug` — no new stored
entity, exactly docs/50 §7.4's "derived, not a new entity" design, including its own
disclosed multi-doctor-per-specialty limitation (docs/51 Part 1.6), unaffected by this
batch. **Disclosed, additive prerequisite beyond docs/50 §19's literal scope:**
reaching an authenticated Doctor Dashboard requires a doctor-facing login flow, which
no earlier batch built a frontend for (WPI-1 shipped only the backend routes, with
"zero doctor-facing frontend page" explicitly named as that batch's own boundary).
This batch adds `doctor-login.html`/`doctor-verify.html` (root, `noindex`, mirroring
`login.html`/`verify.html` exactly, minus the Trusted Device mechanism, which has no
doctor-side equivalent) as the minimal, necessary path to the dashboard this batch
itself introduces — the same kind of implementation-time plumbing decision docs/50 §8
already left open for Appointment's own intake mechanism, disclosed here rather than
silently assumed. `DoctorModuleState` enablement remains staff/administrative-only
(WPI-3's `setFoundationDoctorModuleState()`, unchanged) — a doctor sees the Patient
Roster card only once staff explicitly enables it for that doctor, the same
fail-closed-by-absence default every other module/capability enablement mechanism on
the platform already uses. Zero modification to any frozen Foundation/Identity &
Access/Patient Access/PXP-1..11/WPI-1..3 file — `my-health-journey/` is completely
untouched. **No batch beyond WPI-4 is authorized by this approval.**

**Batch WPI-5 (Appointment, docs/50 §8/§19)** — a consumer of Pillars 1 and 2, closing
docs/20 §3's "THE GAP" between a public booking-form submission and the platform's own
patient-facing history for the first time — has now shipped: `Appointment`
(`shared/schemas/appointment.schema.json`, `apps-script/Appointment.gs`),
staff/doctor-facing only, exactly as docs/50 §8 scoped it — no patient-facing
Appointment UI exists. `patient_id`/`doctor_id` are nullable, empty-string-sentinel
fields (a first-time visitor has no Patient Identity yet, and no Doctor is assigned
until confirmed), validated against a real Patient Identity/Doctor when supplied.
`specialty_slug` is server-derived once, at creation, from `condition_slug` via WPI-2's
Condition-to-Specialty Map (ADR-018) — never staff-supplied directly. Lifecycle is
one-way and exactly-once: `requested` → `confirmed` (assigns a real
`doctor_id`/`scheduled_at`) → `completed`, or `requested`/`confirmed` → `cancelled`,
mirroring `DoctorInstruction.gs`'s own one-way-transition discipline. **Disclosed,
implementation-time intake decision:** docs/50 §8 deliberately leaves open how a
`contact.html`/Netlify Forms booking submission becomes a real `Appointment` row; this
batch resolves it as a staff-run tool (`createFoundationAppointment()`), a manually-run
Apps Script editor function mirroring `DoctorAssignedCondition.gs`'s
`assignFoundationCondition()` precedent exactly — not a new, unauthenticated public
write endpoint. Every write (creation, confirmation, status transitions) remains a
manually-run Apps Script editor function; there is no create/confirm/status-update
route reachable over HTTP. One new, additive, read-only `FoundationRouter.gs` dispatch
case (`get_doctor_appointments`) returns the caller's own specialty-derived Appointments
view, `doctor_id` always `DoctorSession`-derived — the same specialty-derivation
discipline WPI-4's `DoctorPatientRoster.gs` already established, including its own
disclosed multi-doctor-per-specialty limitation (docs/50 §7.4, docs/51 Part 1.6). The
Doctor Dashboard's Doctor Module Registry gains its second real entry, `appointments`
(`shared/constants/doctor-module-registry.json` version 1.1.0 → 1.2.0,
`display_order: 20`) — the Doctor Dashboard (`doctor-dashboard/dashboard.js`) renders
one new, read-only card, structurally parallel to the Patient Roster card, no write
affordance. Zero modification to any frozen Foundation/Identity & Access/Patient
Access/PXP-1..11/WPI-1..4 file. **No batch beyond WPI-5 is authorized by this
approval.**

**Batch WPI-6 (Notification, unification, docs/50 §9/§19)** — a consumer with no
structural dependency on any prior WPI batch, sequenced after WPI-5 purely so
Appointment's own future reminder flow can adopt it from day one — has also now
shipped: `Notification` (`shared/schemas/notification.schema.json`,
`apps-script/Notification.gs`) promotes docs/33 §4.2 from *Designed* to
*Implemented*, exactly as docs/50 §9 scoped it — **a shared record of what was sent,
never a new delivery pipeline.** Every existing sender keeps its own transport code,
gate logic, and return values completely unchanged; each gains exactly one additional,
disclosed statement recording its own already-completed send attempt as a
Notification row. Three currently-real sender flows are unified in this batch:
`apps-script/FoundationLoginFlow.gs`'s patient login-link email, `apps-script/
DoctorLoginFlow.gs`'s doctor login-link email (WPI-1), and Phase 1.5's
`apps-script/Send.gs` visit-summary email — the two future flows docs/50 §9 also
names (Inventory low-stock, PillFill order-status) do not exist yet and adopt the
same mechanism when WPI-7/WPI-8 build them. **`patient_id`/`doctor_id` are both
nullable (empty-string sentinel), mirroring `Appointment`'s own convention — never
both non-empty on the same row.** A disclosed, additive `recipient_email` fallback
field (beyond docs/50 §9's literal attribute list) covers Phase 1.5's visit-summary
flow, which predates Patient Identity entirely and has no `patient_id` of any kind to
reference — the same category of implementation-time field-level decision
`Appointment.gs`'s `created_by` already made. **Ownership: system-generated only,
mirroring Session's own ownership model (docs/50 §9's own words)** — no manually-run
editor function, and **zero `FoundationRouter.gs` dispatch case ships in this
batch** (a deliberate, disclosed scope decision: this entity mirrors `Session`'s
"no get-my-session route either" precedent, not `CalculatorResult`'s "backend only,
but still routed" one). Two internal-only read helpers
(`foundationGetNotificationsForPatient_`/`foundationGetNotificationsForDoctor_`)
satisfy docs/53 §5's create/read requirement and are exercised directly by the
conformance harness's new Stage 22 — neither is reachable over HTTP yet, the same
"read primitive exists, no route wraps it yet" shape `foundationDsQuery_()` itself
had before Batch IA-2. **Disclosed, additive touch to three existing sender
files** (`FoundationLoginFlow.gs`, `DoctorLoginFlow.gs`, both otherwise
frozen; `Send.gs`, Phase 1.5's own file, gaining its first-ever dependency on a
Foundation-family function, reachable only because both domains share one Apps
Script project per docs/29 §14 Decision 1) — the same "authorized migration when the
batch's own architecture literally requires it" precedent `PXP-4`/`WPI-4` already
established for a frozen file, here applied across three files instead of one, since
docs/51 Part 3 item 5 named this exact "modest, but real" cross-cutting scope as
sound and expected for this batch. `validation/phase-1-5/harness.js`/`validate.js`
(Phase 1.5's own, previously Foundation-independent test tooling) and `validation/
phase-2a-foundation/harness.js`/`conformance.js` are both extended accordingly — the
former's own stated "stays scoped to Phase 1.5's files" discipline gains its one
disclosed exception, forced by this batch's cross-domain design, not a silent scope
drift. Zero modification to any frozen Foundation/Identity & Access/Patient
Access/PXP-1..11/WPI-1..5 file beyond the three disclosed sender-file exceptions
above. **No batch beyond WPI-6 is authorized by this approval.**

**Batch WPI-7 (Inventory, docs/50 §10/§19)** — a consumer of Doctor Instruction (indirectly,
via the future PillFill Integration batch) with dependencies on WPI-4 (Doctor Dashboard
capability) and WPI-6 (low-stock Notification), both already shipped — has also now
shipped, preceded by **docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md (2026-07-08)** closing
the Sheets-at-production-scale gate docs/49 §7/docs/51 Part 3 item 1/Part 5 named
specifically for this batch. `InventoryItem`
(`shared/schemas/inventory-item.schema.json`, `apps-script/InventoryItem.gs`) and
`InventoryTransaction` (`shared/schemas/inventory-transaction.schema.json`,
`apps-script/InventoryTransaction.gs`) ship exactly as docs/50 §10 designed:
`quantity_on_hand` is a derived/cached value, never accepted from a create/update
request, recomputed in full from the append-only ledger's own `change_qty` rows every
time a transaction is recorded — never a cached-value-plus-delta update, the same
recovery-strategy discipline docs/54 §13 names. **The platform's first use of
`LockService`** (docs/54 §7/§18/§19's required mitigation) wraps the entire
append-then-recompute-then-cache-write sequence; a contended lock returns a new,
expected `FOUNDATION_LOCK_UNAVAILABLE` envelope and performs no write at all — additive
only, zero change to `FoundationDataStore.gs` or any other frozen file.
`InventoryTransaction.gs` is strictly append-only, with no update/patch call anywhere in
its own implementation targeting its own ledger sheet, per docs/54 §19's explicit
requirement. Doctor/staff-owned, never patient-facing — every write (item creation,
retirement, threshold updates, and every stock-movement transaction) remains a
manually-run Apps Script editor function, mirroring `Appointment.gs`'s/`CarePlan.gs`'s
precedent exactly, a deliberate continuation of every prior WPI batch's
"doctor/staff-owned entity writes stay manually-run" discipline even though a real
`DoctorSession` already exists (WPI-1). One new, additive, read-only
`FoundationRouter.gs` dispatch case (`get_inventory_items`) returns the caller's own
specialty-scoped, active `InventoryItem` list, enriched with a computed `low_stock`
boolean — the same specialty-derivation discipline `DoctorPatientRoster.gs`'s patient
roster and `Appointment.gs`'s appointments view already established. The Doctor
Dashboard's Doctor Module Registry gains its third real entry, `inventory`
(`shared/constants/doctor-module-registry.json` version 1.2.0 → 1.3.0,
`display_order: 30`) — the Doctor Dashboard (`doctor-dashboard/dashboard.js`) renders
one new, read-only card, structurally parallel to the Patient Roster/Appointments
cards, no write affordance. Crossing `reorder_threshold` records an
`inventory_low_stock` Notification via `Notification.gs`'s own existing, unmodified
mechanism (WPI-6) — a new call site adopting an already-designed extension point, zero
lines changed in `Notification.gs` itself; `doctor_id` is set to the transaction's own
`created_by`, and no real email transport is built for this alert in this batch, a
disclosed, minimal choice (`shared/schemas/inventory-transaction.md`). This batch's own
repository consistency review also corrected three pre-existing stale section headers
in `docs/33-DOMAIN-MODEL.md` (Doctor §1.4, Appointment §4.1, Notification §4.2, each
still reading *Conceptual (gap)* despite being promoted to *Implemented* by earlier
batches) and a companion `shared/constants/doctor-module-registry.md` that had not been
updated since Batch WPI-4 despite Batch WPI-5's own real JSON/`.gs` change — no entity's
shape, schema, or shipped behavior changed by any of these corrections. Zero
modification to any frozen Foundation/Identity & Access/Patient
Access/PXP-1..11/WPI-1..6 file. **No batch beyond WPI-7 is authorized by this
approval.**

**Batch WPI-8 (PillFill Integration, docs/50 §11/§19)** — a consumer of Inventory
(draws down `InventoryItem` on fulfillment) and the already-shipped `DoctorInstruction`
(PXP-7), with WPI-7 as its one dependency, already shipped — has also now shipped:
`PillFillOrder` (`shared/schemas/pillfill-order.schema.json`,
`apps-script/PillFillOrder.gs`) connects a `medicine`-type Doctor Instruction (docs/33
§2.3's "Prescription is a `medicine`-type Doctor Instruction" mapping) to fulfillment,
ships exactly as docs/50 §11 designed, plus one disclosed, additive `created_by`
provenance field mirroring `appointment.schema.json`'s/`inventory-item.schema.json`'s
own precedent. Doctor/staff-owned, never patient-facing — every write (order creation,
the dedicated fulfill operation, and every other status transition) remains a
manually-run Apps Script editor function, mirroring `Appointment.gs`'s/
`InventoryItem.gs`'s precedent exactly, the same "doctor/staff-owned entity writes stay
manually-run" discipline every prior WPI batch has continued even though a real
`DoctorSession` already exists. **The one operation with side effects,**
`foundationFulfillPillFillOrder_()`, reuses `InventoryTransaction.gs`'s existing,
unmodified `foundationRecordInventoryTransaction_()` (reason `dispense`) — the platform's
first real, non-manual trigger for that function's `LockService` critical section
(docs/54 §7/§17's own "the concrete trigger for this becoming real, not just
theoretical") — and `Notification.gs`'s existing, unmodified
`foundationRecordNotification_()` (type `pillfill_order_status`), reusing both
mechanisms rather than inventing parallel ones; if the InventoryTransaction call fails
for any reason, including a contended lock, the order's own status is never touched, no
partial fulfillment. Once fulfilled, an order can no longer be cancelled — a disclosed
boundary, docs/50 §11 designs no reversal mechanism. `PillFillOrder` carries no
`specialty_slug` of its own; one new, additive, read-only `FoundationRouter.gs` dispatch
case (`get_pillfill_orders`) returns the caller's own PillFill Orders, specialty-scoped
by joining each order to its own referenced `InventoryItem` — the same
specialty-derivation discipline `InventoryItem.gs`'s own view already established. The
Doctor Dashboard's Doctor Module Registry gains its fourth real entry,
`pillfill_orders` (`shared/constants/doctor-module-registry.json` version 1.3.0 →
1.4.0, `display_order: 40`) — the Doctor Dashboard (`doctor-dashboard/dashboard.js`)
renders one new, read-only card, structurally parallel to the Patient
Roster/Appointments/Inventory cards, no write affordance. No external PillFill vendor
API, webhook, or integration contract is designed or built — this batch is the
platform's own internal order-and-fulfillment record only (docs/50 §11's own explicit
restraint). Zero modification to any frozen Foundation/Identity & Access/Patient
Access/PXP-1..11/WPI-1..7 file. **No batch beyond WPI-8 is authorized by this
approval.**

**Batch WPI-9 (Analytics, docs/50 §12/§19)** — a consumer of Doctor Dashboard (WPI-4),
benefiting from Inventory (WPI-7) and PillFill Integration (WPI-8) without strictly
requiring either, gated on docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md's own Sheets-at-
scale review — has now shipped: `apps-script/Analytics.gs`, a computed, read-only
aggregate view, never a stored entity and never a base table (docs/50 §12, docs/33
§7.6), reading across `CheckInResponse`, `CalculatorResult`, `CarePlan`,
`DoctorAssignedCondition` (via `DoctorPatientRoster.gs`'s own derivation, reused, not
re-implemented), `InventoryItem`/`InventoryTransaction`, `PillFillOrder`, and
`Appointment` — every entity docs/50 §12 names, and no other. Every report section
(check-in completion, care plan activity, calculator/module engagement, inventory
turnover, PillFill fulfillment, appointment conversion) is a deterministic count/sum/
rate over already-stored rows — never an AI-generated interpretation, prediction, or
recommendation (docs/50 §12's own hard boundary, ADR-001/004/005/019 unaffected).
Bounded to a fixed trailing 30-day window, never "all history" — the forward
constraint docs/54 §18 item 4 named for this batch specifically. Doctor/staff-facing
only, never patient-facing. One new, additive, read-only `FoundationRouter.gs`
dispatch case (`get_doctor_analytics`) returns the caller's own specialty-scoped
report, `doctor_id` always `DoctorSession`-derived, specialty scoping reused directly
from `DoctorPatientRoster.gs`/`InventoryItem.gs`/`PillFillOrder.gs`'s own existing
views rather than re-derived. The Doctor Dashboard's Doctor Module Registry gains its
fifth real entry, `analytics` (`shared/constants/doctor-module-registry.json` version
1.4.0 → 1.5.0, `display_order: 50`) — the Doctor Dashboard
(`doctor-dashboard/dashboard.js`) renders one new, read-only card summarizing the
report's own counts/rates, no chart or graph, no write affordance, structurally
parallel to the Patient Roster/Appointments/Inventory/PillFill Orders cards. Zero
modification to any frozen Foundation/Identity & Access/Patient
Access/PXP-1..11/WPI-1..8 file. **No batch beyond WPI-9 is authorized by this
approval.**

**WPI-10 Architecture Freeze (AI Assistant, docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-
FREEZE.md, ADR-021/022/023)** — a documentation-and-architecture-only pass, fulfilling
ADR-019's own "Future Considerations" ask ("each requires its own technical plan and...
likely its own feature-specific ADRs") for AI Assistant specifically — has now been
produced: a component diagram, data flow, security/permission model, a doctor
supervision model mirroring `Ai.gs`'s existing prompt-constraint + independent
code-level-check + mandatory-human-review three-part pattern exactly (ADR-005), a
deterministic Context Builder and a retrieval strategy bounded to the patient's own
already-stored structured record only (ADR-021, since a real Knowledge Engine remains
Conceptual, docs/33 §7.7/§5.1-5.2), a fixed, bounded prompt-orchestration menu rather
than a free-form chat surface, a deterministic-vs-AI responsibility split, and
system-by-system interaction detail against Analytics, Care Plans, Check-ins, Calculator
Results, Inventory, PillFill, Appointments, and Notifications — every one read-only,
none gaining a new write path. Two new entities are *Designed*, not *Implemented*:
`AIAssistantInteraction` (an append-only audit/decision log) and an AI Assistant
Capability Registry (structurally parallel to Calculator Registry). One new Doctor
Module Registry entry (`ai_assistant`), three new `FoundationRouter.gs` dispatch cases,
and one new Doctor Dashboard card are named and specified, none built. AI Assistant
never gains a write path into any clinical entity — every output is a non-persisting
draft; an accepted draft still requires the doctor's own, separate, existing write
action on the target entity's own page (ADR-022) — and the `ai_assistant` registry
entry is disabled by default for every doctor, diverging deliberately from every prior
entry's rollout convention (ADR-023). Validation strategy, browser-test strategy,
conformance strategy, and four new static-analysis rules (most notably: no AI Assistant
code path may call another entity's write function directly) are specified for a future
implementation batch to satisfy. **This scopes the doctor-facing AI Assistant inside the
already-frozen Doctor Dashboard only** — docs/22-WISE-KNOWLEDGE-ENGINE.md's separate,
unscoped, patient-facing "Website AI Assistant" is untouched by this freeze. Zero
modification to docs/49/50/51/52/53/54 or any code, schema, registry, or frontend file.
**No implementation of any kind is authorized by this pass — WPI-10 implementation
requires its own separate, explicit approval**, per docs/53 §9/§13/§15.

**Batch WPI-10 (AI Assistant, implementation, docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-
FREEZE.md, ADR-021/022/023)** — separately, explicitly approved after the architecture
freeze above, per docs/53 §9/§13/§15 — has now shipped, matching docs/55 §4–§18 exactly.
`AIAssistantInteraction` (`shared/schemas/ai-assistant-interaction.schema.json`,
`apps-script/AIAssistantInteraction.gs`) and the AI Assistant Capability Registry
(`shared/constants/ai-assistant-capability-registry.json`,
`apps-script/AIAssistantContext.gs`) are both real and Implemented — the registry ships
with exactly one capability, `summarize_patient_status` (a disclosed, implementation-time
choice among docs/55 §11.2's three named illustrative capabilities; `draft_care_plan_note`
and `flag_checkin_anomalies` remain unregistered for a future batch). `AssistantContextBuilder`
(`AIAssistantContext.gs`'s `foundationBuildAiAssistantContext_()`) assembles a roster- and
capability-bounded context strictly from `CarePlan.gs`'s, `CheckInResponse.gs`'s,
`CalculatorResult.gs`'s, and `Appointment.gs`'s existing scoped readers — never a direct
Sheet read, statically enforced (docs/55 §18 item 4). `AssistantDriftCheck_()`
(`AIAssistantDriftCheck.gs`) mirrors `Ai.gs`'s `flagDrift_()` structurally, as a
distinctly-named, independent copy rather than a dependency on that frozen Phase 1.5 file.
Three new, additive `FoundationRouter.gs` dispatch cases
(`get_ai_assistant_capabilities`, `post_ai_assistant_query`, `post_ai_assistant_decision`)
are doctor-guarded only, statically verified (docs/55 §18 item 3); `post_ai_assistant_query`
is this batch's one genuinely new *write* route among every WPI-1..9 doctor-facing route,
but the only Sheet it writes is `AIAssistantInteractions` — a grep-based static rule
(docs/55 §18 item 1) confirms no `AIAssistant*.gs` file calls another entity's write
function. One new, additive Doctor Module Registry entry (`ai_assistant`, `display_order:
60`) is **disabled by default for every doctor** (ADR-023) — enabling it is a per-doctor,
staff/administrative decision, never a bulk rollout; `apps-script/DoctorModuleState.gs`'s
existing fail-closed mechanism is reused unmodified. A per-doctor, per-UTC-day rate limit
(`CacheService`, mirroring `FoundationRateLimit.gs`'s own pattern — a disclosed
implementation-time choice, docs/55 §10) bounds real per-call model cost, failing open on a
cache error like that same precedent. The Doctor Dashboard (`doctor-dashboard/dashboard.js`)
gains one new, registry-driven card: a capability picker constrained to the fixed list
(never a free-text prompt box, docs/55 §7.1), a patient selector reusing the existing
Patient Roster card's own `get_doctor_patient_roster` route (no new patient-lookup
mechanism), and a draft area whose un-dismissable "AI-generated draft — not saved" banner
always renders above any Accept/Edit/Reject control — Accept/Edit/Reject call
`post_ai_assistant_decision` only, and the UI explicitly tells the doctor this capability
is reference-only (its own `target_entity_type` is `null`) rather than implying anything
was saved. Conformance Stage 26 (`validation/phase-2a-foundation/conformance.js`) and a new
`validation/wpi-10-ai-assistant/browser-test.js` suite both pass cleanly, alongside a clean
re-run of every earlier stage/suite (734 conformance checks, 0 failed; 347 browser checks
across 16 suites, 0 failed; static analysis, 0 findings, including the four new AI
Assistant-specific rules docs/55 §18 names). Zero modification to any frozen
Foundation/Identity & Access/Patient Access/PXP-1..11/WPI-1..9 file, and zero modification
to Phase 1.5's `Config.gs`/`Ai.gs` — every config/prompt/threshold this batch needs is its
own local, decoupled definition. **No batch beyond WPI-10 is authorized by this approval.**

**WPI-11 Architecture Freeze (Holoscan, docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md,
ADR-024/025/026)** — a documentation-and-architecture-only pass, fulfilling ADR-019's
own "Future Considerations" ask for Holoscan specifically, and closing docs/49 §9's own
"no existing document defines this item's purpose at all" gap for the first time, once
the clinic supplied that purpose directly for this freeze — has now been produced.
**Holoscan is defined as the Patient Medication Recognition Engine:** a patient
photographs one or more medicines currently being taken; a vision/OCR pipeline extracts
whatever text is visible on the packaging into draft medication candidates; a doctor
reviews every candidate (approve / correct / reject) before anything enters the
patient's permanent record; approval records a decision only and never itself writes
the record, mirroring WPI-10's own non-persisting-draft discipline exactly (ADR-022,
extended here as ADR-025); once a medicine is on record, a doctor separately marks it
Continue / Stop / Replace / Unknown at any later time, each an append-only decision
building a complete audit history. Four new entities are *Designed*, not *Implemented*:
`HoloscanRecognition` and `HoloscanRecognitionItem` (the capture/draft pair, mirroring
`AIAssistantInteraction`'s draft-then-decision shape and `Report`'s Drive file-upload
pattern), and `MedicationHistory`/`MedicationDecision` (the permanent record and its
own append-only clinical-decision ledger, mirroring `InventoryItem`/
`InventoryTransaction`'s derived-cache-from-ledger discipline, WPI-7/docs/54). Seven new
router dispatch cases (two patient-only, four doctor-only, and one — `get_medication_history`
— dual-guarded, returning the caller's own record for a patient or a roster-scoped view
for a doctor), two new registry
entries (a patient-facing `holoscan` Module Registry entry and a doctor-facing
`holoscan_review` Doctor Module Registry entry, disabled by default per new ADR-026,
mirroring ADR-023's precedent for `ai_assistant`), and three new dashboard cards are
named and specified, none built. Holoscan explicitly does not read, match against, or
write `InventoryItem`/`InventoryTransaction`/`PillFillOrder` — clinic stock management
is out of scope; it does not diagnose, recommend treatment, or check drug interactions
(ADR-024); and it does not build a real Medicine Catalog, a disclosed gap mirroring
WPI-10's own disclosed Knowledge Engine gap exactly. Validation strategy, browser-test
strategy, conformance strategy, and five new static-analysis rules are specified for a
future implementation batch to satisfy. Zero modification to docs/49/50/51/52/53/54/55
or any code, schema, registry, or frontend file. **No implementation of any kind is
authorized by this pass — WPI-11 implementation requires its own separate, explicit
approval**, per docs/53 §9/§13/§15, identical to WPI-10's own precedent.

**Batch WPI-12 (Phase 3 Closeout, docs/57-PHASE-3-CLOSEOUT.md)** — Phase 3's own
closeout batch, per docs/53 §15's "Closeout — a phase-level closeout document... once
every batch in docs/50 §19 has shipped or been explicitly, disclosedly left as a
reserved placeholder... WPI-12 (Closeout) is this phase's own closeout batch" — has now
been produced. Documentation, repository-housekeeping, and validation only: every
existing validation suite (static analysis, conformance, Phase 1.5 regression, and all
16 browser-test suites) was re-run fresh, clean, with zero code changes. **WPI-1 through
WPI-10 are fully implemented and frozen except for genuine bug fixes. WPI-11 (Holoscan)
is architecture-frozen only (docs/56, ADR-024/025/026) — its implementation is
explicitly, disclosedly deferred beyond Phase 3's own close, mirroring PXP-9's own
"reserved placeholder" precedent exactly, per docs/53 §15's own anticipation of this
outcome.** No code, schema, registry entry, router case, dashboard card, or Holoscan
implementation of any kind was added by this batch. **Phase 3 (WHIMS Patient
Intelligence Platform) is now closed and frozen except for genuine bug fixes.** See
docs/57 for the full closeout record. **No batch beyond WPI-12, and no future phase, is
authorized to begin by this document** — each requires its own separate, explicit
approval, per docs/53 §9/§13/§15, the same discipline every prior batch already passed
through.

**WPI-11 Implementation (Holoscan, post-Phase-3-closure batch)** — the separate,
explicit approval docs/57 §7/§13 named as still required, naming this specific batch,
has now been given, and the implementation itself has shipped. Implements docs/56 §4-§23
exactly, against the architecture already frozen (and independently, adversarially
re-audited fresh before this batch began) in Phase 3: `HoloscanRecognition`/
`HoloscanRecognitionItem` (`apps-script/HoloscanRecognition.gs`,
`HoloscanRecognitionCheck.gs`) and `MedicationHistory`/`MedicationDecision`
(`apps-script/MedicationHistory.gs`) are now real, Sheet-backed entities. The capture
pipeline reuses `FoundationReports.gs`'s own content-based MIME detection and
private-Drive-sharing enforcement unmodified (narrowed to JPEG/PNG), then one bounded,
multimodal vision-model call (reusing `AIAssistantInteraction.gs`'s own
`UrlFetchApp`/`OPENROUTER_API_KEY` pattern), then `HoloscanRecognitionCheck_()` — a
Holoscan-specific, five-category lexicon check, advisory only. Holoscan never gains a
write path into `MedicationHistory`/`MedicationDecision` (ADR-025, statically enforced,
docs/56 §23 item 1) — approving a recognition item patches only that item's own row; the
doctor's own, separate `create_medication_history_entry` action is the only way a
`MedicationHistory` row is ever created. `MedicationHistory.current_status` is derived,
recomputed from the `MedicationDecision` append-only ledger inside a `LockService`
critical section, mirroring `InventoryItem.quantity_on_hand`'s own recompute-from-ledger
discipline exactly (WPI-7, docs/54). Seven new, additive `FoundationRouter.gs` dispatch
cases, including `get_medication_history` — this platform's one dual-guarded route,
reachable by either a verified DoctorSession (roster-scoped) or a verified PatientSession
(own record only). One new Patient Module Registry entry (`holoscan`, normal rollout) and
two new Doctor Module Registry entries (`holoscan_review`, **disabled by default for
every doctor per ADR-026**, mirroring `ai_assistant`'s own precedent; `medication_history`,
normal rollout). The "My Health Journey" dashboard gains a Holoscan card (multi-photo
upload, never showing a raw un-reviewed candidate as confirmed) plus a linked, read-only
Medication History page; the Doctor Dashboard gains Holoscan Review (an always-visible
"AI-recognized — not yet in Medication History" banner above any Approve/Correct/Reject
control) and Medication History cards. Validation: static analysis 0 findings (66 files,
including five new Holoscan-specific rules per docs/56 §23); conformance 801/801 (Stage
27's own 74 new checks); Phase 1.5 regression 45/45; 17 browser suites, 367/367 checks.
Zero modification to any frozen Foundation/Identity & Access/Patient Access/
PXP-1..11/WPI-1..10 file, and zero modification to `InventoryItem.gs`/
`InventoryTransaction.gs`/`PillFillOrder.gs`/`AIAssistantInteraction.gs`/`Ai.gs`/
`Config.gs`. **This batch completes WPI-11's own reserved slot (docs/57 §7/§13) — it does
not reopen Phase 3 itself, which remains closed and frozen except for genuine bug fixes,
and it does not itself name, scope, or authorize a "Phase 4," Phase 2C, or Phase 2D** —
see below.

# Phase 4 — Not Yet Named or Scoped

No existing document defines what "Phase 4" is. Nothing in this roadmap, docs/21, or
any architecture-freeze pass names a Phase 4 vision, scope, or entity — this section
exists only to record that fact explicitly, the same discipline ADR-019 already applies
to naming-without-scoping (mirroring how docs/24 once named Holoscan without scoping
it, before docs/56). **Phase 2C (Health Milestones) and Phase 2D (Digital Twin & AI
Summaries) remain the platform's own next-named, still-unscoped-for-implementation
phases** (see above). **The WPI-11 (Holoscan) implementation batch this document names
above has now shipped** — one of the four candidates this section originally named as
equally unscoped/undecided is therefore resolved, but this does not itself define,
scope, or authorize a "Phase 4": whether the platform's next real phase is Phase 2C,
Phase 2D, or a genuinely new "Phase 4" remains exactly as undecided as before. **Not
started. Requires its own separate, explicit architecture-freeze pass and approval
before any implementation begins**, per every prior phase transition's own precedent
(docs/43, docs/48, docs/57).

# Guiding Principle
Every roadmap item should support the North Star:

'Build the world's most trusted continuous digital homeopathy care platform.'
