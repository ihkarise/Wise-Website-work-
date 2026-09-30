# Legal, Privacy, Consent, Licensing & Compliance Audit
## Version 2.0 — 2026-09-30 · Repository evidence only

> **Not legal advice.** This is a repository-evidence audit by a software agent, not
> a lawyer. Every item marked 🔵 LEGAL REVIEW needs an India/Kerala-qualified
> professional. No retention period, fee, refund rule, age limit, medical claim or
> regulatory approval has been invented anywhere in this document.

---

## 1. Executive summary

The repository is in **unusually good shape** on the things code can prove, and has
**one dominant gap** that code also proves.

**Verified strong:** no cookies are set anywhere (`document.cookie` appears zero
times); no analytics, tag manager, ad pixel or marketing script exists; no secrets
are hardcoded (all secrets read from Apps Script Script Properties); no payment
gateway exists; AI models are pinned and AI calls are server-side only; medical
claims are clean — every "cure"/"guarantee" hit is either the compound word
"root-**cause**" or `disclaimer.html` stating the opposite; there are no vendored
third-party JS libraries and no npm dependencies to license.

**The dominant gap:** `privacy.html` and `terms.html` **explicitly state they do not
cover the authenticated patient portal** — and the repository implements that portal
in full. 31 entity schemas hold symptom logs, uploaded medical reports, medication
history, AI-generated health narratives, care plans, doctor instructions and date of
birth. Health data is sent to a third-party AI provider (OpenRouter) and an
underlying model provider, neither of which is named in any policy. **This is the
blocker for opening to real users.**

**Premise correction (Gate 0).** The task states the latest migration introduced
`foundation_action: request_consultation`. **It does not exist.** Zero occurrences
across all 54 remote branches; it is not among the router's 54 dispatch cases. The
consultation flow actually implemented today is **Netlify Forms →
`booking-received.html`** — a static form post to Netlify, with no Apps Script
involvement. The audit below reflects what exists.

---

## 2. Current privacy posture

| | |
|---|---|
| `privacy.html` | Exists, 21KB, 15 sections, anchored IDs. **Unusually honest** — self-declares its own gaps rather than overclaiming. |
| Accuracy for the **public website** | **Accurate.** Its cookie claims were independently verified true (§4). |
| Accuracy for the **patient portal** | **Does not cover it, and says so.** |
| `terms.html` | Exists, 18KB. Governing law = India, Kottayam/Kerala courts. Same self-declared portal gap. |
| `disclaimer.html` | Exists, 18KB. Strong, correctly-worded medical disclaimer. |

Verbatim from `privacy.html` §"Future update required":

> "This policy currently covers only the public website you're reading now. Patient
> Login now exists, but this policy does not yet describe it, nor does it describe
> authenticated health records, the Personal Care Plan, Symptom Tracker, or Digital
> Twin. […] We are not describing that coverage here as if it already exists."

`terms.html` carries the equivalent notice. Both are creditable disclosures, and both
confirm the gap is known, not hidden. They do not cure it.

---

## 3. Data inventory

### 3.1 Public website — implemented and live-reachable

| Data | Purpose | Where stored | Who processes | Retention | Required |
|---|---|---|---|---|---|
| Name | Respond to enquiry | Netlify Forms | Netlify (US) | **Undefined** 🟡 | Yes |
| Email | Respond to enquiry | Netlify Forms | Netlify | **Undefined** 🟡 | Yes |
| Phone / WhatsApp | Respond to enquiry | Netlify Forms | Netlify | **Undefined** 🟡 | Optional |
| Country | Routing/timezone | Netlify Forms | Netlify | **Undefined** 🟡 | Optional |
| Consultation type | Triage | Netlify Forms | Netlify | **Undefined** 🟡 | Optional |
| **"Main concern" (condition)** | Triage | Netlify Forms | Netlify | **Undefined** 🟡 | Optional |
| **Free-text message** — prompts for "current medication" | Triage | Netlify Forms | Netlify | **Undefined** 🟡 | Optional |
| Newsletter email | Newsletter | Netlify Forms | Netlify | **Undefined** 🟡 | Yes (that form) |
| IP / user agent | Inherent to serving | Host logs | Host | Host-defined 🔵 | Inherent |

The last two data rows are **health information about an identified person**. That is
a special category under GDPR Art. 9 and sensitive personal data under India's DPDP
Act. `privacy.html` §"How long we keep it" states plainly: *"We don't yet have a
formally defined retention schedule for form submissions — we're a small clinic team
and this is an honest gap, not a hidden one."* → 🟡 **OWNER DECISION**, not invented here.

### 3.2 Patient portal / PMS — implemented, merged, and **undocumented in any policy**

31 schemas in `shared/schemas/`. Health-relevant ones:

| Entity | Health data it holds |
|---|---|
| `symptom-log` | severity, sleep, energy, stress, free-text notes |
| `report` | uploaded medical reports — `drive_file_id`, filename, mime, size → **Google Drive** |
| `medication-history` | medicine name, strength, dosage form, manufacturer |
| `holoscan-recognition` / `-item` | **images of the patient's medicines**, extracted batch/expiry |
| `digital-twin-narrative` | AI-generated health narrative + `context_snapshot` + `ai_output` |
| `ai-assistant-interaction` | `context_snapshot`, `ai_output`, doctor decision |
| `milestone-review` | progress, improvements, medicines review, investigations |
| `care-plan` / `doctor-instruction` | goals, prescribed instructions |
| `consultation-history` | consultation summaries |
| `patient-profile` | phone, **date of birth**, preferred contact, **emergency contact** |
| `patient-identity` | full name, email, condition slug |
| `session` / `login-token` / `trusted-device` | auth tokens, device token hashes |
| `notification` | recipient email |

Storage: **Google Sheets** (per ADR-006, Sheets is an implementation detail).
Report files: **Google Drive**. Processors: Google, plus OpenRouter and the model
provider for AI features.

**None of this appears in `privacy.html`.** 🔴

`emergency_contact` is personal data about a **third party** who never visited the
site and cannot consent through it. 🔵 LEGAL REVIEW.

---

## 4. Cookie inventory

**Verified by code search, not assumption.**

| Mechanism | Result |
|---|---|
| `document.cookie` | **0 occurrences repository-wide** |
| Google Analytics / GTM / `gtag` | **none** |
| Meta Pixel / advertising / marketing scripts | **none** |
| `indexedDB` | **none** |

Browser storage actually used:

| Key | API | Classification | Purpose |
|---|---|---|---|
| `wise_session_token` | `sessionStorage` | **A. Strictly necessary** | Patient session; cleared on tab close |
| (distinct doctor key) | `sessionStorage` | **A. Strictly necessary** | Doctor session, deliberately separate |
| `wise_trusted_device_token` | `localStorage` | **B. Functional** | Trusted-device persistent login (ADR-011/014) |

Third-party content that reaches external servers:

| Embed | Host | Where | Sets third-party cookies? |
|---|---|---|---|
| Google Fonts | `fonts.googleapis.com`, `fonts.gstatic.com` | every page | No cookies, but **discloses visitor IP to Google** |
| Google Maps embed | `www.google.com/maps` | `contact.html` only (1 iframe) | **Yes — Google cookies/tracking** |
| Decap CMS | `unpkg.com` | `admin/index.html` **only** | Admin surface only, not public |

**Conclusion on consent:** the site sets **no first-party cookies at all**, so
`privacy.html`'s claim — *"you won't see a cookie-consent banner here — we don't set
the kind of cookies that would require one"* — is **supported by the evidence for
first-party cookies**. The open question is the **Google Maps iframe**, which does set
Google cookies before any consent. `privacy.html` already discloses both Google
embeds and points to Google's own policy.

**I did not add a cookie banner, and did not create `cookie-policy.html`.** The
existing `privacy.html` §"Cookies & third-party content" is an accurate cookie
disclosure, and adding a banner would not be evidence-based. Whether the Maps
iframe requires prior consent for any given visitor is jurisdiction-dependent →
🔵 **LEGAL REVIEW**. A cheap technical mitigation exists if wanted: click-to-load the
map. 🟡 OWNER DECISION.

**Jurisdiction is genuinely in play, not hypothetical:** the consultation form has a
`Country` field placeholder "e.g. UAE", a `+971 …` phone placeholder, and
`online-consultation/index.html` advertises patients from "the UAE, UK, Canada,
Ireland and Sri Lanka". Soliciting EU/UK residents may bring GDPR/UK GDPR into
scope. 🔵 **LEGAL REVIEW.**

---

## 5. Consent audit

| Form | File | Health data? | Consent before this audit | Privacy link before |
|---|---|---|---|---|
| Consultation request | `contact.html` | **Yes** | ❌ none — passive notice only | ❌ none |
| Blog booking | `blog/index.html` | Yes | ❌ none | ❌ none |
| Newsletter | `blog/index.html` | No | ❌ none | ❌ none |
| Patient login | `login.html` | No (email only) | n/a — auth | — |
| Staff visit-summary | `internal/consultation-summary.html` | Yes | ✅ **hard-gated checkbox, server-enforced** | — |

The pre-audit consultation form's only notice was:

> "Private & confidential. We never share your details. By sending, you agree to be
> contacted about your consultation."

Three problems: it obtained no affirmative act, it covered only *being contacted*
rather than *processing health information*, and it did not link the policy.

**The clinic already had the right pattern**, server-enforced, in the staff form
(`Validation.gs` per docs/25 §9.2) — it simply was not applied to the patient-facing
form. **Fixed** (§17).

Note the claim **"We never share your details"** while submissions are processed by
Netlify. Defensible if read as "we don't sell or share for others' purposes", since a
processor is not a recipient — but it is loose wording on a health form.
🟡 OWNER DECISION (copy), 🔵 LEGAL REVIEW (accuracy).

The two blog forms are currently **unreachable** — the blog was unlinked and
`noindex`ed in the prior Phase 1 batch — so only `contact.html` needed the gate
before launch. They must be gated before the blog is restored. 🟠

---

## 6. Data deletion mechanism

Exists, manual, honestly described. `privacy.html` §"Your choices": *"You can ask us
to delete your enquiry or newsletter details… We don't yet have a self-service portal
for this — you're reaching an actual person on our team."*

- No automatic deletion is promised, and the backend does not implement one — the
  policy correctly does not claim otherwise. ✅
- **Partial automation does exist and is undocumented:** Phase 1.5's `Retention.gs`
  purges `recipient_email` on a **14-day** schedule (verified: 45/45 regression
  includes "retention purges the row 20 days after send"). This is the **only**
  defined retention period in the codebase, it applies to one column of one entity,
  and `privacy.html` does not mention it. 🟠
- Discoverability was the real gap: nothing linked to the rights section. **Fixed** (§17).
- Whether clinical records are subject to different statutory retention (and
  therefore cannot simply be deleted on request) is 🔵 **LEGAL REVIEW**. No retention
  exception has been invented here.

## 7. Data access / correction mechanism

Also present in §"Your choices": *"You can ask us what information we hold about you.
You can ask us to correct information that's wrong."* Routed to a human via the
contact details. Compatible with the existing architecture; **no new backend was
built**, per the instruction. Authenticated patients can already view and edit their
own profile (`save_patient_profile`, `get_patient_profile`), which partially serves
access/correction for portal data. Discoverability **fixed** (§17).

---

## 8. Third-party service inventory

Traced from actual code, not assumed from presence.

| Service | Purpose | Where used | Data sent | Account | License/Terms | Risk | Action |
|---|---|---|---|---|---|---|---|
| **Netlify** | Current host + **Forms** | `netlify.toml`, 3 forms | **Name, email, phone, country, condition, free-text health info** | Yes | Netlify ToS/DPA | **High — undisclosed health-data processor** | 🔴 Name in policy, or migrate forms |
| **GitLab Pages** | Target host | `.gitlab-ci.yml` | Static files; visitor IP in logs | Yes | GitLab ToS | Low | 🟡 Name as host once live |
| **Google Apps Script** | Backend runtime | `apps-script/` (71 files) | All portal data | Yes | Google ToS | Med | 🔴 Disclose |
| **Google Sheets** | Data store | all `*.gs` | All portal data incl. health | Yes | Google ToS | Med | 🔴 Disclose |
| **Google Drive** | Report file store | `report` schema | **Uploaded medical reports** | Yes | Google ToS | **High** | 🔴 Disclose |
| **Gmail / MailApp** | Email delivery | `Email.gs`, `DoctorEmail.gs` | Recipient email + summary | Yes | Google ToS | Med | 🔴 Disclose |
| **OpenRouter** | AI gateway | `Ai.gs`, `AIAssistantInteraction.gs`, `DigitalTwinNarrative.gs` | **Patient health context** | Yes (API key) | OpenRouter ToS/privacy | **High** | 🔴 Disclose + §9 settings |
| **Anthropic** (via OpenRouter) | Model provider | pinned `anthropic/claude-haiku-4.5` | Same payload, downstream | Via OpenRouter | Provider terms | **High** | 🔴 Disclose as sub-processor |
| **Google Fonts** | Typography | every page | Visitor IP | No | SIL OFL / Apache-2.0 | Low–Med | ✅ Disclosed; 🟡 self-host optional |
| **Google Maps** | Clinic location | `contact.html` (1 iframe) | Visitor IP + **Google cookies** | No | Google ToS | Med | ✅ Disclosed; 🟡 click-to-load optional |
| **WhatsApp (wa.me)** | Contact channel | 15 links | Nothing until clicked | No | Meta ToS | Low | ✅ Named in terms |
| **YouTube/Instagram/Facebook/LinkedIn** | Social profiles | 30 links | **Nothing — plain `<a>`, verified no embeds** | No | — | **None** | ⚪ |
| **Decap CMS** (unpkg CDN) | CMS (non-functional) | `admin/index.html` only | — | — | MIT | Low | 🟡 Remove or finish |

**Two separate AI processors**, neither named in any policy. Presence-vs-usage was
traced: social links are plain anchors (0 embeds); `127.0.0.1` appears only in
`validation/*/browser-test.js`; unpkg/Decap only in `admin/`.

---

## 9. AI / IP audit

| Question | Finding |
|---|---|
| Data sent to AI provider? | Yes — patient health context |
| Patient data included? | **Yes** |
| What context? | `DigitalTwinContextBuilder`, grounded in the patient's **own record only** (ADR-029) |
| Output stored? | Yes — `ai_output`, `published_output`, `context_snapshot` |
| Shown to patients? | Only **after doctor approval** (ADR-028) |
| Doctor approval required? | **Yes — verified.** 875/875 conformance includes "a rejected narrative is never returned to the patient" |
| Model/provider | `anthropic/claude-haiku-4.5` via `openrouter.ai/api/v1/chat/completions` |
| **Model pinned?** | **Yes** — explicit `MODEL`, `TEMPERATURE: 0`, `PROMPT_VERSION '1.0'` |
| AI calls server-side? | **Yes** — `UrlFetchApp` in Apps Script; no AI call from any frontend file |
| API key location | `PropertiesService.getScriptProperties().getProperty('OPENROUTER_API_KEY')` — **never in repo** |
| AI output labelled? | Yes — doctor UI shows "AI-generated draft — not yet visible to the patient" |
| Used as medical advice? | No — ADR-004 forbids diagnosis/treatment/prognosis; independent drift checks exist |
| Provider rights over input/output? | **Cannot be determined from the repository** 🔵 |
| Restrictions on medical use? | **Cannot be determined from the repository** 🔵 |
| Retention / training settings? | **Cannot be determined from the repository** 🟡 — an account-console setting |

The engineering safeguards are genuinely strong and remain intact. What the repository
**cannot** tell you is contractual: whether OpenRouter's and Anthropic's terms permit
this use, what they claim over inputs/outputs, and whether training/retention is
disabled on the account. **No claim is made here that the clinic owns AI output.**
🔵 LEGAL REVIEW + 🟡 OWNER (verify console settings, obtain a DPA).

---

## 10. Open-source license audit

| Item | Result |
|---|---|
| `package.json` / lockfile | **None tracked** — confirmed intentional in `.gitignore` |
| npm runtime dependencies | **None** |
| Vendored JS libraries | **None** — searched jQuery, Bootstrap, Lodash, Alpine, htmx, Swiper, GSAP, AOS |
| Icon libraries | **None** — all icons are inline SVG |
| CDN scripts | **One:** `unpkg.com/decap-cms@^3.0.0` in `admin/` only — **MIT** |
| Apps Script deps | None beyond Google built-ins |
| `LICENSE` / `NOTICE` | **Absent** |

Nothing in the dependency surface requires an attribution NOTICE file: MIT requires
the notice only in redistributed copies, and Decap is loaded from CDN, not
redistributed. **No license text was copied unnecessarily.**

The repository itself has **no license file**. For a proprietary clinic site that is
normal, but it means the codebase is "all rights reserved" by default with nothing
stated. 🟡 OWNER DECISION — add a short proprietary notice, or leave deliberately.
`terms.html` already asserts IP over content and branding.

## 11. Asset license audit

| Category | Count | Status |
|---|---|---|
| Images (jpg/png/webp/avif) | **0** | ⚪ none in repo |
| SVG files | **0** | ⚪ |
| Logos | **0** | Referenced but absent |
| Favicon | **0** | Referenced but absent |
| Videos | **0** | ⚪ |
| Inline SVG icons | many | Hand-authored in markup; **OWNED** (no library signature) |
| Fonts | 0 local | All from Google Fonts CDN |

**The repository contains zero binary image assets**, so there is currently **no asset
licensing exposure at all** — and nothing was deleted or replaced, per instruction.

This is a licensing question **deferred, not solved**: when the 15 launch images are
added, each needs provenance recorded (owned / licensed / open / AI-generated), and
photographs of identifiable doctors and patients need documented consent. 🟡 OWNER.

## 12. Font / icon audit

| Font | Source | License | Third-party request? |
|---|---|---|---|
| Poppins | Google Fonts CDN | **SIL Open Font License 1.1** | **Yes — visitor IP to Google** |
| Fraunces | Google Fonts CDN | **SIL Open Font License 1.1** | **Yes** |

Both are freely usable for commercial web use; OFL requires no page attribution. The
only issue is the IP disclosure to Google on every page load, which `privacy.html`
already discloses and offers a workaround for. **Fonts were not changed.**
Self-hosting is available as a 🟡 OWNER DECISION — it would remove the third-party
request entirely and also serve `docs/16-PERFORMANCE-STANDARDS.md`'s "self-host fonts
where practical".

Icons are inline SVG — no library, no license obligation.

## 13. Medical claims audit

Scanned **visible text only** (CSS and attributes stripped) across all public pages
for: cure, cures, guaranteed, guarantee, 100%, permanent, no side effects, clinically
proven, scientifically proven, number one, reverses, prevents, safe for all, works for
everyone, miracle, completely safe, best.

**Result: no high-risk medical claim found.** 🟢

- Every "cure" hit is the compound **"root-cause"**.
- Every "guarantee"/"cures" hit is in `disclaimer.html` asserting the **opposite**:
  *"We do not promise cures, and nothing on this website should be read as a guarantee
  of any particular result."*
- All 61 raw "100%" hits were **CSS** (`width:100%`); zero in visible text.

`disclaimer.html` covers: educational-not-diagnosis, complementary care, no guaranteed
outcomes, not for emergencies, testimonials are individual experiences, doctor
credentials. This is a well-constructed disclaimer and **no claim was rewritten**.

One structural note: `online-consultation/index.html` has an **unclosed `<section>`**
(and therefore `<body>`). Verified **byte-identical at `HEAD` before any of my
changes** — pre-existing, browsers auto-close it, not a legal issue. 🟡

## 14. Marketing claim audit

None deleted; none supported by invented evidence.

| Claim | Where | Classification |
|---|---|---|
| "8+ years experience" | index, team, online-consultation | 🟡 OWNER CONFIRMATION |
| "5000+ patients treated globally" | index, team, online-consultation | 🟡 OWNER CONFIRMATION |
| **"40+ countries served"** | index, team | 🟡 **contradicts "6 countries"** |
| **"6 countries"** | online-consultation | 🟡 **contradicts "40+ countries"** |
| "Patients in Russia / Ireland / Sri Lanka", "UAE, UK, Canada, Ireland, Sri Lanka" | index, online-consultation | 🟡 OWNER CONFIRMATION |
| "24 hrs response time" / "Responds within 24 hours" | index, team | 🟡 OWNER — a service promise |
| **"Free consultation · No obligation"** | index, team | 🟡 **contradicts the "Consultation fee" block** |
| "TCMC 12515 registered practitioner" | online-consultation | 🔵 EXTERNAL EVIDENCE — verify against the register |
| "Faculty, NAHI — trains other doctors" | online-consultation | 🟡 OWNER CONFIRMATION |
| "BHMS, MD (Hom)", "MA Psychology" | index, team, online-consultation | 🟡 OWNER CONFIRMATION |
| 5 × ★★★★★ testimonials, named patients + city + condition | index | 🔵 **see below** |

**Two internal contradictions found — these are factual, not stylistic:**
1. **"40+ countries served" vs "6 countries"** on the same site.
2. **"Free consultation · No obligation" vs a "Consultation fee … per consultation"
   block** on `online-consultation/index.html` (currently rendering `[ADD FEE]`).

**Testimonials** publish a named individual's city *and* medical condition (e.g.
"Rachel P. — London, UK · CSU + Hashimoto's"). That is publication of third-party
health data. `disclaimer.html` states they are *"shared with the patients'
permission"*; whether **written, documented, still-valid** consent exists for each
cannot be determined from the repository. 🔵 LEGAL REVIEW + 🟡 OWNER — obtain/retain
written releases before launch.

## 15. Financial / refund audit

| Check | Finding |
|---|---|
| Payment gateway (Razorpay/Stripe/PayPal/PayU/Instamojo/CCAvenue/Paytm/UPI) | **None** |
| Payment links, cart, "buy now", checkout | **None** |
| Subscriptions, packages, deposits | **None** |
| Invoices | **None** |
| Medicine sales online | **None** |
| Prices displayed | One block, currently the literal placeholder **`[ADD FEE]`** |

**No refund or cancellation policy was invented**, because the site takes no payments —
🟡/⚪. Two live items: the `[ADD FEE]` placeholder must be replaced or removed before
launch (🟠), and the "Free consultation" claim must be reconciled with the fee block
(🟡). If online payment is ever added, refund/cancellation terms and payment-regulation
compliance become 🔵 LEGAL REVIEW.

## 16. Security findings

**Strong. No secret is exposed.**

| Check | Result |
|---|---|
| Hardcoded API keys/passwords/tokens | **None.** Every regex hit is a clearly-labelled test fake (`'foundation-test-secret-not-a-real-key'`, `'fake-session-token-for-…-tests'`) or a property **name** |
| Secrets mechanism | `PropertiesService` Script Properties: `OPENROUTER_API_KEY`, `STAFF_ACCESS_CODE`, `FOUNDATION_SESSION_SIGNING_SECRET` |
| Hardcoded Spreadsheet/Drive IDs | **None** — all long-string hits were doc cross-references |
| AI calls server-side | **Yes** — `UrlFetchApp` only; no frontend AI call |
| Patient data to frontend | Session-guarded router actions; conformance proves cross-role denial (e.g. `get_health_story` rejects a DoctorSession; `generate_digital_twin_narrative` rejects a PatientSession) |
| `.gitignore` hygiene | `apps-script/.clasp.json` (real scriptId) and `node_modules/` both ignored ✅ |
| Session storage choice | Session token in `sessionStorage` (not `localStorage`), deliberately per docs/29 §3 |
| Committed endpoint | Apps Script `/exec` URL is committed — **public by design**, not a secret |
| Static analysis | **PASS, 0 findings** across 71 `.gs` files |

Residual 🟡: `.gitlab-ci.yml` publishes `internal/` (staff form) and `admin/` to the
public site. Both are `noindex` and the staff form is access-code gated server-side,
so this matches today's Netlify behaviour rather than being a new exposure — but
neither needs to be publicly reachable. Consider excluding them at deploy.

---

## 17. Implemented fixes

Only clear, evidence-based fixes. No invented legal text, retention period, refund
rule, age limit or medical claim.

1. **Consent gate on the consultation form** — `contact.html`. A `required`,
   **not pre-checked** checkbox (`privacy_consent`), wired to the Netlify form so
   consent is recorded as a field. Wording is the neutral structure requested, naming
   health information explicitly and linking the policy:
   > "I have read and understood the **Privacy Policy** and consent to Wise Homeopathy
   > processing the information I submit here — including the health information in
   > this form — in order to respond to my consultation request."
   Styling mirrors the clinic's existing `.consent` component from
   `internal/consultation-summary.html`. **Single-purpose consent, not bundled.**
2. **Optional fields labelled** — `contact.html`: Country, Phone/WhatsApp, Main
   concern and message now read "(optional)". Required fields already carry `required`.
3. **"Your Privacy Rights" footer link** on all 9 public pages + `404.html`, pointing
   to the existing `privacy.html#choices` (access / correction / deletion). Makes the
   already-existing rights mechanism discoverable without inventing a new one.
4. **Legal navigation on `404.html`** — it had none.
5. **`robots.txt`** — disallows `/admin/`, `/internal/`, `/doctor-dashboard/`,
   `/doctor-login.html`, `/doctor-verify.html`.
6. **`admin/index.html`** — added `noindex, nofollow` (it was fully indexable).

### Regression I introduced in the prior batch, and fixed here

The previous batch's "hardening" added `noindex` to `verify.html` and
`Disallow: /verify.html` + `Disallow: /my-health-journey/` to `robots.txt`. That
**contradicted a deliberate, tested decision**: Batch PA-6 (docs/29) intentionally
*removed* noindex from `/login.html`, `/verify.html` and the `/my-health-journey/`
pages, and `validation/pa-6-public-nav/browser-test.js:129-143` asserts they carry no
robots meta. The browser suite caught it (1 failure). **Reverted** — the `noindex` is
gone from `verify.html` and the two contradicting `Disallow` lines are removed, with a
comment recording why. `pa-6-public-nav` now passes 22/22.

### Deliberately NOT done

- **No cookie banner** and **no `cookie-policy.html`** — the site sets zero
  first-party cookies, and `privacy.html` already carries an accurate cookie section.
  Adding either would not be evidence-based.
- **No rewrite of privacy/terms to cover the portal** — that is drafting legal text
  about data handling only the owner can confirm. 🔵
- **No marketing claim deleted or "supported"**; no testimonial removed.
- **No asset deleted or replaced.**
- **No change to the Appointment schema, PMS architecture, or any frozen phase.**

---

## 18. Validation results

| Suite | Result |
|---|---|
| Static analysis (71 `.gs` files) | **PASS — 0 findings** |
| Conformance | **PASS — 875/875, 0 failed** |
| Phase 1.5 regression | **PASS — 45/45** |
| Browser suites | **18 of 19 pass, 0 failed checks** |
| `phase-2c-milestones` | **FLAKY — pre-existing, not introduced** (evidence below) |
| Broken-link audit (32 pages) | Only unresolved reference is `assets/favicon.ico` (missing asset, not a broken link) |
| HTML tag balance | Clean on every changed file |
| `sitemap.xml` | Well-formed XML; all 10 `<loc>` targets resolve |

**Browser suites required an environment fix, not a code fix.** Playwright is
deliberately untracked (`.gitignore`), so the suites could not run at all. After
`npm install playwright`, all 19 failed with
`browserType.launch: Executable doesn't exist at …chromium_headless_shell-1243…` —
the pre-installed browser in this container is build **1194**. Symlinking 1194 into
the expected path made every suite runnable. This is a container detail; nothing in
the repository was changed for it.

**`phase-2c-milestones` flakiness — evidence, not a dismissal.** Two checks
("Save draft calls `save_milestone_review` exactly once", "updating the care-start
date calls `set_milestone_track`") fail non-deterministically. Neither touches
anything in this batch (`doctor-dashboard/` was never modified).

| Tree | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| Current (post-audit) | 0 failed | 1 failed | 1 failed |
| **Baseline `e8e794e`** (before *any* of my commits, clean worktree) | 0 failed | **2 failed** | **2 failed** |

Identical non-determinism on the untouched baseline → **pre-existing test-timing
flakiness in the milestones browser suite**, not a regression. 🟠 worth fixing on its
own merits; not a legal/compliance item.

---

## 19. Owner decisions required 🟡

1. Retention period for consultation-form submissions (currently undefined by the
   policy's own admission).
2. Retention period for portal health data, uploaded reports, and AI narratives.
3. Disclose the **14-day** `recipient_email` purge (`Retention.gs`) in the policy — it
   is the only retention rule that actually exists in code.
4. Confirm or correct **"8+ years"**, **"5000+ patients treated"**, **"40+ countries"**,
   **"6 countries"**, **"24 hrs response"**, credentials and NAHI faculty claim.
5. **Resolve "40+ countries" vs "6 countries"** — a direct contradiction.
6. **Resolve "Free consultation" vs the consultation-fee block**; replace or remove
   `[ADD FEE]`.
7. Obtain/retain **written testimonial releases** (named patient + city + condition).
8. Verify OpenRouter account settings: data retention and training opt-out.
9. Decide whether to self-host fonts (removes the Google IP disclosure).
10. Decide whether to click-to-load the Google Maps embed (removes pre-consent Google
    cookies).
11. Decide on `admin/` (Decap CMS is non-functional — finish or remove) and on
    publishing `internal/` to the public site.
12. Decide whether to add a repository license/proprietary notice.
13. Record provenance and consent for the 15 launch images when produced.
14. Name the form processor in `privacy.html` (Netlify today, or whatever replaces it).

## 20. Legal review required 🔵

1. **Draft privacy policy + terms covering the authenticated portal**: health records,
   symptom logs, uploaded reports, medication history, AI narratives, care plans,
   doctor access, Google as processor, OpenRouter + Anthropic as AI processors.
   **This is the blocker.**
2. Lawful basis for processing **health data** (special category / sensitive personal
   data) via a website form and the portal.
3. **Jurisdictional scope** — the site actively solicits UAE/UK/Canada/Ireland/Sri
   Lanka patients. Does GDPR/UK GDPR apply alongside India's DPDP Act?
4. **DPDP Act children's-data obligations** — `patient-profile` collects
   `date_of_birth`; the policy says the site "is not directed at children" and expects
   a parent/guardian to submit, but there is no age gate and no verifiable parental
   consent mechanism. Homeopathic practice routinely involves minors.
5. Whether the **Google Maps iframe** requires prior consent for any target visitor.
6. **`emergency_contact`** — third-party personal data collected from the patient.
7. OpenRouter/Anthropic terms: rights over input/output, permitted medical use, DPA
   availability.
8. Accuracy of **"We never share your details"** given third-party processing.
9. Statutory retention for clinical records vs. the right to erasure.
10. **TCMC 12515** registration verification and permissible advertising of
    qualifications for a registered practitioner in Kerala.
11. Whether any Indian medical-advertising restrictions apply to the testimonials and
    the online-consultation offering.
12. Telemedicine compliance for cross-border video consultations.

---

## 21. Launch matrix

| Area | Status | Evidence | Action |
|---|---|---|---|
| Privacy Policy | 🔴 BLOCKER | Exists & accurate for the public site; **self-declares it does not cover the portal**, which is fully implemented (31 schemas) | Draft portal coverage 🔵 |
| Terms | 🟠 MUST FIX | Governing law India/Kottayam ✅; same self-declared portal gap; no account-use or prohibited-use clauses | Add account terms 🔵 |
| Cookie Policy | 🟢 COMPLETE | `privacy.html` §Cookies is accurate; **0 `document.cookie`**, no analytics | None — no separate page needed |
| Cookie Consent | 🔵 LEGAL REVIEW | No first-party cookies; **Google Maps iframe** sets Google cookies pre-consent | Jurisdiction call; click-to-load optional |
| Personal Data Consent | 🟢 COMPLETE (public form) | Required, non-pre-checked `privacy_consent` + policy link added to `contact.html` | Gate the 2 blog forms before restoring the blog 🟠 |
| Data Deletion | 🟢 COMPLETE | `privacy.html#choices`, manual, honestly stated; now linked from every footer | Retention period 🟡 |
| Data Access | 🟢 COMPLETE | Same section; portal has `get_patient_profile` | — |
| Data Correction | 🟢 COMPLETE | Same section; `save_patient_profile` | — |
| Third-party Terms | 🔴 BLOCKER | 13 services traced; **Netlify, Google Drive/Sheets, OpenRouter, Anthropic all undisclosed** | Disclose 🔵 |
| AI/IP | 🟠 MUST FIX | Safeguards verified strong (model pinned, server-side, doctor gate, 875/875); **provider terms unknowable from repo** | Review terms 🔵, check settings 🟡 |
| Open-source licenses | 🟢 COMPLETE | No `package.json`, no vendored libs, no icon library; only MIT Decap via CDN | No NOTICE required |
| Asset licenses | ⚪ NOT APPLICABLE (today) | **0 image files in repo** | Record provenance when added 🟡 |
| Fonts/icons | 🟢 COMPLETE | Poppins + Fraunces — **SIL OFL 1.1**; icons inline SVG | Self-hosting optional 🟡 |
| Age restrictions | 🔵 LEGAL REVIEW | No age gate; `patient-profile` collects `date_of_birth`; policy expects guardian submission | DPDP children's provisions 🔵 |
| Medical disclaimer | 🟢 COMPLETE | **No high-risk claim found**; `disclaimer.html` explicitly disclaims cures/guarantees | None |
| Marketing claims | 🟡 OWNER DECISION | 11 claims catalogued; **2 internal contradictions**; testimonials publish named patients' conditions | Confirm/correct 🟡, releases 🔵 |
| Refund/cancellation | ⚪ NOT APPLICABLE | **No gateway, no payment link, no cart, no subscription** | None invented |
| Security | 🟢 COMPLETE | No hardcoded secrets; Script Properties; AI server-side; static analysis 0 findings | Optional deploy-exclude `internal/`, `admin/` 🟡 |
| Legal review | 🔵 | 12 items in §20 | Engage India/Kerala counsel |

### Finding counts

- 🔴 **BLOCKER — 2**: privacy policy does not cover the implemented portal; third-party
  processors (Netlify, Google Drive/Sheets, OpenRouter, Anthropic) undisclosed.
- 🟠 **MUST FIX BEFORE PRODUCTION — 5**: portal/account terms; disclose the 14-day
  retention rule; `[ADD FEE]` placeholder; gate the 2 blog forms before restoring the
  blog; AI provider terms confirmed before AI features are enabled for real patients.
- 🟡 **OWNER DECISION — 14** (§19)
- 🔵 **LEGAL REVIEW — 12** (§20)
- 🟢 **COMPLETE — 10** matrix areas · ⚪ **NOT APPLICABLE — 2**
- **Non-blocking:** pre-existing unclosed `<section>` in `online-consultation`;
  flaky `phase-2c-milestones` suite; Decap CMS non-functional.

---

## 22. Final decision

**LEGAL/PRIVACY STATUS: YELLOW**
Yellow, not red, because the public marketing website is close to defensible: cookie
claims are verified true, medical claims are clean, security is sound, there are no
payments, no licensing exposure, and consent now exists at the point of health-data
collection. Not green, because the policies do not describe the majority of personal
and health data the code actually processes.

**PRODUCTION READINESS: READY AFTER FIXES**

**BLOCKERS: 2**
**MUST-FIX ITEMS: 5**
**OWNER DECISIONS: 14**
**LEGAL REVIEW ITEMS: 12**
**NON-BLOCKING ITEMS: 3**

### Can this website legally/compliance-wise be launched based only on repository evidence?

**No — and passing code checks is not the reason it could.** All validation is green
(static analysis 0 findings, 875/875 conformance, 45/45 regression, 18/19 browser
suites with the 19th proven pre-existing flaky), and that is precisely the distinction
worth stating: **those results prove the software behaves as designed. They say nothing
about whether the design is lawful.**

**Technically verified from the repository:**
no cookies are set; no analytics or tracking exists; no secrets are committed; AI calls
are server-side with a pinned model and an enforced doctor-approval gate; cross-role
access is denied and proven by conformance; no payment processing exists; no
open-source license obligation is unmet; no high-risk medical claim is published; a
non-pre-checked consent gate with a policy link now precedes health-data submission;
access/correction/deletion routes exist and are reachable from every footer.

**Cannot be established from the repository, and must not be assumed:**
whether processing health data on these lawful bases is permitted; what retention
applies; whether the undisclosed processors have DPAs and acceptable terms; whether
OpenRouter/Anthropic permit medical use and what they claim over inputs and outputs;
whether written testimonial releases exist; whether TCMC 12515 and the advertised
credentials are current and advertisable; whether GDPR applies to the international
patients the site solicits; whether DPDP children's-data obligations are met given DOB
collection and no age gate; whether telemedicine rules permit the cross-border
consultations offered.

**A narrower launch is genuinely available**, and is the practical path: the **public
marketing website alone** — with the portal kept behind its existing login and AI
features left disabled by default per ADR-023/026/030 — has a far smaller gap than the
full ecosystem. It still needs the two 🔴 blockers closed, because `contact.html`
collects health data today and Netlify processes it today. Opening **My Health Journey,
the Digital Twin, Holoscan or the AI Assistant to real patients** should wait for
§20.1 and §20.7.

The single highest-value next action is not code: it is taking §3.2's data inventory
and §8's processor table to an India/Kerala-qualified professional and having the
portal privacy policy and terms drafted. The engineering is ready for that
conversation; the paperwork is what is missing.


---

# Appendix A — Owner-Decision Implementation Pass (v2.0)

The owner answered every Gate 0 question and locked 32 decisions. This appendix
records what was implemented, what was deliberately left alone, and what is still
open. **Version 1.0 above is kept as the original audit record and is not rewritten.**

## A1. Changed files

| File | Why |
|---|---|
| `index.html` | Country count; hero CTA + note; journey heading + step one; testimonial heading and intro; three testimonials replaced with four genuine Google reviews; closing CTA and proof bar; footer link |
| `team.html` | Country count ×2; closing CTA and proof bar; footer link |
| `contact.html` | Emergency notice; under-18 question; guardian consent; marketing opt-in; corrected form note; footer link |
| `online-consultation/index.html` | Country count made consistent; emergency notice; footer link |
| `my-health-journey/dashboard.js` | `REPORTS_UPLOAD_ENABLED = false` launch flag; upload form replaced with a notice; `wireReportForm()` early-return |
| `my-health-journey/index.html` | Optional-participation notice; emergency notice; link to the portal policy |
| `my-health-journey/health-story/index.html` | AI-assisted label; emergency notice; link to the portal policy |
| `patient-privacy.html` | **New** — Patient Portal Privacy Policy |
| `privacy.html`, `terms.html`, `disclaimer.html`, `gallery.html`, `conditions/index.html`, `404.html` | Footer link to the portal policy |
| `sitemap.xml` | `patient-privacy.html` added (11 URLs, all resolve) |
| `validation/pa-2-dashboard/browser-test.js` | Two upload assertions re-pointed at the disabled state |
| `validation/pa-5-reports/browser-test.js` | Upload-flow sections gated on the real flag; new disabled-state section 5b |

## A2. Reviews removed

All three, in full, not rewritten, not paraphrased, not preserved elsewhere:

1. **Sara A.** — "Dubai, UAE · MCAS"
2. **Maria K.** — "Toronto, Canada · Hashimoto's"
3. **Rachel P.** — "London, UK · CSU + Hashimoto's"

Reason: absent from the owner's Google review source, and each carried specific
clinical-outcome claims (antibody levels, antihistamine reduction, "improved
dramatically").

## A3. Doctor reviews excluded

Not published as patient testimonials: **Dr. Sandeep K. Jose**, **Dr. Dhanya
Prince**, **Dr. Vimal Sharma**, **Dr. Aswathi Savithri**.

## A4. New reviews — exact selected text

Four, verbatim, including original punctuation, spacing and emoji:

| Name | Exact text as published |
|---|---|
| Fathima Nazrin | `Excellent doctor and a trustworthy homeopathy clinic. It was a very good experience, and I started feeling relief very quickly.` |
| Shareena Habeeb | `Very good consultation and effective medicine..!🥹🤍` |
| Mahesh Madhavan | `Grateful for your exceptional care and dedication for patient well being 😊` |
| Joseph Alex | `Good treatment.good doctor very satisfied` |

Real displayed names; sub-line reads "Google review". **No invented initials,
locations, conditions or photographs.**

**Star ratings removed.** The supplied source carries no star rating, so the old
`★★★★★` / `aria-label="5 out of 5"` would have been an invented rating. No
`Review`, `AggregateRating` or `ratingValue` structured data was added.

### Not published, and why

| Reviewer | Reason |
|---|---|
| Midhun Krishna | Disease-specific (chickenpox) — excluded per the owner's decision |
| Deepak Narayanan | Disease-specific (varicose veins / leg ulcer) |
| Deepu Suresh | Disease-specific (daughter's wheezing) |
| Philemon Chacko | **No verbatim text available** — only a description. Publishing would require paraphrase |
| Ria Prince | **No verbatim text available** |
| Stephen M | **No verbatim text available** |
| Prejitha Sp | Verbatim text available, but "effective for all allergies..It has no side effects.." is a strong efficacy **and safety** claim. Held back for owner confirmation |
| Aathi Sai | Verbatim text available; a mild outcome claim ("My health is Much more improvement"). Held back for owner confirmation |

## A5. Medical upload

**Disabled for current launch scope; underlying tested implementation preserved
for future use.**

A single `REPORTS_UPLOAD_ENABLED = false` flag in `my-health-journey/dashboard.js`
carries the required comment. The patient-facing file input and submit button are
replaced by a notice telling patients to share reports with the clinic directly.
Untouched and still validated: the `upload_report` / `get_reports` /
`download_report` router cases, `FoundationReports.gs`, the Drive path, the
schema, the registry entry, `readFileAsBase64()`, `wireReportForm()` and the
client pre-check constants. **Verified zero diff under `apps-script/` and
`shared/`.** Reading and downloading stored reports still works. No AWS claim
made anywhere.

## A6. Consultation

**Free General Enquiry / Paid Consultation distinction implemented.** All seven
"free consultation" occurrences removed. The free step is now an enquiry that may
be handled by staff, an assistant doctor or a senior doctor; the full case review
is stated to happen in the paid doctor consultation. **The fee was not invented** —
`[ADD FEE]` remains for owner entry.

## A7. Country

**6+ countries wording implemented**, consistently, in all four places.
`Every continent` removed. The repository's existing verified six-country patient
list (UAE, Canada, United Kingdom, Russia, Ireland, Sri Lanka) was **preserved
as-is** — no country list was invented.

## A8. Outcome claims

**Unsupported recovery/guarantee wording removed.**
"From first consultation to lasting recovery" → "From your first enquiry to
ongoing care". "Real patients. Real recovery. Every continent." → "Real patient
experiences. Personalised care." "Treatment outcomes vary by individual" was
already present on the public pages and is retained.

## A9. AI

Health Story now leads with **"AI-assisted health information — reviewed and
approved by your doctor before being shown to you"**, states the draft is
AI-assisted from information already in the record, and that it is not a diagnosis
and does not replace the doctor's judgement. Added only to content that is
actually AI-generated. The AI-assists → doctor-reviews → doctor-decides safeguard
is untouched and still proven by conformance. External processing (OpenRouter →
Anthropic) is disclosed in the portal policy with an explicit opt-out route.
**No FDA claim exists anywhere in the repository.**

## A10. Privacy

Two layers now exist. `privacy.html` remains the public-website policy; the new
`patient-privacy.html` is the substantially more detailed portal policy, with
categories taken from the 31 shipped schemas, real purposes, only
actually-used providers, long-term retention stated without an invented number,
the real 14-day delivery-email purge disclosed, and access / correction /
deletion described as a reviewed human process. Reachable from every public
page's footer, `404.html`, the portal dashboard and the Health Story page.

## A11. Launch matrix

| Item | Status | Evidence | Action |
|---|---|---|---|
| Country claim | 🟢 GREEN | `6+ countries` ×4; zero `40+ countries` / `Every continent` in visible text | — |
| Consultation wording | 🟢 GREEN | 7 occurrences replaced; gate scan clean | Owner enters the fee |
| Free enquiry | 🟢 GREEN | "Free General Enquiry" + "consultation fee applies" | — |
| Patient portal | 🟢 GREEN | Optional-participation notice on the dashboard | — |
| Medical uploads | 🟢 GREEN | `REPORTS_UPLOAD_ENABLED = false`; backend zero-diff | Reactivation needs privacy/storage/security review |
| AI disclosure | 🟢 GREEN | AI-assisted label on Health Story | — |
| External AI processing | 🟡 YELLOW | OpenRouter + Anthropic disclosed, opt-out offered | Provider terms 🔵 |
| Doctor review | 🟢 GREEN | Conformance 875/875 incl. rejected-narrative isolation | — |
| Digital Twin | 🟢 GREEN | Optional + doctor-approved + not a doctor replacement | — |
| Holoscan | 🟡 YELLOW | Covered by the optional notice and the portal policy | Dedicated per-feature explanation if enabled |
| Minor consent | 🟡 YELLOW | Required under-18 question + guardian checkbox on the enquiry form; policy states guardian involvement | Portal cannot record guardian consent — backend work |
| Data access | 🟢 GREEN | Portal policy + My Profile self-edit | — |
| Data correction | 🟢 GREEN | Portal policy + My Profile self-edit | — |
| Data deletion | 🟢 GREEN | Request → authorised review → action, explicitly not automatic | Exact exceptions 🔵 |
| Privacy rights | 🟢 GREEN | "Your Privacy Rights" in every footer | — |
| Public Privacy Policy | 🟢 GREEN | `privacy.html` | — |
| Patient Privacy Policy | 🟢 GREEN | `patient-privacy.html`, linked from the portal | Legal sign-off 🔵 |
| Retention | 🟡 YELLOW | Long-term stated; no number invented; 14-day purge disclosed | Exact period 🔵 |
| Third parties | 🟢 GREEN | Only actually-used providers listed | Processor agreements 🔵 |
| Marketing consent | 🟢 GREEN | Separate, not-required opt-in, recorded via the form | Opt-out handling operationally 🟡 |
| Payments | ⚪ N/A | No gateway, no payment link anywhere | Nothing invented |
| Reviews | 🟢 GREEN | 3 removed, 4 genuine published verbatim, 4 doctors excluded, stars removed | 2 held for owner (A4) |
| Medical claims | 🟢 GREEN | Visible-text scan clean; disclaimer unchanged | — |
| Emergency disclaimer | 🟢 GREEN | online-consultation, contact, portal, Health Story (+ existing disclaimer/terms) | — |

## A12. Unresolved

**Owner:** the consultation fee (`[ADD FEE]`); whether to publish the Prejitha Sp
and Aathi Sai reviews; "8+ years", "5000+ patients", NTET 2025, TCMC 12515;
whether to add a per-feature explanation screen before first use of Digital Twin
and Holoscan; operational handling of marketing opt-outs.

**Backend:** enforcing the under-18 answer and recording guardian consent inside
the portal (stated as absent in the policy, not faked); recording an AI opt-out as
a per-patient setting rather than a clinic-side action.

**Legal (unchanged from §20):** all 12 items, most importantly sign-off on the new
portal policy, the exact clinical-record retention period, external AI provider
terms, minor/guardian consent under the DPDP Act, and jurisdiction given the
international patients advertised.

**Pre-existing, not introduced:** `online-consultation/index.html` has an unclosed
`<section>` (byte-identical at `HEAD` before this branch);
`validation/phase-2c-milestones` is flaky (0/2/2 on a clean `e8e794e` worktree).
