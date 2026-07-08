# Doctor Identity

Explains `doctor-identity.schema.json` (version `1.0.0`, the authoritative definition —
this file explains, it does not define, per `shared/README.md`'s format rule).

## Why one schema covers two conceptually distinct entities

Mirrors `patient-identity.md`'s own reasoning exactly, applied to the doctor side.
`docs/33-DOMAIN-MODEL.md` models **Doctor Identity** (§7.1, the minimal, permanent core
— just `doctor_id` and `created_at`) and **Doctor** (§7.1, the fuller profile — name,
role, email, specialty, status) as two distinct conceptual entities, specifically so
that authentication method, contact details, role, and specialty can all change without
ever touching the permanent identity (ADR-017, mirroring ADR-002). `docs/50-PHASE-3-
TECHNICAL-PLAN.md` §5.1/§5.2 locks a single `Doctors` sheet with both the identity core
and the profile fields in one row, before this schema was written — the same
single-row-satisfies-the-separation choice `patient-identity.schema.json` already made,
for the same reason: one write, one lookup, no join, at pilot scale (ADR-006).

**The one rule that must never be violated regardless of storage layout:** every
doctor-owned record that migrates onto a real identity (a future write path for
`DoctorAssignedCondition`, `CarePlan`, `DoctorInstruction`, `CheckInTemplateAssignment`)
references `doctor_id`, never `email` or `full_name`. If a doctor's email changes, no
other record needs to change.

## Never merged with Patient Identity (ADR-017)

`doctor_id` and `patient_id` are permanently distinct value spaces — no code path ever
treats one as interchangeable with the other, no shared "user id" concept exists
anywhere in the platform. `DoctorSession` (`doctor-session.schema.json`) and `Session`
(`session.schema.json`) carry structurally distinct subject fields (`doctor_id` vs.
`patient_id`) for exactly this reason — see `doctor-session.md`'s dedicated security
review for how this is enforced, not just asserted.

## Fields at a glance

| Field | Half | Mutable? |
|---|---|---|
| `doctor_id` | Identity (§7.1) | No — set once, never reused |
| `created_at` | Identity (§7.1) | No — set once |
| `created_by` | Identity (§7.1) | No — set once, audit provenance |
| `full_name` | Profile | Yes |
| `role` | Profile | Yes |
| `email` | Profile | Yes |
| `specialty_slug` | Profile | Yes — optional (empty-string sentinel when unset), reserved for WPI-2 |
| `status` | Profile | Yes — `active` → `inactive` |

## A documented simplification: `specialty_slug` is not validated against a real registry

`docs/50-PHASE-3-TECHNICAL-PLAN.md` §6 designs a Specialty Registry (ADR-018), but that
registry is WPI-2's own deliverable, not WPI-1's. `foundationValidateDoctorInput_()`
(`apps-script/DoctorIdentity.gs`) only checks `specialty_slug` is a non-empty string
when present — the same deliberate, minimal choice `foundationValidatePatientInput_()`
already made for `condition_slug` at Foundation batch F3, before a real canonical list
existed to validate against (see `patient-identity.md`'s own "documented
simplification" section). `DoctorIdentity.gs` remains subject to this same gap until a
future batch (WPI-2 or later) closes it — not this file's decision to make.

## No role-based permission logic

`role` (`physician`/`staff`) is stored and returned, but nothing in WPI-1 branches on
its value — `DoctorRouteGuard.gs`'s `withFoundationDoctorAuth_()` treats every verified
`DoctorSession` identically regardless of the underlying Doctor's `role`. ADR-017's own
Future Considerations names role-differentiated permissions as plausible future work,
not designed here — consistent with this repository's "don't design for hypothetical
future requirements" discipline (docs/00).

## No public self-registration

Mirrors `patient-identity.md`'s own unconditional rule exactly: every `Doctor` row is
created by staff/administrative provisioning (`apps-script/DoctorIdentity.gs`'s
`createFoundationDoctor()`, a manually-run Apps Script editor function, mirroring
`createFoundationPatient()`'s precedent exactly), never public self-signup.

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/DoctorIdentity.gs` — never the
reverse, per `shared/README.md`.
