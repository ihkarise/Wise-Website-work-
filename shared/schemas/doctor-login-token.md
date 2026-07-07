# Doctor Login Token

Explains `doctor-login-token.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Mirrors `login-token.schema.json` exactly, for a second, isolated identity space

Every design decision `login-token.md` documents (why only the hash is ever stored, why
a plain SHA-256 digest rather than HMAC, where the raw token's entropy comes from,
the `used_at` sentinel-value convention, deliberately generic rejection) applies
identically here — this file does not repeat that reasoning, only the deltas.

## What's genuinely new: sheet isolation, not mechanism

`apps-script/DoctorLoginTokens.gs` stores its rows in a new `DoctorLoginTokens` sheet,
completely separate from `LoginTokens`. This is the real security property this split
provides: a stolen or leaked raw doctor login-link token cannot be replayed against
`consume_login_link` (the patient route) even if an attacker somehow guessed a patient
existed with the matching hash, because `foundationConsumeLoginToken_()` (patient) only
ever looks its presented token up in `LoginTokens` — a disjoint dataset from
`DoctorLoginTokens`. See `doctor-session.md`'s dedicated security review §5 for the full
analysis.

## What's reused, unchanged

`apps-script/DoctorLoginTokens.gs` calls `FoundationLoginTokens.gs`'s
`foundationGenerateRawLoginToken_()` and `foundationHashLoginToken_()` directly — both
were already fully generic (neither references `patient_id` or any patient-specific
concept), so no doctor-specific variant of either was needed. Zero lines changed in
`FoundationLoginTokens.gs`.

## TTL

15 minutes (900 seconds) — the same value `FOUNDATION_LOGIN_TOKEN_TTL_SECONDS_` already
locks for the patient side, declared as its own local constant in
`DoctorLoginTokens.gs` (mirroring `FoundationLoginTokens.gs`'s own "local constant, not
a frozen config file" convention) rather than shared, since the two entities'
lifetimes are independently tunable in principle even though they start identical.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `token_hash` | Yes | No — permanent, the row's effective identity |
| `doctor_id` | Yes | No |
| `issued_at` | Yes | No |
| `expires_at` | Yes | No |
| `used_at` | Yes (as `''`) | Once — `''` → consumption timestamp, never again (single-use) |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/DoctorLoginTokens.gs` — never the
reverse, per `shared/README.md`.
