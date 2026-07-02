# ADR-002: Patient Identity Is Independent of Authentication

## Status
Accepted

## Context
docs/09-PHASE-2-ARCHITECTURE.md describes patient access as a single "Entry Point"
concept — "Patient ID + Password or Mobile OTP" — without distinguishing between *who
a patient is* and *how they currently prove it*. Left unexamined, this invites a design
where a patient's permanent records (consultation history, symptom logs, reports, and
later Care Plan / Digital Twin data) end up keyed by an authentication credential
(email address, phone number) rather than a durable identity — which breaks the moment
that credential changes (a patient's email changes, a phone number is reassigned, or
the platform adds a new login method).

## Decision
Every patient is identified by a stable, platform-generated `patient_id` (a UUID),
created once at onboarding and never reused, recycled, or changed for the lifetime of
that patient's relationship with Wise. Every clinical or operational record —
consultation history, symptom logs, uploaded reports, and any future Personal Care Plan
or Digital Twin data — references `patient_id`, never an authentication credential
directly.

Authentication credentials (today: a registered email address used for magic-link
login, per ADR-003) are a separate, attached layer that *resolves to* a `patient_id`.
The relationship is one-directional: credentials point at an identity; an identity does
not depend on any specific credential existing or staying the same.

## Consequences
- Slightly more schema design up front: an identity record is separate from whatever
  resolves login attempts to it, rather than one merged "user" row.
- The authentication mechanism can change at any time (see ADR-003) — email magic link
  today, SMS OTP or Workspace SSO later — without migrating or re-keying a single
  historical patient record.
- A patient could, in the future, have more than one authentication method attached to
  the same identity without any redesign.
- Every Phase 2A endpoint must derive `patient_id` from a verified credential/session,
  never accept it as client-supplied input — this is both an identity-model consequence
  and a security requirement (see ADR-010, docs/29 §3 and §10).

## Future Considerations
Identity resolution/merging (what happens if two accounts are accidentally created for
the same real person) is not solved by this ADR and has no known Phase 2A occurrence.
Address it if and when it becomes a real operational problem, as its own ADR — do not
retrofit a speculative merge mechanism now.
