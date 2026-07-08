# Notification

Explains `notification.schema.json` (version `1.0.0`, the authoritative definition —
this file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch WPI-6 (docs/50-PHASE-3-TECHNICAL-PLAN.md §9, §19)

Promotes `docs/33-DOMAIN-MODEL.md` §4.2 from *Designed* to *Implemented*. A shared
*record* of what was sent — **never a new delivery pipeline** (docs/50 §9's own words).
Every existing sender keeps its own transport code entirely unchanged and additionally
writes a Notification row. Governed by `docs/53-PHASE-3-IMPLEMENTATION-RULES.md`.

## Why now: the "third flow" trigger has been passed

`docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md` named Notification as "worth unifying
before a third ad hoc email flow is built." By the time this batch shipped, four
independent flows existed or were named: Phase 1.5's visit-summary email (`Send.gs`),
Foundation's patient login-link email (`FoundationLoginFlow.gs`), and two future flows
this plan itself names (Inventory low-stock, PillFill order-status, neither built yet).
A fifth, structurally identical flow — the doctor login-link email
(`DoctorLoginFlow.gs`, Batch WPI-1) — ships between docs/34's finding and this batch's
implementation. All three *currently real* senders are unified by this batch; the two
future ones adopt the same mechanism when their own batches (WPI-7/WPI-8) build them.

## Ownership: system-generated only

**No human ever authors, edits, or deletes a Notification row directly** — the same
ownership model `Session` already has (docs/50 §9's own words). There is no
manually-run Apps Script editor function for this entity (unlike every doctor/staff-
owned Phase 2B/WPI entity to date) and no `FoundationRouter.gs` dispatch case in this
batch — see "No route in this batch" below for why.

## Three existing sender flows write a Notification row, additively

Each is a disclosed, additive touch to an otherwise-frozen file — mirroring
`PXP-4`/`WPI-4`'s own "authorized migration" precedent for touching a frozen file when
the batch's own architecture literally requires it (docs/53 §6). No sender's own
transport code, gate logic, or existing behavior changes — each gains exactly one
additional call, after its existing send attempt, to
`foundationRecordNotification_()`.

1. **`apps-script/FoundationLoginFlow.gs`** (`foundationHandleRequestLoginLink_`) —
   records `type: login_link`, `patient_id: <the resolved patient's id>`, `status:
   'sent'` or `'failed'` matching `foundationSendLoginLinkEmail_()`'s own real result.
   Only recorded when a matching patient was found (docs/29 §3's anti-enumeration
   discipline is unaffected — no row is written, and no enumeration signal created, for
   an unmatched email).
2. **`apps-script/DoctorLoginFlow.gs`** (`foundationHandleRequestDoctorLoginLink_`) —
   the identical pattern, `doctor_id` in place of `patient_id`, mirroring
   `FoundationLoginFlow.gs`'s own new call exactly.
3. **`apps-script/Send.gs`** (`attemptSend_`) — records `type: visit_summary`,
   `status: 'sent'` or `'failed'` matching the real email result. **`patient_id` and
   `doctor_id` are both empty-string sentinels here** — Phase 1.5's `ConsultationSummary`
   row (`apps-script/Schema.gs`) predates Patient Identity entirely and carries no
   `patient_id` of any kind, only `recipient_email`. `recipient_email` (this batch's
   disclosed, additive fallback field) carries `row.recipient_email` instead.

None of the three sender files' own gate logic, gate conditions, transport mechanism,
or existing return values change — the only addition is one new statement writing a
Notification row after the existing send attempt completes, in addition to (never
instead of) each file's own existing `email_status`/audit-log bookkeeping.

## The `recipient_email` fallback field — a disclosed, additive gap-fill

docs/50 §9 states the "subject reference" is "`patient_id` or `doctor_id`" — it does
not anticipate a sender with neither, since every flow named in Pillar 1/2's Foundation
work has a real Patient or Doctor Identity to reference. Phase 1.5's visit-summary flow
is the one exception: it was built before Patient Identity existed
(`docs/33-DOMAIN-MODEL.md` §2.2's own history), and its `ConsultationSummary` row has no
`patient_id` column to borrow. Rather than fabricate a `patient_id` this batch cannot
actually verify, or silently drop that flow from unification, `recipient_email` is
added as a disclosed, additive third subject-reference field — the same category of
implementation-time field-level decision `Appointment.gs`'s `created_by` and
`CarePlan.gs`'s `version_key` already made for their own schema-necessary fields
docs/50/docs/44 named the entity's purpose for but did not themselves spell out as a
field.

## Validation rule: exactly one subject reference, never zero, never more than one identity field

- `patient_id` and `doctor_id` are never both non-empty on the same row (a notification
  concerns one subject, not both).
- At least one of `patient_id`, `doctor_id`, or `recipient_email` must be non-empty —
  every Notification has some subject reference, even when it isn't a real Identity
  (Phase 1.5's case).
- `channel` must be `'email'` — the only channel that exists today.
- `type` must be one of the five named types. `appointment_reminder`,
  `inventory_low_stock`, and `pillfill_order_status` are reserved, never produced by any
  code in this batch — no Appointment reminder flow, Inventory, or PillFill Integration
  exists yet (WPI-7/WPI-8).
- `status` must be `'sent'` or `'failed'` when written by this batch's own code —
  `'read'` is reserved for a future in-app channel, named in the enum for schema
  completeness, never set by any code this batch ships.
- `sent_at` is always server-set (`foundationNowIso_()`), never caller-supplied.

All rejections are `FOUNDATION_INVALID_INPUT`, the same convention every other entity's
input validation already follows.

## No route in this batch — mirrors `Session`, not `CalculatorResult`

Unlike `CalculatorResult` (Batch PXP-6, backend-only but still shipped real
authenticated `submit_calculator_result`/`get_calculator_results` routes),
`Notification` ships with **zero `FoundationRouter.gs` dispatch case** — no
`get_notifications` route, no patient- or doctor-facing read surface at all in this
batch. docs/50 §9 itself draws the analogy to `Session`, not to any
patient-writable entity: "Ownership: System-generated only, mirroring Session's own
ownership model" — and `Session` has no corresponding "get my session" route either. A
future dashboard "Messages" module (named, not scoped, anywhere in current
documentation) would be the natural future consumer of a read route; this batch
delivers only the write-side unification docs/50 §9 scopes, per docs/47 §6/docs/53 §6's
"no silent scope expansion" discipline.

## Read helpers exist, but are internal-only in this batch

`foundationGetNotificationsForPatient_(patientId)` and
`foundationGetNotificationsForDoctor_(doctorId)` (`apps-script/Notification.gs`) satisfy
docs/53 §5's "an Apps Script module... for its create/read... operations" requirement
and are exercised directly by Stage 22 of the conformance harness. Neither is reachable
over HTTP in this batch — both are plain internal functions, the same "read primitive
exists, no route wraps it yet" shape `foundationDsQuery_()` itself had before any
consumer used it (docs/35 §6).

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `notification_id` | Yes (server-generated UUID) | No |
| `patient_id` | Yes (server-derived from the sending flow's own resolved identity, empty-string sentinel otherwise) | No |
| `doctor_id` | Yes (server-derived, empty-string sentinel otherwise) | No |
| `recipient_email` | Yes (only when patient_id/doctor_id are both empty — Phase 1.5's visit-summary flow) | No |
| `channel` | Yes (`'email'`) | No |
| `type` | Yes (set by the calling sender) | No |
| `status` | Yes (`'sent'`/`'failed'`, matching the real transport result) | No |
| `sent_at` | Yes (server-set) | No |

Every field is write-once — there is no update operation for this entity at all,
mirroring `Session`'s own "born, lives, expires, never edited" shape more closely than
any mutable entity's.

## Zero modification to any sender's own gate, transport, or bookkeeping logic

`evaluateSendGate_()` (`Send.gs`), `sendVisitSummaryEmail_()` (`Email.gs`),
`foundationSendLoginLinkEmail_()` (`FoundationEmail.gs`),
`foundationSendDoctorLoginLinkEmail_()` (`DoctorEmail.gs`), and every rate-limiting/
anti-enumeration rule already in place are entirely unchanged. This batch's only
footprint in each of the three sender files is one additional statement, after the
existing send attempt, recording the outcome that already happened.

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/Notification.gs` — never the
reverse, per `shared/README.md`.
