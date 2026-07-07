# Doctor Session

Explains `doctor-session.schema.json` (version `1.0.0`, the authoritative definition —
this file explains, it does not define, per `shared/README.md`'s format rule).

## What this schema covers, and what it deliberately does not

Mirrors `session.md`'s own framing exactly, applied to a second, permanently distinct
identity space (ADR-017). `docs/33-DOMAIN-MODEL.md` §7.1 states Doctor Session is, like
Patient Session, "not stored as a row at all in the common case" — a self-verifying,
HMAC-signed payload, not a database record. This schema defines the payload contract
(`doctor_id`, `issued_at`, `expires_at`) and reuses `session.schema.json`'s exact wire
format unchanged (below). It does not re-specify the signing algorithm — see
`session.md`'s "Why no signing algorithm is ported into a reference file," which applies
identically here.

## Wire format — identical to Patient Session's, reusing the same primitive

```
<base64url(JSON.stringify(payload))>.<base64url(HMAC-SHA256(payload_segment, secret))>
```

Byte-for-byte the same format `session.schema.json` already defines. `payload` differs
only in its subject key (`doctor_id` instead of `patient_id`).

## Dedicated Security Review (docs/50 §14 pre-ship gate)

`docs/50-PHASE-3-TECHNICAL-PLAN.md` §14, `docs/51-PHASE-3-ARCHITECTURE-READINESS-
REVIEW.md` Part 5, and `docs/52-PHASE-3-REPOSITORY-CONSISTENCY-REVIEW.md` Part 5 all
name a dedicated `DoctorSession` security review as required **before** WPI-1 ships —
deliberately not deferred to a future closeout, the correction Phase 3 makes to Phase
2A's own equivalent review only happening at PA-7 closeout (docs/43 §5/§6), after
Session had already shipped. This section is that review, performed before
`apps-script/DoctorSession.gs` was written, per the explicit instruction governing this
batch.

### 1. Which primitive, specifically, is reused — resolving docs/51 Part 1.3's named open question

`docs/50` §5.3/§5.5 states `DoctorSession` "reuses `FoundationSession.gs`'s existing
signing primitives without modifying that file," without naming which primitive
specifically. Resolved here, at implementation: **the signing secret
(`FOUNDATION_SESSION_SIGNING_SECRET`, via the unmodified
`foundationGetSessionSigningSecret_()`) and the HMAC signing function
(`foundationSignSessionPayloadSegment_()`) are both reused, unchanged, byte-for-byte
identical to how `FoundationSession.gs` and `TrustedDevice.gs`'s Long-Lived Session
already use them.** Only the payload shape and its build/validate/issue/verify wrapper
functions are duplicated (`doctor_id`-keyed instead of `patient_id`-keyed) — the same
"one small, disclosed duplication in exchange for zero risk to a frozen file" trade-off
`docs/50` §5.5 and `TrustedDevice.gs`'s own header comment already made. `FoundationSession.gs`
has zero lines changed by this batch.

**Consequence, disclosed rather than silently accepted:** Patient Session and Doctor
Session share one signing secret. A compromise of that secret would allow forging a
token of either type — a real, non-zero blast-radius cost of this design (`docs/52`
Part 1.4 already flags a related duplication risk in the same spirit). This is
accepted, not overlooked: provisioning a second Script Property secret would add a
second secret-management surface for a marginal isolation gain, and the actual
authorization boundary this section verifies next (§2) does not depend on the secrets
being different — it depends on the payload shapes being structurally distinct and
strictly validated.

### 2. No cross-identity-type authorization confusion (docs/50 §14's core requirement)

**Claim:** a valid, real `DoctorSession` token can never authorize a Patient-scoped
route, and a valid, real Patient `Session` token can never authorize a Doctor-scoped
route.

**Why this holds, mechanically, not just by convention:**
- A Doctor Session payload is `{doctor_id, issued_at, expires_at}`. A Patient Session
  payload is `{patient_id, issued_at, expires_at}`. These are disjoint key sets — a
  doctor payload has no `patient_id` key at all, and vice versa.
- `foundationVerifySessionTokenWithSecret_()` (patient, unmodified) calls
  `foundationIsValidSessionPayloadShape_()`, which requires
  `typeof payload.patient_id === 'string'`. A decoded Doctor Session payload has
  `payload.patient_id === undefined` — the check fails, and verification returns
  `{valid: false, reason: 'invalid_payload_shape'}` before `patientId` is ever derived.
- Symmetrically, `foundationVerifyDoctorSessionTokenWithSecret_()` (new, this batch)
  requires `typeof payload.doctor_id === 'string'` — a decoded Patient Session payload
  fails this check the same way.
- Both verifiers reject on a signature mismatch first (a token cannot be reshaped by an
  attacker without invalidating the signature, since the signature covers the exact
  `payload_segment` bytes) — the shape check is a second, independent line of defense
  for a token that was genuinely signed by this server but for the other identity
  type, not a defense against forgery (that is the signature's job).
- This is not merely argued here — Stage 17 of
  `validation/phase-2a-foundation/conformance.js` proves it directly: a real, freshly-
  issued `DoctorSession` token presented to `withFoundationAuth_()` (the patient guard)
  is rejected, and a real, freshly-issued patient `Session` token presented to
  `withFoundationDoctorAuth_()` (the doctor guard, this batch) is rejected — both with
  the same generic `FOUNDATION_UNAUTHORIZED`, never a distinguishing error that would
  leak which check failed.

**Conclusion:** cross-identity-type confusion is prevented by payload-shape validation
that both verifiers already perform for unrelated reasons (rejecting a malformed
payload), not by an ad hoc special-case check added defensively — the structurally
distinct subject field names (`doctor_id` vs. `patient_id`) are sufficient on their own,
matching `docs/50` §14's own stated design ("enforced by the two sessions carrying
structurally distinct, non-overlapping subject fields... never a shared, ambiguous
user id").

### 3. `doctor_id` is never client-supplied

`foundationHandleGetDoctorProfile_()` and every future doctor-authenticated route
derive `doctor_id` exclusively from `withFoundationDoctorAuth_()`'s verified session,
identically to how every existing patient route derives `patient_id` from
`withFoundationAuth_()` (docs/29 §3, §10) — no route in this batch ever reads a
client-supplied `doctor_id` field from a request body.

### 4. Session expiration, enforced plainly

`DoctorSession` reuses `FOUNDATION_CONFIG.SESSION_TTL_SECONDS` (3,600 seconds, the same
default `session.md` locks for Patient Session) — no silent renewal, no sliding expiry,
mirroring `foundationIsSessionExpired_()`'s existing fail-closed behavior directly
(reused unmodified, since it operates only on `payload.expires_at`, a field name common
to both payload shapes). A materially longer-lived "Doctor Trusted Device" analog to
`TrustedDevice.gs` is not designed by docs/50 and is not built here — WPI-1's own scope
is the base session only.

### 5. Login token: single-use, hashed, generically rejected, isolated by sheet

`DoctorLoginToken` (`doctor-login-token.schema.json`) reuses
`FoundationLoginTokens.gs`'s `foundationGenerateRawLoginToken_()` and
`foundationHashLoginToken_()` unchanged — both are already fully generic (no
`patient_id` baked into either), the same "reuse a primitive that was already generic"
pattern as §1 above. `DoctorLoginTokens.gs` stores its own rows in a separate
`DoctorLoginTokens` sheet, never `LoginTokens` — a stolen or leaked raw doctor
login-link token cannot be replayed against `consume_login_link` (the patient route),
since that route looks its presented token's hash up only in `LoginTokens`, a
disjoint dataset. Rejection is collapsed to one generic
`FOUNDATION_DOCTOR_LOGIN_TOKEN_INVALID` code for every failure mode (not found, expired,
already used, malformed), mirroring `login-token.md`'s "Rejection is deliberately
generic" section exactly.

### 6. Anti-enumeration and rate limiting on the request-link step

`foundationHandleRequestDoctorLoginLink_()` returns the exact same generic response
regardless of whether the submitted email matched a real `Doctor` record, mirroring
`foundationHandleRequestLoginLink_()`'s own docs/29 §3 discipline exactly. It reuses
`foundationCheckAndIncrementRateLimit_()` unchanged (already generic — keyed by a hash
of the normalized email, with no `patient_id`/`doctor_id` concept baked in at all).
**Disclosed, accepted overlap:** if a doctor and a patient ever shared the literal same
email address, they would share one rate-limit budget — rate limiting is a
supplementary abuse mitigation, not an authorization boundary (`FoundationRateLimit.gs`'s
own header comment already states this), so this overlap is not a security defect, only
a shared-fate availability note, consistent with why the file needed no change.

### 7. No public self-registration

`Doctor` rows are created only by `createFoundationDoctor()`, a manually-run Apps
Script editor function — mirroring `createFoundationPatient()`'s precedent exactly
(ADR-002/ADR-017's shared "no public self-registration" rule). No Web App route in this
batch can create a `Doctor` record.

### 8. Audit trail

Every issuance, rejection, and consumption event is logged via the existing, unmodified
`foundationLogAuditEvent_()`. Since that function's schema has a literal `patient_id`
column (one of the ten frozen Foundation files) and no doctor-scoped record has a real
patient to report, every Doctor-scoped audit event passes `patient_id: ''` and encodes
`doctor_id` into the `detail` string instead — the same treatment already given to
every existing patient-side event with "no natural patient" (`FoundationAudit.gs`'s own
header comment: "`patientId` and `actor` may be empty strings for events with no
natural patient/actor"). This keeps the `AuditLog` sheet's `patient_id` column free of
non-patient values (a future consumer scanning it for real patients is never misled)
without touching that frozen schema.

### Verdict

No design flaw found. The one accepted, disclosed risk (§1's shared signing secret) is
a blast-radius trade-off, not a broken boundary — the actual authorization boundary
(§2) does not depend on secret separation and is independently proven, not merely
argued, by Stage 17's conformance checks. This review clears WPI-1 to proceed, per
`docs/50` §14 and `docs/52` Part 5's own conditional "yes, for WPI-1... specifically."

## Relationship to LoginTokens/DoctorLoginTokens

Mirrors `session.md`'s own "Relationship to LoginTokens" section: a Doctor Session
token can be issued and verified independently of how it was obtained.
`foundationIssueDoctorSessionToken_()` takes an already-resolved `doctorId` as its
input, exactly like `foundationIssueSessionToken_()` does for `patientId` — it assumes
nothing about the login mechanism upstream.

## Versioning

Version `1.0.0`. Any field addition, removal, or type change to the payload requires a
new version here first, then a subsequent update to `apps-script/DoctorSession.gs` —
never the reverse, per `shared/README.md`.
