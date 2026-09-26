# 61 — PWL-1: Patient Feedback & Google Review
## Version 1.0 — 2026-09-26

> **Status: PLANNED — POST-LAUNCH. NOT IMPLEMENTED.**
>
> This document is a **feature reservation**. No UI, no backend, no schema, no
> registry entry, and no patient workflow exists or is changed by it. Nothing
> here is authorized for implementation.
>
> **This feature is NOT part of Phase 1 launch scope and must never block the
> launch.** Roadmap placement: `docs/24-ROADMAP.md` → Phase 1 — Public Website →
> Post-Launch Features → PWL-1.

| | |
|---|---|
| **Feature ID** | **PWL-1** (Public Website, Post-Launch — reservation 1) |
| **Name** | Patient Feedback & Google Review |
| **Status** | PLANNED — POST-LAUNCH · NOT IMPLEMENTED |
| **Launch blocking** | **No** |
| **Phase** | Reserved under Phase 1, for work *after* go-live |
| **Implementation authorized** | **No** — see §8 |

---

## 1. Purpose

An **admin-initiated** system for inviting selected patients to give feedback and,
if they wish, to leave a Google review.

The defining constraint: **requests are sent manually by an authorized
admin/staff user, one patient at a time.** There is no automatic, bulk, or
event-triggered sending. Not every patient receives a request.

## 2. Proposed patient flow

**Screen 1 — Experience**

> How was your experience with Wise Homeopathy?
> **👍 Good** · **👎 Needs improvement**

**Path A — 👍 Good**
1. **Rating:** "Please rate your experience" — 1 to 5 stars.
2. **Optional private feedback** — free text, never published.
3. **Neutral Google review invitation:**
   > Would you like to share your experience on Google?
   > `[ Leave a Google Review ]`

**Path B — 👎 Needs improvement**
1. "What could we improve?" — a simple private feedback form.
2. Submission is acknowledged and routed to staff privately.
3. The patient is **not** pushed into a public-review path based on sentiment.

### 2.1 The neutral-invitation rule (hard constraint)

The Google review invitation **must not be conditioned on the rating**. Every
patient who provides a rating sees the **same** invitation.

Explicitly **must not be built**:

```
5★ → show Google      4★ → show Google      3★ → hide
2★ → hide             1★ → hide
```

This is not a stylistic preference. Filtering review requests by predicted
sentiment — "review gating" — violates Google's prohibited-content policy for
reviews and risks the clinic's Business Profile. It is also straightforwardly
dishonest: it manufactures a rating average that misrepresents real patient
experience. The neutral design is the only acceptable one, and any future change
request to gate by rating must be refused with reference to this section.

Path B reaches the private form first because the patient *asked* to raise a
problem, not to suppress a review. Whether Path B should also end with the same
neutral invitation is an open question — see §8.

## 3. Proposed admin flow

1. Admin selects an eligible patient.
2. Admin clicks **Send Review Request**.
3. Admin sees, per patient:
   - whether a request was sent, and when
   - whether feedback was submitted, and when
   - the thumbs response
   - the star rating
   - the private feedback
   - reminder count
   - cooldown status

**Cooldown.** A configurable cooldown prevents the same patient being asked
repeatedly. No patient may receive a new request while `cooldown_until` is in the
future. The cooldown period is configuration, not a hard-coded constant.

## 4. Reserved data fields

Field names reserved for a future `PatientReviewRequest` entity. **No schema file,
Sheet, or registry entry is created by this document.**

| Field | Purpose |
|---|---|
| `patient_id` | Subject of the request |
| `review_request_id` | Unique request identifier |
| `triggered_by` | Admin/staff identity that initiated it — audit trail |
| `sent_at` | When the request was sent |
| `response_at` | When the patient responded |
| `thumbs_feedback` | `good` \| `needs_improvement` |
| `star_rating` | 1–5, only on the 👍 path |
| `private_feedback` | Free text — **never published** |
| `google_review_link_shown` | Whether the neutral invitation was displayed |
| `reminder_count` | Reminders sent for this request |
| `cooldown_until` | No new request before this timestamp |
| `status` | Request lifecycle state |

Proposed `status` values, to be fixed at freeze time:
`pending` · `sent` · `responded` · `expired` · `cancelled`.

## 5. Privacy considerations

- **Private feedback is strictly separate from the public Google review.** They
  are different destinations with different audiences. Private feedback is never
  published, surfaced publicly, or used as marketing copy.
- **Collect no unnecessary clinical detail.** This is a service-experience
  instrument, not a clinical one. No symptoms, diagnoses, medications or
  clinical history. If a patient volunteers clinical information in free text,
  it inherits the platform's existing patient-data handling — it does not create
  a new clinical record.
- **Retention.** `private_feedback` is patient-identifiable free text and needs a
  defined retention period. Phase 1.5's `Retention.gs` already establishes the
  pattern (scheduled purge of a single column, leaving the audit row intact) and
  should be reused rather than reinvented.
- **Audit.** `triggered_by` records which staff member initiated each request, so
  manual sending stays accountable.
- **`privacy.html` must be updated before launch of this feature** — it currently
  describes no feedback-collection processing.
- **No new public surface.** Nothing in this feature adds indexable content or
  exposes any patient response.

## 6. Architectural notes for a future freeze

Observations only, to save rediscovery later. None is a decision.

- **The review link must work without a portal login.** A patient receiving a
  request may have no account. ADR-002 (patient identity independent of
  authentication) permits this, and the platform already has a tokenised
  one-time-link pattern in `verify.html` / the magic-link flow to model on.
- **The admin surface should be a registry entry**, per ADR-012/ADR-020
  (registry-driven dashboards), and **disabled by default**, following the
  precedent of ADR-023, ADR-026 and ADR-030.
- **The "admin/staff" role is not yet a defined identity type.** The platform has
  Doctor Identity (ADR-017) and patient identity; a non-doctor staff role able to
  send requests is a genuine gap to resolve at freeze time, not an implementation
  detail. Note `/admin/` in this repository is the (non-functional) Decap CMS
  directory and is unrelated.
- **No AI is involved.** Ratings and free text are stored verbatim. No
  summarisation, sentiment scoring, or generated content — so no ADR-005
  supervision gate applies. Adding AI later would require its own freeze.

## 7. Out of scope for this reservation

Automatic or bulk sending · SMS/WhatsApp delivery · review-response management ·
public testimonial display · NPS scoring · dashboards or analytics over ratings ·
integration with the Google Business Profile API · any change to existing patient
workflows.

## 8. Open questions (resolve at architecture freeze, not now)

1. Does Path B (👎) also end with the same neutral Google invitation? Offering it
   is the most consistent reading of §2.1; withholding it is defensible as not
   pressing someone who just reported a problem. **Undecided.**
2. Default cooldown duration, and whether it varies by outcome.
3. Delivery channel — email via the existing `MailApp` path, or a link staff
   share directly.
4. Reminder policy: how many, at what interval, or none at all.
5. Which identity type may send requests (§6).
6. `private_feedback` retention period.

## 9. Definition of "reserved"

Per `docs/00-PROJECT-GOVERNANCE.md` and the precedent of every prior phase
(docs/43, docs/48, docs/57), before any implementation begins this feature
requires:

1. A dedicated architecture-freeze document.
2. Any ADRs its decisions require.
3. Explicit, separate approval to implement.

Until all three exist, PWL-1 is **documentation only**.
