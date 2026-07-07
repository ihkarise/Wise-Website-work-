# Trusted Device

Explains `trusted-device.schema.json` (version `1.0.0`, the authoritative definition —
this file explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch PXP-8 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §5, §22, ADR-015)

This contract, and `apps-script/TrustedDevice.gs`'s implementation of it, back Phase
2B's Persistent Authentication capability — Trusted Device and the Long-Lived Session it
grants. Governed by `docs/47-PHASE-2B-IMPLEMENTATION-RULES.md`. **Magic Link remains the
sole root of trust** (docs/44 §5.1/§5.7) — this entity is an additive convenience layer
alongside it, never a replacement.

**PIN (`PatientCredential`) is explicitly out of scope for this batch**, per docs/45's
Part 5 finding that it "requires its own dedicated security review... independent of
Trusted Device/Long-Lived Session" and docs/44 §22's own PXP-8 row. Nothing in this
batch implements, schemas, or routes a PIN.

## Patient-owned — the one entity in this phase that is

Every other Phase 2B entity shipped so far (`DoctorAssignedCondition`,
`PatientModuleState`, `CheckInTemplateAssignment`, `CarePlan`, `DoctorInstruction`) is
doctor/staff-owned, written only through manually-run Apps Script editor functions,
because no real Doctor identity/session exists yet (docs/33 §1.4). `TrustedDevice` is
different: it is the patient's own device credential, not clinical content, so every
write (`mark_device_trusted`, `revoke_trusted_device`) is a real, authenticated Web App
route the patient calls directly, `patient_id` always session-derived. **No
manually-run editor wrapper exists for this entity** — the first Phase 2B entity for
which one isn't needed.

## Lifecycle

1. **Creation (`mark_device_trusted`, authenticated).** After a patient signs in via
   Magic Link, they may mark the current device as trusted. The server generates a raw
   device token (reusing `FoundationLoginTokens.gs`'s `foundationGenerateRawLoginToken_()`
   — "the same entropy class as LoginToken," ADR-015 §Decision 1), hashes it
   (`foundationHashLoginToken_()`, plain SHA-256, no new cryptographic bridge), and
   stores only the hash. The raw token is returned exactly once and never persisted
   anywhere server-side after this call returns — the same discipline
   `login-token.md`'s own raw token already follows. The client stores it in
   `localStorage` (deliberately distinct from the Session token's own `sessionStorage`,
   docs/29 §3 — see "Where each token lives" below).
2. **Presentation (`consume_trusted_device`, unauthenticated — the device token itself
   is the credential).** Hashes the presented raw token, looks it up, rejects generically
   (`FOUNDATION_TRUSTED_DEVICE_INVALID`, mirroring `FOUNDATION_LOGIN_TOKEN_INVALID`'s
   "rejection is deliberately generic" discipline) if not found, revoked, or expired —
   never distinguishing which. On success: **rotates** the stored hash to a freshly
   generated raw token (returned once, replacing the client's stored value), extends
   `expires_at` (a sliding window — see "Sliding device expiry" below), stamps
   `last_used_at`, and issues a **Long-Lived Session** token. This one action is also
   this design's "session renewal" — a returning patient's client calls it again
   whenever it finds no valid Session token, silently refreshing both the device token
   and the session it grants, with no separate "renew" action needed (docs/47 §4:
   "extend an existing pattern whenever possible").
3. **Revocation (`revoke_trusted_device`, authenticated, patient-only, self-service).**
   One-way, exactly-once, mirrors `DoctorAssignedCondition`'s resolve discipline exactly.
   An unknown or another patient's `device_id` is rejected with the same generic
   `FOUNDATION_NOT_FOUND` `get_timeline_entry`'s own cross-patient check already uses
   (docs/40-CONSULTATION-IDENTITY-STRATEGY.md Q3) — never distinguishing "doesn't exist"
   from "not yours."

## Long-Lived Session — an additive wrapper, `FoundationSession.gs` untouched

docs/44 §5.5 named this an open, implementation-time decision for this exact batch:
either parameterize the frozen `FoundationSession.gs` (its own bug-fix-scope
justification required), or add a wrapper that calls its existing signing primitive
with a different constant. **This batch chooses the wrapper, in full:**
`apps-script/TrustedDevice.gs`'s `foundationIssueLongLivedSessionToken_()` calls
`FoundationSession.gs`'s own already-existing, unmodified pure helpers
(`foundationBuildSessionPayload_`, `foundationBase64UrlEncodeString_`,
`foundationSignSessionPayloadSegment_`, `foundationGetSessionSigningSecret_`,
`FOUNDATION_SESSION_TOKEN_SEPARATOR_`) with `FOUNDATION_LONG_LIVED_SESSION_TTL_SECONDS_`
(a local constant in this file, mirroring `FoundationLoginTokens.gs`'s own
`FOUNDATION_LOGIN_TOKEN_TTL_SECONDS_` precedent for not reopening the frozen
`FoundationConfig.gs`) in place of `FOUNDATION_CONFIG.SESSION_TTL_SECONDS`. The token
produced is byte-for-byte the same wire format `session.schema.json` already defines —
`foundationVerifySessionToken_()` verifies it completely unmodified.
**Zero lines changed in `FoundationSession.gs`, `FoundationRouteGuard.gs`, or
`session.schema.json`.** A magic-link-issued session still gets exactly the unchanged
3600-second TTL — proven directly in `validation/phase-2a-foundation/conformance.js`'s
Stage 16.

Per docs/33-DOMAIN-MODEL.md's own line, a Long-Lived Session "is not a stored entity of
its own, a parameterization of the existing Session mechanism" — no new schema exists
for it.

## Where each token lives — `sessionStorage` unchanged, `localStorage` new and additive

docs/29 §3 requires the Session token to live **only** in `sessionStorage`, cleared on
tab close — unchanged by this batch, including for a long-lived Session token. What
makes login "persistent" across a closed browser is the separate, new
`TrustedDevice` raw token, stored in `localStorage` under `wise_trusted_device_token`
(`my-health-journey/device-trust.js`). The two tokens have different jobs: the Session
token is what every authenticated request presents; the device token is only ever
presented once, silently, to obtain a fresh Session token when none is present — it is
never sent as `session_token` to any route.

## Sliding device expiry — a deliberate, disclosed difference from the Session's own design

`FoundationSession.gs`'s Session TTL is fixed and non-renewing by design (ADR-010: "no
silent renewal... this function only ever answers 'is this instant past expiry,' never
extends one") — left completely unchanged by this batch. `TrustedDevice.expires_at` is
different on purpose: it slides forward on every successful use
(`FOUNDATION_TRUSTED_DEVICE_TTL_SECONDS_`, 90 days), so a patient who returns periodically
stays trusted indefinitely, while a genuinely dormant device naturally falls back to
Magic Link once its expiry passes. This is what "persistent login" is required to
deliver (docs/44 §5.1 mechanism 2/3) and does not change the base Session mechanism's
own non-renewing behavior at all — a Long-Lived Session token, once issued, is not
itself extended; a fresh one is obtained by presenting the (possibly just-rotated)
device token again.

## Disclosed limitation: revocation stops renewal, it does not retroactively kill an already-issued Long-Lived Session

ADR-015 §Decision 4 states revoking a Trusted Device "invalidates the long-lived access
it was granting." Taken literally and immediately, this would require
`FoundationSession.gs`'s verification to consult a revocation list on every request —
but that file is frozen, stateless by design, and this batch's own §5.5 decision
(above) is not to touch it. **The honest, disclosed consequence:** revoking a
`TrustedDevice` immediately and permanently prevents that device token from ever being
exchanged for a new Long-Lived Session again (`consume_trusted_device` rejects it from
that instant on) — but a Long-Lived Session token already issued and currently held by
a browser's `sessionStorage` remains valid until its own embedded `expires_at` naturally
elapses, up to `FOUNDATION_LONG_LIVED_SESSION_TTL_SECONDS_` (14 days) after issuance.
This bounds the exposure window of a revoked-but-still-live session to at most 14 days
— a real, deliberate tradeoff of honoring the "do not touch frozen files for new
functionality" rule (docs/47 §6), disclosed here rather than silently assumed away, the
same discipline `care-plan.md`'s own disclosed Timeline-integration gap already
modeled. `FOUNDATION_LONG_LIVED_SESSION_TTL_SECONDS_`/`FOUNDATION_TRUSTED_DEVICE_TTL_SECONDS_`
are both local, tunable constants (ADR-015's own "Future Considerations: exact TTL... an
implementation-time parameter... not fixed here") — shortening the Long-Lived Session
TTL directly shortens this exposure window and can be revisited once real usage data
exists (ADR-010's established tuning posture), without any schema or architecture
change.

## No Module Registry entry — this is infrastructure, not a patient module

Mirrors `PatientProfile`'s own precedent (docs/44 §17 "Patient Profile" note) exactly:
Persistent Authentication is not a dashboard capability a doctor enables per patient —
it is available to every patient, always, the same way Magic Link itself is. The one
patient-facing surface is a plain nav link ("Manage Devices," `my-health-journey/index.html`,
mirroring PXP-1's own disclosed "My Profile" link) to `/my-health-journey/devices/`, not
a Module Registry entry or a dashboard card.

## Validation rules

- `device_label`: optional; when provided, trimmed, capped at 60 characters.
- Every write derives `patient_id` from the verified session (`mark_device_trusted`,
  `revoke_trusted_device`) — never client-supplied, the same authorization primitive
  every other Foundation route already uses.
- `consume_trusted_device` is the one unauthenticated route this batch adds, mirroring
  `consume_login_link`'s own precedent exactly (the presented token itself is the
  credential — there is no session yet to authenticate with).

## Fields at a glance

| Field | Set at creation? | Changes on use? | Patient-visible via `get_trusted_devices`? |
|---|---|---|---|
| `device_id` | Yes (server UUID) | No | Yes |
| `patient_id` | Yes (session-derived) | No | Yes |
| `device_token_hash` | Yes | Yes (rotates every use) | **No — deliberately omitted** |
| `device_label` | Yes (patient-supplied, optional) | No | Yes |
| `created_at` | Yes (server-set) | No | Yes |
| `last_used_at` | Empty-string sentinel | Yes (server-set on each use) | Yes |
| `expires_at` | Yes (server-set) | Yes (slides forward on each use) | Yes |
| `revoked_at` | Empty-string sentinel | Yes (set once, on revoke) | Yes |
| `revoked_by` | Empty-string sentinel | Yes (set once, on revoke) | Yes |

## Versioning

Schema version `1.0.0`. Any field addition, removal, or type change requires a new
version here first, then a subsequent update to `apps-script/TrustedDevice.gs` — never
the reverse, per `shared/README.md`.
