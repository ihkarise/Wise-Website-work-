# Phase 2B Batch PXP-8 Browser Testing — Trusted Device + Long-Lived Session

Browser-driven verification for Batch PXP-8 (docs/44-PHASE-2B-TECHNICAL-PLAN.md §5,
docs/47-PHASE-2B-IMPLEMENTATION-RULES.md §3, ADR-015) — Persistent Authentication:
`login.html`'s silent trusted-device recovery gate, `verify.html`'s opt-in "Keep me
signed in on this device" checkbox, and the new `my-health-journey/devices/` Manage
Devices page (plus the one disclosed nav link added to the dashboard shell).

## What this proves

Every check exercises the real code end to end with the backend mocked at the
network layer (Playwright `page.route`), the same discipline every earlier
PA-*/pxp-* browser test already uses:

1. **No stored device token → the login form shows immediately**, no delay, no
   behavior change for the overwhelming majority of patients who never opt in.
2. **A valid stored device token silently signs the patient in and redirects
   straight to the dashboard** — the new Long-Lived Session token lands in
   `sessionStorage` (unchanged from Phase 2A, docs/29 §3), and the newly-rotated
   device token replaces the old one in `localStorage`.
3. **An invalid/expired/revoked device token falls back to the normal login form**
   and clears the stale token from `localStorage` — it is never retried forever.
4. **`?reason=expired` still shows the unchanged, generic session-expiry message
   when there is no trusted device to recover with**, and **never shows that
   message at all when a valid trusted device silently recovers the session** —
   this recovery *is* the batch's own "session renewal" mechanic (no separate
   "renew" action exists; `shared/schemas/trusted-device.md`).
5. **`verify.html`'s "Keep me signed in on this device" checkbox is unchecked by
   default** (docs/44 §5.2, passwordless-by-default reaffirmed) — checking it
   stores a real device token after sign-in succeeds; leaving it unchecked writes
   nothing to `localStorage` at all.
6. **The Manage Devices page** renders one item per device (an active device with
   a Revoke button; a revoked device labeled "Revoked" with no button, a one-way
   transition), falls back to "Unnamed device" for an empty `device_label`, shows a
   friendly empty state with zero devices, and a real click on Revoke re-loads the
   list to reflect the change.
7. **The dashboard's disclosed "Manage Devices" link** is present and navigates to
   the real page.

## What this does not prove

Runs against the real static files but a mocked backend response — the same
category of limitation the whole PA-*/pxp-* browser-test family already states.
The backend's own `mark_device_trusted`/`consume_trusted_device`/
`get_trusted_devices`/`revoke_trusted_device` routes (rotation, sliding expiry,
revocation, cross-patient isolation, and the Long-Lived Session token's own longer
TTL verified against the real, unmodified `FoundationSession.gs`) are covered by
`validation/phase-2a-foundation/conformance.js`'s Stage 16, added in this same
batch, not duplicated here.

## Frozen-file footprint — deliberately minimized

This batch's design choice (each file's own header comment has the full
disclosure) keeps the touched-frozen-file list to exactly three: `login.html`
(the one universal silent-recovery point every session-guarded page's existing
redirect already lands on), `verify.html` (the opt-in checkbox), and
`my-health-journey/index.html` (one new nav link, mirroring PXP-1's own "My
Profile" link precedent exactly). **`my-health-journey/dashboard.js` and
`my-health-journey/session-guard.js` are both completely untouched** — `git diff
--stat` on both is empty. This suite's Tests #1–5 exercise `login.html` directly;
Test #11 proves `my-health-journey/devices/` still redirects through the
unmodified `session-guard.js` exactly as every other PA-3-onward page already
does.

## Running it

Requires Playwright (`npm install playwright` in the repo root — this
environment has Chromium pre-fetched at `/opt/pw-browsers`, matching
`playwright@1.56`). If Playwright is only available globally:

```
NODE_PATH=$(npm root -g) node validation/pxp-8-persistent-login/browser-test.js
```

## Result (last run)

See the batch's PR description and CHANGELOG entry for the check counts.
