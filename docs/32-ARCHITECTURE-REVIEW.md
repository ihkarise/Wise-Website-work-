# 32 - Architecture Review: Documentation Conflicts, Roadmap, and Final Assessment
## Version 1.0 — 2026-07-02

> Produced in the Phase 2A architecture-freeze session, alongside docs/29 (Phase 2A
> technical plan), docs/30 (architecture principles), and docs/31 (ADR index). This
> document contains the three deliverables that don't belong inside any of those three:
> a conflicts/drift report against the new ADR set, a roadmap reordering
> recommendation, and a final go/no-go assessment. Strategic review only — no code, no
> documentation edits made as part of producing this report, per this session's
> explicit instruction ("Do NOT silently change existing documents").

---

# Part 1 — Documentation Conflicts and Drift

Every item below is a place where existing documentation states something that now
conflicts with an Accepted ADR, or conflicted with another document even before the
ADRs existed. None of these have been edited. Each has a recommended resolution for a
future, explicitly-approved documentation batch.

## 1.1 docs/09's Entry Point wording vs. ADR-003

**Conflict:** docs/09-PHASE-2-ARCHITECTURE.md states "Authentication options: Patient
ID + Password, or Mobile OTP." ADR-003 locks passwordless email-based magic links as
the Phase 2A mechanism — neither password nor Mobile OTP.

**Why it happened:** docs/09 was written before Phase 1.5 proved the free-personal-
Google-account deployment model (no Workspace, no framework password-hashing, no SMS
provider) as the platform's actual technical reality, not merely a placeholder.

**Recommendation:** Update docs/09's Entry Point section to reference ADR-003 and
describe email magic-link login as the Phase 2A implementation, with password/SMS-OTP
noted as possible future *additions* (per ADR-002's identity/auth separation), not the
current design.

## 1.2 docs/09 vs. docs/24 — Phase 2A scope already disagreed before this session

**Conflict:** docs/09's roadmap section lists Phase 2A as "Login, My Health Journey"
and Phase 2B as "Personal Care Plan, Symptom Tracker." docs/24-ROADMAP.md's Phase 2A
lists "Patient Login, Dashboard, Personal Care Plan, Secure Data Storage" — Personal
Care Plan already appears one phase earlier in docs/24 than in docs/09. This
disagreement predates this session and predates docs/29.

**Why it matters now:** docs/29 introduces a *third* scope definition for "Phase 2A"
(Login + Dashboard + Timeline + Consultation History + Symptom Tracker + Reports, but
explicitly *not* Personal Care Plan). Three different documents now describe three
different things under the same phase name.

**Recommendation:** See Part 2 below — resolve via an explicit roadmap update, not by
silently picking a winner. docs/29 already states it "supersedes docs/09's and
docs/24's Phase 2A sections where they conflict" — that supersession should be made
literal in docs/09 and docs/24 themselves once this report is approved.

## 1.3 docs/12's "Google Sheets as primary datastore" vs. ADR-006

**Conflict:** docs/12-DATA-ARCHITECTURE.md's Principles section lists "Google Sheets as
primary datastore" alongside genuine principles ("single source of truth," "minimal
data collection," "patient-owned journey") — phrasing that reads as a product-level
commitment to Sheets itself. ADR-006 explicitly frames Sheets as a replaceable
implementation choice, not a principle, and notes this exact tension.

**Recommendation:** Reword docs/12's Principles list to remove "Google Sheets as
primary datastore" as a *principle* and instead state it under a "Current
Implementation" heading, cross-referencing ADR-006. The document's own "Future" section
("design for migration to SQL") already agrees with ADR-006 — only the Principles
section needs correction.

## 1.4 docs/09's Doctor Workflow diagram omits the review gate ADR-005 requires

**Conflict:** docs/09's Doctor Workflow is drawn as "Consultation → Notes → Google
Sheets → AI Summary → Patient Timeline" — a straight line with no review/approval step
shown between "AI Summary" and "Patient Timeline." ADR-005 (and Phase 1.5's actual
`Review.gs`/`Send.gs` implementation) makes mandatory human review a non-negotiable gate
before any AI output reaches a patient.

**Why it matters:** A diagram that omits the gate could mislead a future implementer
(human or AI) into treating AI Summary → Patient Timeline as direct and automatic.

**Recommendation:** Update the diagram to explicitly show "→ Doctor Review/Approval
Gate →" between AI Summary and Patient Timeline, citing ADR-005.

## 1.5 docs/23's "Prescriptions" portal item has no architecture anywhere

**Conflict:** docs/23-PATIENT-LIFECYCLE.md's "Patient Stage" list includes
"Prescriptions" as a portal capability. No other document — docs/09's module list,
docs/29's scope — defines what this means or plans to build it.

**Recommendation:** Not a contradiction to fix, but a gap to acknowledge: either scope
a future phase for it explicitly, or remove it from docs/23's list until it is
actually planned. Leave as-is until a decision is made — do not invent scope to fill
the gap.

## 1.6 Phase 1.5 governance sign-off — still open

**Not a new conflict, but unresolved from the prior session:** docs/28's final
checklist item, "Deployment approved," remains unchecked as of this repository's
current state. docs/27 states plainly: "This document does not authorize Phase 2A to
begin." This session's premise ("Phase 1.5 has now been completed, validated,
deployed, and approved") is not yet reflected as a checked box in docs/28.

**Recommendation:** Before Batch 5A is approved to begin (a separate decision from this
architecture-freeze session), confirm and record that sign-off in docs/28 — a one-line
governance action, not a technical one, per docs/00.

## 1.7 docs/10's "no frameworks without approval" under Phase 2A's real complexity

**Not a conflict — a constraint worth naming as at-risk.** docs/10-DEVELOPMENT-STANDARDS.md's
static-first, no-framework rule has held cleanly through Phase 1 and Phase 1.5, both of
which are either fully static or backend-only. Phase 2A is the first surface with real
authenticated, stateful, interactive UI (session handling, conditional rendering per
login state, file upload with progress). It may still hold with careful vanilla JS, but
it hasn't been tested under this kind of load yet.

**Recommendation:** No change now. If Phase 2A's implementation genuinely strains this
constraint, raise it as its own ADR with a specific, scoped justification — never as a
silent framework introduction.

## 1.8 Phase 1's own Definition of Done remains unformalized

**Not a conflict — a pre-existing open item, noted for completeness.** docs/20 §2
proposed an explicit Phase 1 Definition of Done that has never been formally checked
off in docs/24 (Dedicated Condition Pages, Resources Hub, and Photography/Branding
Assets remain listed as "Remaining" under Phase 1). Phase 1.5 and now Phase 2A planning
have proceeded without Phase 1 being formally closed — consistent with how Phase 1.5
itself proceeded, so not a blocker, but worth keeping visible rather than letting the
open status quietly disappear.

---

# Part 2 — Roadmap Reordering Recommendation

Per this session's instruction, only recommending changes with strong architectural
justification — not reshuffling for its own sake.

## Recommendation A: Give Personal Care Plan its own phase, after My Health Journey v1

**Justification:** docs/24 currently lists Personal Care Plan inside "Phase 2A,"
alongside Login and Dashboard. No document — not docs/09, not docs/29 — has ever
defined Personal Care Plan's data model, UI, or doctor-authoring workflow. Bundling an
undesigned feature into the phase this very session is trying to freeze would
undermine the session's own purpose: architecture should be frozen *before*
implementation, and Personal Care Plan has had no architecture pass at all yet.

**Recommendation:** Introduce it as its own phase — proposed **Phase 2B — Personal Care
Plan** — positioned immediately after Phase 2A (docs/29) ships, and require it to go
through the same architecture-freeze treatment (a technical plan plus any new ADRs it
needs) before implementation begins, exactly as this session did for Phase 2A.

## Recommendation B: Split the current Phase 2C into a non-AI and an AI-heavy sub-phase

**Justification:** docs/24's current Phase 2C bundles "Digital Twin, AI Summaries,
Health Milestones, Progress Analytics" as one phase. Health Milestones (docs/21:
scheduled reviews at 30/90 days, 6 months, 1 year — a review of progress, medicines,
investigations, and next goals) requires no AI at all — it's a scheduling/summary
feature a doctor and patient can review together, structurally similar to Consultation
History (docs/29 §7). Digital Twin and AI Summaries, by contrast, are the platform's
single highest AI-risk surface, requiring the full ADR-001/ADR-004/ADR-005 safety
pattern (grounded knowledge, no diagnosis/treatment content, mandatory review gate).
Bundling a zero-AI feature with the highest-AI-risk feature under one phase label
obscures a real difference in review rigor and implementation risk.

**Recommendation:**
- **Phase 2C — Health Milestones** (no AI; reuses the Consultation-History-style
  pattern from docs/29 §7).
- **Phase 2D — Digital Twin & AI Summaries** (the AI-supervised work; requires
  ADR-001/004/005's full pattern, and likely its own new ADRs specific to Digital Twin
  narrative generation).
- Existing Phase 2D ("Advanced analytics and reminders") folds into the new Phase 2D or
  becomes Phase 2E — a naming detail to settle when that phase is actually planned, not
  now.

## Recommendation C: No change to Phase 1, Phase 1.5, or Phase 3 sequencing

Phase 1's remaining items (condition pages, Resources hub, assets) and Phase 3
(WiseOS) have no architectural conflict with the ADR set and no strong justification
for reordering relative to Phase 2A/2B/2C/2D. Phase 1.5's sequencing before Phase 2A is
already correct and unchanged (docs/20 §2, reaffirmed by docs/27 §7).

## Proposed Renumbered Roadmap (recommendation only — not applied to docs/24)

| Phase | Scope |
|---|---|
| Phase 1 | Public website (unchanged, remaining items unchanged) |
| Phase 1.5 | Consultation-summary pipeline (complete per docs/25–28, pending governance sign-off) |
| Phase 2A | My Health Journey v1 — Login, Dashboard, Timeline, Consultation History, Symptom Tracker v1, Report Upload (docs/29) |
| Phase 2B | Personal Care Plan (new — not yet architected; requires its own freeze session) |
| Phase 2C | Health Milestones (non-AI) |
| Phase 2D | Digital Twin & AI Summaries (AI-supervised, requires new ADRs) |
| Phase 3 | WiseOS (unchanged) |

---

# Part 3 — Final Architecture Review

## Is the architecture now stable enough for Phase 2 implementation?

**Yes, specifically for the scope defined in docs/29 — conditionally.** The identity/
authentication separation (ADR-002/003), the AI-supervision pattern (ADR-001/004/005,
already proven once in Phase 1.5), the modularity/deployability discipline
(ADR-008/009, also already proven), and the security-precedence default (ADR-010) are
now all explicit, cross-referenced, and grounded in a working precedent rather than
aspiration. That is a materially more stable foundation than existed at the start of
this session.

**Three conditions should be satisfied before Batch 5A is approved to begin** (none of
these are resolved by this session, all are cheap to resolve):
1. Part 1.6's governance gap (docs/28's sign-off) closed.
2. Part 1.1 and 1.3's conflicts (docs/09 Entry Point wording, docs/12's Sheets-as-
   principle wording) resolved, since docs/29 already depends on the corrected version
   of both.
3. A dedicated security review of the magic-link/session-token mechanism (docs/29
   §11, item 2) — the hardest, most novel piece of engineering in this phase, and the
   one place a subtle bug has the highest cost.

**Not yet stable for anything beyond docs/29's scope.** Personal Care Plan and Digital
Twin/AI Summaries have no technical plan and should not begin implementation under this
freeze — each needs its own version of this same exercise first (Part 2's
recommendation).

## Which architectural risks remain?

- **Hand-rolled auth cryptography** (docs/29 §11) — the platform's first real
  security-critical, from-scratch mechanism; higher stakes than anything Phase 1.5
  built.
- **Sheets-at-scale**, now carrying real patient records instead of a staff pipeline —
  accepted per ADR-006, monitored not solved.
- **Static-frontend complexity ceiling** (Part 1.7) — untested under Phase 2A's actual
  interactive/authenticated UI load.
- **Free-account storage quotas** (Drive) — low risk now, worth tracking as usage
  grows.
- **"Patient data belongs to the patient" has no concrete mechanism yet** (docs/30 §3)
  — stated as a principle, not yet implemented as an export/delete capability. Not
  urgent for docs/29's scope, but should not be forgotten once real patient data
  accumulates.
- **The Knowledge Engine has no real retrieval implementation** — ADR-001 is currently
  satisfied by inline doctor-supplied text (Phase 1.5's pattern), not a queryable
  knowledge base. This is fine for docs/29 (no AI is used in Phase 2A at all) but will
  need real design work before Phase 2D.

## Which ADRs should never be changed once accepted?

Two tiers, deliberately distinguished:

**Core trust/safety ADRs — should never change, only be reaffirmed.** Changing these
would alter what kind of platform Wise is, not just how it's built:
- **ADR-001** (Knowledge Engine is the primary knowledge source)
- **ADR-002** (Patient identity independent of authentication)
- **ADR-004** (Digital Twin never generates diagnosis or treatment)
- **ADR-005** (AI always operates under doctor supervision)
- **ADR-010** (Security before convenience, as a default stance)

**Mechanism ADRs — expected to evolve deliberately, by design.** These explicitly say
so in their own "Future Considerations" sections and should be superseded (never
silently edited) when circumstances change:
- **ADR-003** (passwordless by default — may gain a second factor later)
- **ADR-006** (Sheets as implementation detail — expected to migrate eventually)
- **ADR-007, ADR-008, ADR-009** (documentation/deployability/modularity discipline —
  process principles, could in theory be revisited, but doing so would be a significant
  regression and should require the same rigor as any other supersession)

This distinction itself is worth preserving: future sessions should treat "can this
ADR be revisited" as a different question from "is this ADR currently being followed
correctly."
