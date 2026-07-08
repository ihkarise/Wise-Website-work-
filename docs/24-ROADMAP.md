# 24 - Wise Product Roadmap
## Version 1.14 — 2026-07-16

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
- Scheduled progress reviews (30/90 days, 6 months, 1 year, per docs/21)
- No AI required — deliberately separated from Phase 2D, which carries the
  platform's AI-supervised work

# Phase 2D — Wise Digital Twin & AI Summaries
- Health Story
- AI Summaries
- Progress Analytics

Requires the full ADR-001/ADR-004/ADR-005 AI-supervision pattern before
any implementation begins.

# Phase 3 — WHIMS Patient Intelligence Platform (formerly "WiseOS")
Status: **Architecture freeze complete (Version 1.0, 2026-07-16). Implementation
underway: Batch WPI-1 (Doctor Identity & Session) shipped 2026-07-16, Batch WPI-2
(Specialty Registry) shipped 2026-07-16, and Batch WPI-3 (Doctor Module Registry,
backend) shipped 2026-07-16, each explicitly approved and scoped to its own batch
only. No later batch (WPI-4 onward) is authorized to begin.**

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
RULES.md (permanent per-batch governance standard), and four new ADRs: ADR-017
(Doctor Identity), ADR-018 (Specialty-Scoped Registries), ADR-019 (AI/Advanced
Extension Points Reserved Platform-Wide), ADR-020 (Doctor Dashboard Registry-Driven).

**Four pillars** (docs/49 §4): Doctor Identity & Access, Doctor-Facing
Registry-Driven Capabilities, Specialty-Scoped Extensibility, and Reserved AI/Advanced
Extension Points — with Inventory, PillFill Integration, and Analytics as consumers,
not pillars in their own right.

**Twelve named batch slots** (docs/50 §19, prefixed `WPI-` for "WHIMS Patient
Intelligence" batch, mirroring exactly how `PXP-` was derived for Phase 2B),
infrastructure before features: WPI-1 (Doctor Identity & Session) → WPI-2 (Specialty
Registry) → WPI-3 (Doctor Module Registry, backend) → WPI-4 (Doctor Dashboard,
frontend consumer) → WPI-5 (Appointment) → WPI-6 (Notification) → WPI-7 (Inventory) →
WPI-8 (PillFill Integration) → WPI-9 (Analytics) → WPI-10 (AI Assistant — **reserved,
unscoped placeholder, mirroring PXP-9's own precedent exactly**) → WPI-11 (Holoscan —
**reserved, unscoped placeholder; no existing document defines this item's purpose at
all**) → WPI-12 (Closeout).

**No WPI batch beyond WPI-3 is authorized to begin by any of the above documents.**
Each requires its own separate, explicit approval, per docs/53's per-batch gate — the
same discipline every Phase 2B batch already passed through. Two documentation-only
closures identified by docs/51's readiness review were resolved within this same
version (docs/52 §1.1/Part 5): the "WiseOS" cross-reference in docs/33 §1.4, and an
explicit disclosure of the patient-roster derivation's limitation at
multi-doctor-per-specialty scale (docs/50 §7.4). The Sheets-at-production-scale
question (docs/49 §7) remains an open gate before WPI-7/WPI-9 — named, not resolved, by
this architecture-freeze pass.

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

# Guiding Principle
Every roadmap item should support the North Star:

'Build the world's most trusted continuous digital homeopathy care platform.'
