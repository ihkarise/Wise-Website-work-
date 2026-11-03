# 62 — Production Launch Closure Report
## Version 1.0 — 2026-09-30

> Engineering closure record. **No legal claim is made anywhere in this
> document.** Nothing here states that the website is "fully legally
> compliant", "DPDP compliant", "GDPR compliant", "FDA compliant" or
> "legally approved". Items needing a lawyer, a provider or the owner are
> listed separately and **require final legal/provider review**.

---

## A. Completed in this closure pass

1. **`[ADD FEE]` removed from the production-facing website.**
   `online-consultation/index.html` now reads `Consultation fee applies.`
   (the owner's exact wording), with its stale `TODO` comment deleted. **No fee
   amount was invented.** Repository-wide search confirms the only remaining
   occurrences of the string are in `.md` documentation and history files, none
   of which `.gitlab-ci.yml` publishes.

2. **Under-18 guardian declaration is now conditionally enforced.**
   On `contact.html`, the guardian declaration becomes `required` only when the
   visitor answers **Yes** to "Is this enquiry about someone under 18?", and the
   row is visually highlighted. It reuses the exact client-gate pattern already
   in `internal/consultation-summary.html` (`updateSubmitState()`). Without
   JavaScript the row stays visible and optional, so the form can never become
   unsubmittable. See §C for what this does **not** claim.

3. **Blog authoring template excluded from the published artifact.**
   `blog/post-template/` ships `CHANGE-ME` placeholder text to a public URL.
   `.gitlab-ci.yml` now removes it from `public/`. It is a template, not a page:
   unlinked, absent from `sitemap.xml`. **No `noindex` was added and no canonical,
   sitemap, robots or structured-data rule was touched** — deliberately, given
   the earlier `noindex` regression.

Everything from the prior owner-decision pass is retained unchanged: the four
approved reviews, `6+ countries`, the Free General Enquiry / paid consultation
distinction, `REPORTS_UPLOAD_ENABLED = false`, the AI-assisted labelling, the
emergency notices, the two-layer privacy policies.

## B. Verified

| Check | Result |
|---|---|
| Static analysis (71 `.gs` files) | **PASS — 0 findings** |
| Conformance | **PASS — 875/875, 0 failed** |
| Phase 1.5 regression | **PASS — 45/45** |
| Browser suites | **18/19, 0 failed checks** |
| `phase-2c-milestones` | Pre-existing flake — 0/2/2 on a clean `e8e794e` worktree predating this branch |
| Report-upload disabled-state tests | **PASS** — `pa-5-reports` 28/28, `pa-2-dashboard` 30/30 |
| Public navigation | **PASS** — `pa-6-public-nav` 22/22 |
| HTML tag balance | Clean on every changed file |
| Broken-link audit (32 pages) | Only unresolved reference is `assets/favicon.ico` (missing asset, not a broken link) |
| `sitemap.xml` | Well-formed XML; all 11 `<loc>` targets resolve |
| `.gitlab-ci.yml` | Valid YAML; asserts `index.html`, `404.html`, `sitemap.xml` are published |
| Placeholder scan | **0** pages with visible placeholder text after the template exclusion |
| Forbidden-claims scan | **0** hits in visible text (see §D list) |
| SEO surfaces | No canonical, OG, structured-data, sitemap-structure, robots or `noindex` change in this pass |

## C. Owner-confirmed and preserved

| Item | State in repository |
|---|---|
| Consultation fee applies | `online-consultation/index.html` — exact wording, no amount |
| Under-18 allowed with guardian consent | Required minor question + conditionally-required guardian declaration on `contact.html`; guardian involvement stated in `patient-privacy.html` |
| 8+ years experience | Retained, unmodified (`index.html`, `team.html`, `online-consultation/`) |
| 5000+ patients | Retained, unmodified |
| NTET 2025 | Retained, unmodified (`team.html`) |
| TCMC 12515 | Retained, unmodified (`team.html`, `online-consultation/`) |
| Four approved reviews | Fathima Nazrin, Shareena Habeeb, Mahesh Madhavan, Joseph Alex — verbatim, no stars, no rating schema. Prejitha Sp and Aathi Sai **not** added. Four doctor reviewers remain excluded |
| Report upload disabled at launch | `REPORTS_UPLOAD_ENABLED = false`; backend zero-diff |

### What the guardian gate does NOT claim

**No schema in `shared/schemas/` contains any consent field.** Verified: a
repository-wide search for a `*consent*` property across all 31 schema files and
all 71 `.gs` files returns nothing. Phase 1.5's `patient_consent_confirmed` lives
in its own Apps Script Sheet columns, not in the shared schema layer.

Therefore:

- The guardian declaration is **recorded as a form field by the form processor**,
  and is **enforced at the point of collection**.
- It is **not** associated with a patient account, because at enquiry time no
  patient account exists yet.
- The portal **cannot** record or display guardian-consent state. `patient-privacy.html`
  states this in plain language rather than implying otherwise.
- **No UI anywhere claims consent was recorded against a patient record.**

**Minimum backend change required** to close this properly (specified, not built):
add `guardian_consent_recorded` (boolean), `guardian_name`, `guardian_relationship`
and `guardian_consent_at` to `shared/schemas/patient-identity.schema.json` or
`patient-profile.schema.json`; surface them read-only on the doctor dashboard; and
gate minor-patient features on the boolean. Per `docs/00-PROJECT-GOVERNANCE.md` and
the precedent of docs/43/48/57, that needs its own architecture-freeze pass and
explicit approval. **It was deliberately not invented here.**

## D. Remaining blockers

**Engineering blockers: none.** All gates pass.

Real, non-engineering blockers to public launch:

1. **No images exist.** 0 image files against 15 markup-referenced paths (logo,
   favicon, 3 OG images, 4 doctor photos, 6 clinic photos). Social shares resolve
   to 404s. Owner production task.
2. **Hosting is not yet GitLab-only.** See §F — this is a genuine conflict with
   the stated production architecture, not a missing fix.
3. **Live domain unverified.** `wisehomeopathy.com` was unreachable from the build
   environment (egress policy) and is not indexed; HTTPS, canonical redirect and
   live form submission remain untested against production.

Not blockers: the flaky `phase-2c-milestones` suite; the pre-existing unclosed
`<section>` in `online-consultation/index.html` (byte-identical at `HEAD` before
this branch); Decap CMS being non-functional.

## E. Legal / provider review items

Engineering is prepared for review; these are **not** engineering work.

1. Sign-off on `patient-privacy.html` and on `terms.html`'s coverage of the portal.
2. Exact clinical-record retention period. The policy states long-term retention
   and deliberately publishes **no number**; the only period in code is the
   14-day clearing of the delivery recipient email.
3. Guardian/minor consent obligations under India's DPDP Act, and whether the
   enquiry-form declaration is sufficient pending the schema change in §C.
4. External AI provider terms (OpenRouter, Anthropic): rights over input and
   output, permitted medical use, retention/training settings, a DPA.
5. Third-party processor agreements for the providers actually in use.
6. Written testimonial releases for the four published reviews.
7. Verification of **TCMC 12515** against the register, and the permissibility of
   advertising the stated credentials.
8. Jurisdiction: the site solicits UAE, UK, Canada, Ireland and Sri Lanka patients,
   which may bring GDPR/UK GDPR alongside the DPDP Act.
9. Telemedicine rules for cross-border video consultations.
10. Whether the Google Maps embed requires prior consent for any target visitor.
11. Marketing-communication consent handling (see §G).
12. Any future FDA claim — **none exists in the repository today**, and none may be
    added without verifying the exact product and its exact authorisation.

## F. Netlify dependency status

**An active Netlify production dependency remains. GitLab-only hosting is NOT
technically achievable with the current implementation.** This is reported, not
silently worked around, and nothing was deleted blindly.

### A — Active production dependency (must be migrated before Netlify is removed)

| Location | What depends on it |
|---|---|
| `contact.html:169` | `data-netlify="true"` on the **live consultation enquiry form** — which now also carries `privacy_consent`, `enquiry_for_minor`, `guardian_consent` and `marketing_consent`. **This is the critical one: the consent evidence itself is stored by Netlify Forms.** |
| `blog/index.html:374` | `blog-consultation` form (currently unreachable — blog unlinked and `noindex`) |
| `blog/index.html:412` | `newsletter` form (same) |
| `netlify.toml` | HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `/assets/*` 7-day cache |
| `_redirects` | apex → `www` canonical redirect, using Netlify's forced `301!` |
| `privacy.html:190` | **Accurately discloses Netlify as the forms processor.** Correct today; becomes wrong the moment forms move |

### B — Legacy / dead

| Location | Note |
|---|---|
| `admin/config.yml:4` | Comment about Decap CMS via Netlify. Decap is non-functional. Comment only — left in place rather than half-editing a dead subsystem |
| `blog/post-template/index.html:16` | Authoring instruction "Drag the whole site folder into Netlify". **Now excluded from the published artifact** (§A3), so it no longer reaches a public URL |

### C — Documentation / history (harmless, intentionally retained)

`.gitlab-ci.yml:3` (comment describing the publish root it mirrors),
`shared/schemas/appointment.md`, `apps-script/Appointment.gs` ×2,
`apps-script/README.md`, `validation/pa-6-public-nav/README.md`,
`adr/ADR-003` (a historical ADR — must not be rewritten), and the `.md`
documentation set (`docs/`, `CHANGELOG.md`, `WEBSITE-AUDIT.md`,
`PUBLISHING-GUIDE.md`, `README.md`). **None of these `.md` files is published by
`.gitlab-ci.yml`.**

### What was migrated in this pass

**Nothing, deliberately.** Removing the Netlify form handling now would leave the
site's only reachable enquiry form with no backend — breaking the website and
destroying the consent evidence the previous pass added. That is the opposite of
a closure.

### Why GitLab-only is not achievable yet

Two independent gaps, both previously verified against GitLab's own documentation
and recorded in `docs/60-PHASE-1-HOSTING-MIGRATION.md`:

1. **Forms.** GitLab Pages is static and has no forms service. The three forms
   need either a third-party endpoint or a new **public, unauthenticated write
   endpoint** on the existing Apps Script backend. The latter is the
   architecturally consistent option, and it is a **substantial** change: a new
   dispatch case, a new Sheet-backed entity and schema, validation, honeypot and
   rate limiting, and a new public write surface on the system that holds patient
   health data. `request_consultation` **does not exist** — verified absent from
   all 54 remote branches and from the router's 54 dispatch cases. Per repository
   governance it requires its own architecture-freeze pass and explicit approval.
   It was not invented here.
2. **Headers and canonical redirect.** GitLab Pages supports neither per-project
   response headers nor forced cross-host redirects, so `netlify.toml` and
   `_redirects` have no GitLab-native equivalent. Cloudflare in front supplies
   both. Full steps are in `docs/60` §4.

**Recommended order** (from `docs/60` §3): stand up GitLab + Cloudflare, verify,
migrate the forms, verify a real submission through each, **then** delete
`netlify.toml` and `_redirects` and update `privacy.html:190`. Rollback stays a
DNS change until that last step.

## G. Marketing communication — honest status

`contact.html` carries a separate, **not required**, not pre-checked
`marketing_consent` opt-in, worded as distinct from messages about the enquiry or
care. The opt-in **is** genuinely recorded as a form field.

**There is no automated opt-out or unsubscribe workflow, and none is claimed.**
`privacy.html` states that unsubscribing is done by contacting the clinic. Opt-out
is therefore **operational and manual** today. No claim of automation appears
anywhere in the repository.

## H. Performance checklist — evidence-based

Static site on a CDN-backed host with an Apps Script backend. Items that do not
apply to that architecture are marked so rather than claimed as done.

| Item | Status | Evidence |
|---|---|---|
| Compress images | **NOT APPLICABLE (today)** | **0 image files in the repository.** Compression spec exists in `docs/IMAGE-ASSET-PLAN.md` §0; there is nothing to compress until assets are produced |
| Lazy-load appropriate images | **PARTIAL** | 12 `loading="lazy"` attributes across 19 public `<img>` tags; absent on index, conditions and the legal pages, which have no content images |
| Code splitting | **NOT APPLICABLE** | Static HTML, no bundler, no `package.json` tracked (verified: 0) |
| Cache API responses | **NOT DONE** | No client-side response cache in `my-health-journey/dashboard.js` or `doctor-dashboard/dashboard.js` |
| CDN | **DONE (current host)** | Netlify edge CDN; `netlify.toml` sets `/assets/*` `max-age=604800`. Must be re-established on Cloudflare at cutover (`docs/60` §4.3) |
| Minify JS/CSS | **NOT DONE** | No build step. CSS is inlined per page unminified (`index.html` ~80KB) |
| Database indexes | **NOT APPLICABLE** | Google Sheets backing store, no RDBMS. Capacity reviewed in `docs/54-SHEETS-PRODUCTION-SCALE-REVIEW.md` |
| Reduce unnecessary re-renders | **NOT APPLICABLE** | No reactive framework; vanilla DOM |
| Debounce inputs | **NOT DONE** | No debounce in either dashboard (verified: 0 matches) |
| Paginate long lists | **PARTIAL** | Dashboard previews cap at 3 via `slice(0, 3)` (8 occurrences) with "view full" links; the full pages are unpaginated |
| Remove unused dependencies | **NOT APPLICABLE** | No tracked `package.json`; Playwright is local-only and git-ignored |
| Defer non-critical scripts | **NOT DONE** | 33 external `<script src>` tags, **0** carrying `defer` or `async` |
| Loading skeletons | **DONE (portal)** | `skeleton` markup present across 15 portal/dashboard files |
| Load balancing | **NOT APPLICABLE** | Static hosting plus Google-managed Apps Script |
| Compress API payloads | **UNVERIFIED** | Apps Script default gzip assumed, not measured |
| DB connection pooling | **NOT APPLICABLE** | `SpreadsheetApp`, no connections |
| Cache results | **NOT DONE** | `CacheService` appears in 5 backend files but is used for **rate limiting**, not result caching |
| Fix N+1 queries | **UNVERIFIED** | Not audited; `docs/54` is the relevant review |
| Server-side caching | **NOT DONE** | Same finding as "cache results" |
| Lighthouse audit | **PARTIAL — real but narrow** | PR #77 Netlify deploy: **Performance 99 · Accessibility 98 · Best Practices 92 · SEO 100**, PWA `-`. **Homepage only, measured with 0 images present.** Not a production baseline; must be re-run on all pages after images land and after the host cutover |

No infrastructure was added for any of the above. `docs/16-PERFORMANCE-STANDARDS.md`
targets Lighthouse 95+, which the one real measurement meets.

## I. Production readiness

### READY FOR FINAL LEGAL/OWNER SIGN-OFF

Every engineering gate passes, no forbidden claim or public placeholder remains,
and the owner's locked decisions are implemented and verified. It is **not**
called production-ready: legal sign-off on the portal privacy policy, the
retention period and the AI provider terms is outstanding; the production images
do not exist; and the intended GitLab-only hosting is not yet achievable (§F).

---

# Appendix A — Final Engineering Blocker Remediation

Closes the three engineering blockers §D listed. Version 1.0 above is the
original closure record and is not rewritten.

## A1. REQUIRED DEPLOYMENT STEP — read before deploying

Two operational steps must be performed once, in this order, or the affected
features will fail closed rather than misbehave:

1. **Run `migratePatientProfileGuardianColumns()`** once from the Apps Script
   editor. `patient-profile.schema.json` is now **1.1.0** with four additive
   guardian-consent columns, and `FoundationDataStore.gs` deliberately refuses
   to read or write a sheet whose live header has drifted from the expected
   columns. Until the live `PatientProfile` sheet is migrated, the profile
   routes will throw instead of writing into the wrong cells. The function is
   idempotent, additive-only, refuses to migrate an unrecognised header, and
   moves existing `updated_at`/`updated_by` values across with their columns so
   no historical value is lost. A sheet that does not exist yet needs nothing —
   it will be created with the 1.1.0 header.
2. **Nothing is needed for `ConsultationEnquiries`.** That sheet is created
   automatically with its full header on the first enquiry.

## A2. Blocker 1 — guardian consent persistence: IMPLEMENTED

Extended the existing patient-scoped, patient-writable `PatientProfile` entity
rather than inventing a new one. That reuses the authenticated
`save_patient_profile` route, whose `patient_id` is session-derived and never
accepted from the request body (ADR-002), so no new authentication system was
introduced and one patient cannot touch another's consent.

Fields added (schema 1.1.0): `is_minor` (`''`/`yes`/`no`), `guardian_name`,
`guardian_relationship`, `guardian_consent_at`. The actor is already covered by
the entity's existing `updated_by` audit column.

`guardian_consent_at` is **server-set only** — never read from the request —
stamped the first time consent is affirmed and preserved verbatim afterwards, so
it records when consent was given rather than when the row was last touched.
It is the single source of truth the UI may rely on. Declaring the patient an
adult clears the whole guardian block, which is what keeps adult profiles
untouched. A separate `guardian_consent_recorded` audit event is written.

The UI renders consent state **only** from the persisted `guardian_consent_at`
returned by the server, carried on a `data-recorded-at` attribute. A validation
rejection, a server error and a dropped connection all leave it reading
"Guardian consent not yet recorded" — proven by test, not by inspection.

**Enquiry-time declaration and portal-recorded consent are deliberately kept
distinct.** `consultation-enquiry.schema.json`'s `guardian_declared` is a
declaration by someone with no account; only `patient-profile`'s
`guardian_consent_at` is consent recorded against a patient record. Neither
schema describes itself as the other.

## A3. Blocker 2 — Netlify form dependency: REMOVED

New `apps-script/FoundationEnquiry.gs` and a single new dispatch case,
`request_consultation` — public and unauthenticated, the same category as the
pre-existing `request_login_link`. It is not a general-purpose write API: one
action, a fixed field allow-list, one fixed sheet, a fixed column list. It
accepts no sheet name, range, column list, entity name or function name, never
reads or writes a patient record, and returns only a receipt id.

Implemented protections: allow-list validation with per-field maximum lengths;
a honeypot that returns the ordinary success shape while writing nothing;
per-email rate limiting (5 per 15 minutes) in its own cache namespace;
**spreadsheet formula-injection neutralisation** on every free-text value;
server-set `enquiry_id`/`submitted_at`; generic outward messages; no secret
involved anywhere.

**Not implemented and not claimed:** no CAPTCHA of any kind (none is configured
and no key exists). Apps Script Web Apps cannot set response headers, so CORS
cannot be restricted to a specific origin at this layer — the same platform
limitation `request_login_link` already lives with, and the reason the endpoint
is write-only and returns no personal data.

Frontend: `contact.html` posts to the endpoint with local validation, a loading
state, a disabled button, an in-flight guard against duplicate submission, and
verbatim server error messages. It reaches `booking-received.html` **only** when
the response is `status: 'ok'` **and** carries a non-empty `enquiry_id`, which
exists only after the row was stored.

`privacy.html` was corrected: it previously named Netlify as the forms
processor, which is no longer true. It now describes the actual flow and
discloses the consent fields that are stored.

Blog: the two duplicate Netlify forms on the unlinked, `noindex` blog hub were
removed rather than re-pointed — maintaining two submission paths for one
purpose would be a second place for consent wording to drift. Newsletter
sign-up has no backend, so it was replaced with an honest note rather than a
control that silently fails.

### Is GitLab-only hosting now achievable?

**For forms, yes — the functional Netlify dependency is gone.** Zero HTML pages
declare `data-netlify`, `netlify-honeypot` or a Netlify `form-name` field,
asserted by test.

**One documented capability gap remains, and Cloudflare was NOT added.**
`netlify.toml` (HSTS and security headers, `/assets/*` caching) and `_redirects`
(apex → `www`) have no GitLab Pages equivalent: GitLab Pages supports neither
per-project response headers nor forced cross-host redirects. Both files are
retained deliberately — `.gitlab-ci.yml` does not publish them, so they are
inert on GitLab Pages, and they remain the rollback path until DNS cutover is
confirmed. Deleting them now would remove that safety net while the live host
is unverified. Supplying headers and the canonical redirect is an
infrastructure decision for the owner (`docs/60` §4 documents one option); it
is not a Netlify form dependency and not something to add unilaterally.

## A4. Blocker 3 — images: PARTIALLY RESOLVED

Fixed, because these break with no fallback:
- **`og:image` removed** from `index.html`, `team.html` and
  `online-consultation/index.html`. A tag pointing at a missing file makes every
  share render as a broken image card; no tag lets the platform use its own
  no-image layout. Each removal is a documented, reversible comment naming the
  path to restore. **No social image was fabricated.**
- **One 404ing structured-data `image`** removed from the Physician node in
  `online-consultation/index.html`. `image` is optional on schema.org Person,
  so the graph stays valid — verified, all JSON-LD still parses.

**Not fixed, and not fixable by engineering: 11 owner-supplied assets** — the
clinic logo and ten photographs (4 doctors, 6 clinic). Fabricating a logo or a
photograph of a named physician is not an engineering fix. All eleven already
degrade gracefully in the existing markup (monogram wordmark, initials avatars,
"Add photo" tiles), so every page renders correctly without them. They are
pinned by exact path in `validation/closure-blockers/browser-test.js`, so the
suite still fails if any **new** missing image appears, and the list reaching
zero is the signal that this blocker is closed.

**Favicon:** `assets/favicon.ico` genuinely does not exist, and no valid icon
exists anywhere in the repository to reuse. The `<link rel="icon">` tags were
deliberately **left in place**: browsers request `/favicon.ico` by default even
with no tag, so removing them would not prevent the 404 — it would only add
churn. No arbitrary favicon was generated. Owner-supplied.

## A5. Performance re-check

No infrastructure was added. Against §H's classification, this pass changed
two rows and no other:
- **Already present → still present:** loading skeletons, CDN (current host),
  dashboard preview caps.
- **Newly present:** the enquiry form's in-flight guard is a real duplicate-
  request control, and its loading state is a real skeleton-equivalent.
- Everything else is unchanged, including every **Not applicable to current
  architecture** row. Lighthouse was not re-run: the live domain remains
  unreachable from this environment, so no new measurement exists and none is
  claimed.

## A6. What still requires legal/provider review

Unchanged from §E — twelve items. This pass adds no legal claim. Two now have
concrete engineering behind them to review rather than a gap: guardian consent
is genuinely persisted, and enquiry consent evidence now lives in the clinic's
own Google-backed system rather than a third-party form service. Whether either
satisfies the DPDP Act, and whether the retention position is adequate, remain
legal questions.
