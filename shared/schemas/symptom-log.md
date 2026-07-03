# Symptom Log

Explains `symptom-log.schema.json` (version `1.0.0`, the authoritative definition — this
file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch PA-4 (docs/29 §13 Batch 5E)

Backs the platform's first **patient-writable** feature: the Symptom Tracker
(docs/29 §9, docs/33 §3.2). Per docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md and the
explicit decisions approved before this batch began, Symptom Log has a two-state
lifecycle that no other Foundation entity has needed before it:

| State | Editable? | Visible in Timeline? | Visible to staff? | Used by AI? |
|---|---|---|---|---|
| `draft` | Yes, by the owning patient only | No | No (see "Staff visibility" below) | No |
| `submitted` | No — permanent from this point on | Yes | Yes | Not yet (no AI exists in Phase 2A at all, docs/29 §0) — eligible input for a future AI feature (Digital Twin, Phase 2D) once one exists |

## The draft/submit state machine

1. **Create** — a patient opens the Symptom Tracker with no open draft; a new row is
   created with `status: "draft"`, every scale field empty, `submitted_at: ""`. Per this
   batch's own disclosed simplification: **one open draft per patient at a time** —
   requesting a new draft when one already exists returns the existing one rather than
   creating a second. Nothing in docs/29 §9 or the approved decisions requires multiple
   concurrent drafts, and avoiding them keeps the entity's read path (`get_symptom_logs`)
   simple: at most one draft, plus a capped list of submitted entries.
2. **Edit** — the owning patient may update any of `severity`/`sleep`/`energy`/`stress`/
   `notes` any number of times while `status` is `draft`. `condition_slug` is set once at
   creation (copied from the patient's own profile) and is not independently editable
   through this entity. Every edit re-verifies ownership (`patient_id` match) before
   applying, and re-checks (never assumes) that the row is still `draft` — attempting to
   edit an already-submitted row is rejected with a specific, patient-facing message
   ("This entry has already been submitted and can no longer be edited"), not a generic
   one, since the requester already owns the row and revealing its own state is not an
   enumeration risk (contrast with the cross-patient case below, which stays generic).
3. **Submit** — an irreversible one-way transition. Re-validates the row's own
   *currently stored* field values (never trusts client-supplied values at submit time —
   the same "re-read live state, never trust submission-time state" discipline Phase
   1.5's `evaluateSendGate_()` already established for consent) against
   `foundationValidateSymptomLogForSubmit_()`'s one rule: **at least one of
   severity/sleep/energy/stress/notes must be non-empty.** This is a deliberately minimal
   bar — nothing in docs/29 §9 requires every scale field to be filled, and inventing a
   stricter rule would be scope creep beyond what was actually decided. On success,
   `status` becomes `submitted`, `submitted_at` and `updated_at` are stamped, and the row
   is permanent from that point on.

## Cross-patient authorization (unchanged discipline, applied to a write path for the first time)

Every edit/submit call verifies the row's own `patient_id` matches the session-derived
`patient_id` **before** checking anything else (ADR-002, docs/40 Q3's principle). A
`record_id` that does not exist, and a `record_id` that exists but belongs to a different
patient, return the identical `FOUNDATION_NOT_FOUND` envelope — the same anti-enumeration
discipline already established for Consultation History's detail fetch, now extended to
a write path (this batch's own new authorization surface, per docs/29 §11's framing of
why Symptom Tracker is sequenced before Report Upload: proving the write-authorization
pattern on non-file data first).

## Staff visibility — an honest limitation, stated openly

"Visible to clinic staff" for a `submitted` row is satisfied today the same way it
already is for every other Foundation entity (`Patients`, `ConsultationHistory`): direct
access to the underlying `SymptomLogs` spreadsheet by staff who already have Google
Sheets access to it — no dedicated staff Web App tool exists for this entity, mirroring
`FoundationConsultationHistory.gs`'s own disclosed "no staff-facing Web App tool" choice.

**A real, disclosed limitation, not a silent gap:** "not visible to staff" for a `draft`
row is enforced at the **application/API layer** only — no Foundation route ever returns
a draft to anyone but its own owning patient. It is **not** enforced at the storage layer
row-by-row — Google Sheets has no row-level access control, so anyone with direct
edit access to the `SymptomLogs` spreadsheet could technically view a draft row by opening
the sheet tab directly, the same pre-existing limitation that already applies to every
other Foundation entity's data (e.g. staff with `Patients` sheet access already see every
patient's profile, not filtered by any in-application permission). This is not a new gap
introduced by this batch; it is the same spreadsheet-level access model the whole
platform already runs on (docs/15's "least privilege" governs *who* has Sheet access at
all, not row-level ACLs within one sheet).

## AI boundary (forward-looking, not enforced by any code in this batch)

No AI touches either state in Phase 2A — docs/29 §0's "No AI is used anywhere in this
phase" applies unconditionally. This field's `status` split matters for a **future**
phase only: when Digital Twin (Phase 2D) is eventually built, it must read only
`status: "submitted"` rows, never drafts — recorded here now so that boundary is decided
before it is ever relevant, not re-derived later.

## `condition_slug` — validation deferred, same precedent as Patients

Not validated against Phase 1.5's canonical `ALLOWED_CONDITION_SLUGS` list by this
entity's own code — it is copied verbatim from the patient's own `Patients.condition_slug`
at draft-creation time, which is itself unvalidated against that list per
`shared/schemas/patient-identity.md`'s own documented simplification. This batch is,
per docs/41 §10, a reasonable trigger point to finally populate `shared/constants/` with
that canonical list as a **second** real consumer alongside `Patients.condition_slug` —
tracked as a recommended follow-up, not blocking this batch, since neither existing
consumer currently enforces it and adding enforcement to one without the other would be
inconsistent.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `record_id` | Yes | No — permanent |
| `patient_id` | Yes | No |
| `status` | Yes (`"draft"`) | Once, `draft` → `submitted` only |
| `severity` / `sleep` / `energy` / `stress` | Yes (`""`) | Yes, while `status` is `draft` |
| `notes` | Yes (`""`) | Yes, while `status` is `draft` |
| `condition_slug` | Yes (from profile) | No |
| `created_at` | Yes | No |
| `updated_at` | Yes | Yes, on every draft edit and once at submit |
| `submitted_at` | Yes (`""`) | Once, at submit |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/FoundationSymptomLog.gs` — never
the reverse, per `shared/README.md`.
