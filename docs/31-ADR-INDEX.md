# 31 - Architectural Decision Record Index
## Version 1.9 — 2026-07-16

> This is the canonical index of every Architectural Decision Record (ADR) for the
> Wise Platform. Full records live in `/adr/`. This index is the entry point — check
> here first before assuming an architectural question is undecided.

---

# What an ADR Is Here

A short, permanent record of one binding architectural decision: the problem it
resolves, what was decided, what it costs, and what's deliberately left open. Per
ADR-007, an ADR is immutable once **Accepted** — it changes only through a formal
**Superseded** or **Deprecated** transition that creates a new record, never a silent
edit. This index must be updated in the same change that adds, supersedes, or
deprecates any ADR.

---

# Status Definitions

| Status | Meaning |
|---|---|
| Proposed | Drafted, not yet binding. |
| Accepted | Binding. Governs all current and future work until superseded. |
| Superseded | No longer binding; replaced by a newer ADR (linked). Record kept for history. |
| Deprecated | No longer binding; not replaced by anything (the concern no longer applies). |

---

# Index

| ID | Title | Status | File |
|---|---|---|---|
| ADR-001 | Knowledge Engine Is the Primary Knowledge Source | Accepted | `/adr/ADR-001-knowledge-engine-primary-source.md` |
| ADR-002 | Patient Identity Is Independent of Authentication | Accepted | `/adr/ADR-002-patient-identity-independent-of-authentication.md` |
| ADR-003 | Authentication Is Passwordless by Default | Accepted — amended in part, currently by ADR-015 (ADR-011's and ADR-014's earlier amendments are superseded) | `/adr/ADR-003-passwordless-authentication-by-default.md` |
| ADR-004 | Digital Twin Never Generates Diagnosis or Treatment | Accepted | `/adr/ADR-004-digital-twin-no-diagnosis-or-treatment.md` |
| ADR-005 | AI Always Operates Under Doctor Supervision | Accepted | `/adr/ADR-005-ai-under-doctor-supervision.md` |
| ADR-006 | Google Sheets Is an Implementation Detail, Not a Product Dependency | Accepted | `/adr/ADR-006-sheets-as-implementation-detail.md` |
| ADR-007 | Documentation Is Part of the Software | Accepted | `/adr/ADR-007-documentation-is-part-of-software.md` |
| ADR-008 | Every Phase Must Be Independently Deployable | Accepted | `/adr/ADR-008-phases-independently-deployable.md` |
| ADR-009 | Every Module Must Be Independently Replaceable | Accepted | `/adr/ADR-009-modules-independently-replaceable.md` |
| ADR-010 | Security Decisions Always Take Precedence Over Convenience | Accepted | `/adr/ADR-010-security-before-convenience.md` |
| ADR-011 | A Persistent Credential (PIN/Password) May Be Added as an Optional Second Factor, Magic Link Remains the Mandatory Baseline | Superseded by ADR-014 | `/adr/ADR-011-persistent-credential-as-additional-factor.md` |
| ADR-012 | Patient Dashboard Capabilities Are Registry-Driven, With Per-Patient Enablement | Accepted — amended twice (existing-card migration now committed, not deferred; and, at PXP-3, the registry's framing generalized to a platform-wide capability-exposure mechanism, dashboard remaining its first/only implemented consumer) | `/adr/ADR-012-dashboard-modules-are-registry-driven.md` |
| ADR-013 | Calculators Are Deterministic and Never AI-Generated | Accepted | `/adr/ADR-013-calculators-are-deterministic-never-ai-generated.md` |
| ADR-014 | Persistent Login Is Achieved Primarily Through Trusted Devices; Magic Link Is the Root of Trust | Superseded by ADR-015 | `/adr/ADR-014-trusted-device-persistent-login.md` |
| ADR-015 | Persistent Login Adds a Long-Lived Session Alongside Trusted Device; Passwordless-by-Default Is Reaffirmed as Non-Negotiable | Accepted — supersedes ADR-014, amends ADR-003 | `/adr/ADR-015-long-lived-session-and-passwordless-reaffirmation.md` |
| ADR-016 | Patient-Facing Forms and Questionnaires Are Generated From a Template Registry | Accepted — complements ADR-012, does not amend or supersede it | `/adr/ADR-016-template-registry.md` |
| ADR-017 | Doctor Identity Is a First-Class Entity, Structurally Parallel to Patient Identity | Accepted | `/adr/ADR-017-doctor-identity-independent-entity.md` |
| ADR-018 | Platform Registries Support Optional Specialty Scoping | Accepted — complements ADR-012/013/016, does not amend any of them | `/adr/ADR-018-specialty-scoped-registries.md` |
| ADR-019 | AI and Advanced-Capability Extension Points Are Reserved Platform-Wide, Never Implemented Without Separate Approval | Accepted — reaffirms and generalizes ADR-001/004/005/013, amends none of them | `/adr/ADR-019-ai-extension-points-reserved-platform-wide.md` |
| ADR-020 | Doctor-Facing Capabilities Are Registry-Driven, Mirroring the Patient Dashboard | Accepted — extends ADR-012's principle via a new, parallel registry; does not amend ADR-012 | `/adr/ADR-020-doctor-dashboard-registry-driven.md` |
| ADR-021 | AI Assistant Retrieval Is Grounded Only in the Patient's Own Structured Record, Never an Unstructured Knowledge Base, Until a Real Knowledge Engine Exists | Accepted — extends ADR-001 for AI Assistant specifically, amends none of it | `/adr/ADR-021-ai-assistant-grounded-in-structured-record-only.md` |
| ADR-022 | AI Assistant Output Is Always a Non-Persisting Draft Requiring Doctor Approval Through the Target Entity's Own Existing Write Path | Accepted — extends ADR-004/ADR-005 for AI Assistant specifically, amends neither | `/adr/ADR-022-ai-assistant-non-persisting-draft-doctor-approval.md` |
| ADR-023 | The Doctor Module Registry's `ai_assistant` Entry Is Disabled by Default, Diverging From Every Prior Entry's Rollout Convention | Accepted — extends ADR-020/ADR-010 for the `ai_assistant` entry specifically, amends neither | `/adr/ADR-023-ai-assistant-registry-entry-disabled-by-default.md` |
| ADR-024 | Holoscan Recognition Is Grounded Only in Uploaded Image Content, Never External Medical Inference, Diagnosis, or Treatment Recommendation | Accepted — extends ADR-001/ADR-004 for Holoscan specifically, amends neither | `/adr/ADR-024-holoscan-grounded-in-image-content-only.md` |
| ADR-025 | Holoscan Recognition Output Is Always a Non-Persisting Draft Requiring Doctor Approval Through Medication History's Own Existing Write Path | Accepted — extends ADR-004/ADR-005/ADR-022 for Holoscan specifically, amends none | `/adr/ADR-025-holoscan-non-persisting-draft-doctor-approval.md` |
| ADR-026 | The Doctor Module Registry's `holoscan_review` Entry Is Disabled by Default, Mirroring ADR-023's Rollout Discipline | Accepted — extends ADR-020/ADR-010, follows ADR-023's precedent for the `holoscan_review` entry specifically, amends none | `/adr/ADR-026-holoscan-review-registry-entry-disabled-by-default.md` |
| ADR-027 | Health Milestones Are Doctor-Authored Reviews on a Deterministically-Computed Schedule, Never AI-Generated or Auto-Inferred | Accepted — governs Phase 2C (docs/58); extends ADR-004/ADR-005 by keeping Phase 2C outside AI, follows Analytics/Digital Twin's computed-view precedent, amends none | `/adr/ADR-027-health-milestones-doctor-authored-computed-schedule.md` |
| ADR-028 | The Digital Twin / AI Summary Is a Patient-Facing AI Narrative Requiring Doctor Approval Before the Patient Ever Sees It, and the Digital Twin View Itself Is Never a Stored Base Table | Accepted — governs Phase 2D (docs/59); extends ADR-004/ADR-005/ADR-022 for the patient-facing Digital Twin specifically, amends none | `/adr/ADR-028-digital-twin-patient-facing-narrative-doctor-approved.md` |
| ADR-029 | Digital Twin Retrieval Is Grounded Only in the Patient's Own Already-Stored Structured Record, Never an Unstructured Knowledge Base, Until a Real Knowledge Engine Exists | Accepted — governs Phase 2D (docs/59); extends ADR-001/ADR-021 for the Digital Twin specifically, amends neither | `/adr/ADR-029-digital-twin-grounded-in-patient-record-only.md` |
| ADR-030 | The Doctor Module Registry's `digital_twin_review` Entry Is Disabled by Default, Following ADR-023/ADR-026's Rollout Discipline | Accepted — governs Phase 2D (docs/59); extends ADR-020/ADR-010, follows ADR-023/ADR-026's precedent for the `digital_twin_review` entry specifically, amends none | `/adr/ADR-030-digital-twin-review-registry-entry-disabled-by-default.md` |

---

# Grouped by Concern

**Identity & Access** — ADR-002, ADR-003, ADR-010, ADR-015, ADR-017 (ADR-011, ADR-014 superseded)
**AI & Clinical Authority** — ADR-001, ADR-004, ADR-005, ADR-013, ADR-019, ADR-021, ADR-022, ADR-023, ADR-024, ADR-025, ADR-026, ADR-027 (ADR-027 by *absence* of AI — it keeps Phase 2C entirely outside the AI gate), ADR-028, ADR-029, ADR-030 (Phase 2D — the platform's first patient-facing AI content, under the full ADR-004/005 gate)
**Data & Storage** — ADR-002, ADR-006
**Modularity & Delivery** — ADR-008, ADR-009, ADR-012, ADR-016, ADR-018, ADR-020
**Governance & Documentation** — ADR-007

---

# Relationship to Other Documents

- `docs/30-ARCHITECTURE-PRINCIPLES.md` states the permanent principles these ADRs
  formalize — read that first for the "why," this index for the specific "what was
  decided and when."
- `docs/29-PHASE-2A-TECHNICAL-PLAN.md` is the first implementation plan built against
  this ADR set — every architecture choice in it cites the ADR that governs it.
- `docs/32-ARCHITECTURE-REVIEW.md` records where existing pre-ADR documentation
  conflicts with these decisions, and what should change to resolve each conflict.
- `docs/44-PHASE-2B-TECHNICAL-PLAN.md` (Version 4.0) is the first implementation plan
  built against ADR-012/013/015/016 — see it for how each is applied. It was originally
  built against ADR-011, then ADR-014, both now superseded by ADR-015.
- `docs/50-PHASE-3-TECHNICAL-PLAN.md` (Version 1.0) is the first implementation plan
  built against ADR-017/018/019/020 — see it for how each is applied.
- `docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md` fulfills ADR-006's own "Future
  Considerations" ask (a concrete migration trigger, defined once it became a
  near-term planning concern at Batch WPI-7/WPI-9) — a dedicated capacity review, not
  an amendment; ADR-006 itself remains Accepted and unchanged.
- `docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-FREEZE.md` (Version 1.0) is the first
  implementation plan built against ADR-021/022/023 — fulfills ADR-019's own "Future
  Considerations" ask for AI Assistant specifically (its own technical plan plus
  feature-specific ADRs, per the ADR-001/004/005/013 pattern) — a dedicated,
  feature-scoped architecture freeze, not an amendment to docs/49/50 or ADR-019 itself.
- `docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md` (Version 1.0) is the first
  implementation plan built against ADR-024/025/026 — fulfills ADR-019's own "Future
  Considerations" ask for Holoscan specifically, the identical role docs/55 plays for
  ADR-021/022/023 — a dedicated, feature-scoped architecture freeze, not an amendment
  to docs/49/50/55 or ADR-019 itself.
- `docs/58-PHASE-2C-HEALTH-MILESTONES-ARCHITECTURE-FREEZE.md` (Version 1.0) is the first
  implementation plan built against ADR-027 — the dedicated, feature-scoped architecture
  freeze for Phase 2C (Health Milestones), the identical single-feature-freeze role
  docs/55/56 play for the AI features, adapted for a **non-AI**, patient-facing feature.
  Additive to docs/24/49/50 and every prior freeze; amends none of them.
- `docs/59-PHASE-2D-DIGITAL-TWIN-ARCHITECTURE-FREEZE.md` (Version 1.0) is the first
  implementation plan built against ADR-028/029/030 — the dedicated, feature-scoped
  architecture freeze for Phase 2D (Wise Digital Twin & AI Summaries), the platform's **first
  patient-facing AI-generated-content feature**, under the full ADR-004/ADR-005 gate proven by
  Phase 1.5's Consultation Summary. Additive to docs/24 and every prior freeze; amends none.

---

# Adding a New ADR

1. Confirm the decision doesn't already exist here under a different name.
2. Write it in `/adr/ADR-0NN-short-slug.md` using the same five-section format
   (Status, Context, Decision, Consequences, Future Considerations).
3. Add it to the Index table and the Grouped-by-Concern section above, in the same
   change.
4. If it supersedes an existing ADR, mark the old one **Superseded** with a link
   forward — never delete or silently rewrite it.
