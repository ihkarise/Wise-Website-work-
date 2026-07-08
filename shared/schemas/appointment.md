# Appointment

Explains `appointment.schema.json` (version `1.0.0`, the authoritative definition —
this file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch WPI-5 (docs/50-PHASE-3-TECHNICAL-PLAN.md §8, §19)

The scheduled or requested clinical encounter that precedes, and once held becomes, a
Consultation (docs/33-DOMAIN-MODEL.md §2.1/§4.1) — concretely closing docs/20 §3's
"THE GAP" between a public booking-form submission and the platform's own
patient-facing history, for the first time. Governed by
`docs/53-PHASE-3-IMPLEMENTATION-RULES.md`.

## Staff/doctor-owned, not patient-owned — a hard boundary

**There is no patient-facing write path for this entity in this batch's scope**
(docs/50 §8's own "Staff/doctor-facing only"). Every write — creation, confirmation,
and every later status transition — is a doctor/staff action, enforced server-side.
Because the intake mechanism (how a `contact.html`/Netlify Forms booking submission
becomes a real `Appointment` row) is deliberately left as an implementation-time
decision by docs/50 §8, this batch resolves it as a staff-run tool
(`createFoundationAppointment()`, `apps-script/Appointment.gs`) — a manually-run Apps
Script editor function staff use to transcribe an accepted booking request, mirroring
`DoctorAssignedCondition.gs`'s `assignFoundationCondition()` precedent exactly, rather
than a new, unauthenticated public write endpoint. This is the smallest,
most-consistent-with-precedent choice available and is disclosed here explicitly, not
silently assumed.

**The doctor does get one, read-only, `DoctorSession`-derived route** —
`get_doctor_appointments` — mirroring `get_doctor_patient_roster`'s exact WPI-4
precedent. It returns the caller's own specialty-derived Appointments view, deriving
`doctor_id` exclusively from the verified session.

## Nullable `patient_id`/`doctor_id` — a real lifecycle, not an oversight

A first-time visitor booking has no Patient Identity yet, and no Doctor is assigned
until the appointment is confirmed (docs/50 §8's own words). Both fields are
empty-string sentinels until real, mirroring `doctor-instruction.schema.json`'s
`consultation_id`/`doctor-assigned-condition.schema.json`'s `resolved_at` conventions.
When non-empty, each is validated against a real Patient Identity/Doctor at write time.

## Lifecycle: one-way, exactly-once transitions

```
requested ──confirm──> confirmed ──complete──> completed
    │                       │
    └──────cancel───────────┘
```

A row is created `requested`. The confirm operation (`foundationConfirmAppointment_()`)
assigns a real `doctor_id` and a real `scheduled_at`, transitioning to `confirmed` —
this is a dedicated operation, not folded into the generic status-update function,
since it is the one transition that also assigns data beyond `status` itself. A
confirmed appointment may transition to `completed`. `requested` or `confirmed` may
transition to `cancelled`. Every transition is one-way, exactly once, never
reverted — mirroring `DoctorInstruction.gs`'s own one-way status-transition discipline
exactly; a new `Appointment` row is created instead of ever reopening a terminal one.

## `specialty_slug` — server-derived once, never staff-supplied

Derived from `condition_slug` via `SpecialtyRegistry.gs`'s
`foundationGetSpecialtyForCondition_()` (ADR-018, docs/50 §6.3) at creation time only —
never recomputed afterward, even if the condition-to-specialty map itself later
changes. The Doctor Dashboard's Appointments capability (`get_doctor_appointments`)
derives which doctors see a given appointment from this field, the same
specialty-derivation discipline `DoctorPatientRoster.gs`'s patient roster already
establishes for the same reason — including that mechanism's own disclosed
multi-doctor-per-specialty limitation (docs/50 §7.4, docs/51 Part 1.6): every doctor in
a specialty sees every appointment in that specialty, not a personal, per-doctor view.
A single-doctor-per-specialty deployment (the platform's actual scale today) sees no
practical difference.

## `created_by` — a disclosed, additive field

docs/50 §8 does not name a provenance field in its own literal attribute list.
`created_by` is this batch's disclosed, additive completion of that gap — necessary
audit-trail provenance, the same category of implementation-time field-level decision
`CarePlan.gs`'s `version_key` already made for its own schema-necessary field docs/44
§12 did not itself spell out.

## Doctor Module Registry entry: `appointments`

Batch WPI-5 registers `shared/constants/doctor-module-registry.json`'s second real
entry — `appointments`, `data_source: get_doctor_appointments`, `display_order: 20`
(after `patient_roster`'s `10`). The Doctor Dashboard (`doctor-dashboard/dashboard.js`)
renders one new, read-only card listing each visible appointment's linked patient (or a
"Not yet linked to a patient record" fallback), condition, status, and scheduled time —
no write affordance, mirroring the Patient Roster card's own "derived, read-only view"
discipline exactly. No `specialty_scope` is populated on this entry, mirroring
`patient_roster`'s own precedent — the platform still has only one seeded specialty
(docs/53 §4: each registry adopts the field independently, at whichever batch actually
needs it).

## Validation rules

- `condition_slug`: required, must be one of the canonical slugs (manually adapted into
  `FOUNDATION_APPOINTMENT_ALLOWED_CONDITION_SLUGS_`, the same duplication-by-convention
  `doctor-assigned-condition.schema.json`'s own allowlist already established).
- `created_by`: required, non-empty (the staff/doctor identifier).
- `patient_id`/`doctor_id` at creation: optional; when supplied, must be a non-empty
  string that references a real Patient Identity/Doctor.
- Confirm operation: `appointment_id` must reference an existing, currently-`requested`
  row; `doctor_id` is required and must reference a real Doctor; `scheduled_at` is
  required, non-empty.
- Status-update operation: `appointment_id` must reference an existing row whose current
  status permits the requested transition (`FOUNDATION_APPOINTMENT_TRANSITIONS_`);
  `status` must be `completed` or `cancelled` (`confirmed` has its own dedicated
  operation, above).

All rejections are `FOUNDATION_INVALID_INPUT`, returned directly, the same convention
every other entity's input validation already follows.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `appointment_id` | Yes (server-generated UUID) | No |
| `patient_id` | Yes (staff-supplied, empty-string sentinel if none) | No |
| `doctor_id` | `''` | Yes — once, by the confirm operation |
| `requested_at` | Yes (server-set) | No |
| `scheduled_at` | `''` | Yes — once, by the confirm operation |
| `status` | Yes (`'requested'`) | Yes — one-way, per `FOUNDATION_APPOINTMENT_TRANSITIONS_` |
| `condition_slug` | Yes (staff-supplied, validated) | No |
| `specialty_slug` | Yes (server-derived from condition_slug) | No |
| `created_by` | Yes (staff/doctor-supplied) | No |

## No patient write path — ever, in this batch

There is no create/confirm/status-update Web App route in `FoundationRouter.gs`. The
only route this batch adds is the read-only `get_doctor_appointments`. Every write
remains a manually-run Apps Script editor function
(`createFoundationAppointment()`/`confirmFoundationAppointment()`/
`updateFoundationAppointmentStatus()`), mirroring every earlier doctor/staff-only
entity's precedent exactly — not a gap to close later by this batch's own design,
unlike docs/33 §1.4's now-resolved Doctor Identity gap.

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/Appointment.gs` — never the
reverse, per `shared/README.md`.
