# 39 - Consultation Timeline Readiness Review
## Version 1.0 — 2026-07-03

> Pre-implementation review for **Batch PA-3** (docs/29 §13 Batch 5D: the
> `ConsultationHistory` sheet, a staff entry tool, and the patient-facing read-only
> Timeline/Consultation History). Per this session's explicit instruction: **no code
> was written to produce this review**, and **no backend architecture is proposed or
> altered** — everything below is scoped strictly to the already-approved docs/29 §6
> (Timeline Architecture), §7 (Consultation History Architecture), §13 (Batch 5D), and
> docs/33 §3.1 (Timeline Event). This document does not authorize PA-3 to begin;
> implementation waits for separate approval, the same discipline docs/37 was held to
> before PA-2.

---

# 1. Consultation Information Architecture

Three levels, only the first of which exists today:

1. **Dashboard preview** (shipped in PA-2) — the Timeline card on `/my-health-journey/`,
   currently an Empty State ("Coming later in Phase 2A"). docs/29 §5 specifies this
   becomes "last 3 merged entries, 'View full timeline' link" once real data exists.
2. **Full Timeline page** (new, this batch) — the complete, capped (latest 50, docs/29
   §6), reverse-chronological list. Does not exist as a page yet.
3. **Consultation History detail view** (new, this batch) — the single-entry detail
   behind a Timeline entry of type "consultation" (docs/29 §7). Does not exist yet.

This is a strict drill-down: dashboard card → full list → single-entry detail. Nothing
in docs/29 suggests a fourth level, and PA-3 should not invent one — the "explicit
non-goals" discipline docs/29 §0 has held throughout applies here too.

# 2. Timeline Entry Model

**A real, concrete gap worth surfacing before implementation, not after.** docs/29 §4's
`ConsultationHistory` sheet columns are `record_id`, `patient_id`, `entry_date`, `title`,
`summary_text`, `source_ref`, `created_by`, `created_at` — **no `entry_type` column.**
docs/33 §3.1 models the general **Timeline Event** entity with the same shape *plus*
`entry_type` (`consultation`/`note`/`milestone` — "extensible"), specifically so future
Care Plan and Digital Twin events can plug into the same feed "without a redesign"
(docs/33 §3.1's own words).

For this batch alone, every row is implicitly type `consultation` — no functional
defect exists yet, since 5D's Timeline sources from `ConsultationHistory` only (docs/29
§6). But the moment a second source is added (Care Plan updates, Phase 2B; Digital Twin
milestones, Phase 2D), a schema migration would be needed to retrofit `entry_type` onto
every already-existing row. **Recommendation:** add `entry_type` to the
`ConsultationHistory` schema now, with every row this batch writes set to the constant
`"consultation"` — a one-column, zero-behavior-change addition today that avoids a
future migration and keeps the sheet's shape a true implementation of docs/33's Timeline
Event rather than a narrower one-off. This is a recommendation for PA-3's implementation
to consider, not a change made by this review.

Two sourcing paths land in the same row shape (docs/29 §7, unchanged): a staff-authored
short entry, or a reference to an already doctor-approved Phase 1.5 Consultation
Summary via `source_ref`. Both should still resolve to one `ConsultationHistory` row —
the patient-facing read path never needs to know which path produced it.

# 3. Consultation Ordering

Reverse-chronological by `entry_date` (docs/29 §6) — the clinically meaningful date
(when the visit happened), not `created_at` (when the row was written). These can
diverge: staff may enter a visit's history after the fact, or backfill older visits, so
row-write order is not a reliable proxy for visit order. **Recommendation:** sort by
`entry_date` descending, with `created_at` descending as an explicit tiebreaker for
same-`entry_date` rows, so ordering is deterministic rather than dependent on
sheet-read order (which Google Sheets does not guarantee is stable across reads).

The dashboard preview needs only the first 3 of this same sorted list; the full Timeline
page needs the full capped-50 list (docs/29 §6) — one query, two presentations, not two
different queries.

# 4. Empty-State Behavior

Two distinct empty conditions, easy to conflate but genuinely different:

- **The full Timeline page or dashboard card, with zero `ConsultationHistory` rows for
  this patient** — this is exactly the **"No data yet"** Empty State type PA-2 already
  built and verified but left without a live consumer (docs/38 §4). This batch gives it
  its first real one.
- **A record_id requested for the detail view that does not belong to the
  authenticated patient, or does not exist at all** — not an empty state in the UI
  sense; an authorization/not-found rejection (see §10). Must not be presented to the
  patient as "no data yet," since that would blur an authorization boundary with a
  content-absence message.

# 5. Card Layout

The dashboard's Timeline card (already shipped, currently an Empty State) needs no
structural change to its `.dash-card`/`.card` shell — only its inner content changes,
from the Empty State markup to either 3 compact entries or the "No data yet" Empty
State. Each compact entry: `entry_date` (formatted), `title`, and a short truncation of
`summary_text` — not the full text, which belongs to the detail view only (§6).

The full Timeline page's list layout should reuse `index.html`'s `.journey`/`.j-step`
vertical-timeline visual (dot + connecting line + entry body) — docs/29 §5 already
names this as the intended pattern for exactly this purpose, and it is the one visual
component in the existing design system built for a chronological list rather than a
generic card grid.

# 6. Detail-View Requirements

Per docs/29 §7: the detail view is **read-only** — no patient editing of clinical
history, "doctors decide" (docs/30 §2). It needs the full, untruncated `entry_date` and
`summary_text`, plus `title`. It does **not** need to separately fetch anything from
Phase 1.5's `Phase1.5_ConsultationSummaries` sheet even when `source_ref` is populated
— both sourcing paths already land in the same `ConsultationHistory` row shape (§2), so
the detail view only ever reads `ConsultationHistory`, keeping the patient-facing app's
data access confined to its own sheet and never reaching into Phase 1.5's (a stronger,
simpler isolation boundary than a cross-sheet join would give). A "back to Timeline"
link is the one required navigation affordance — docs/05's "no dead ends" applies to
this new leaf page as much as any public one.

# 7. Component Reuse Opportunities

- **Fully reusable, unchanged:** `assets/site.css` tokens, `.card`/`.status`/`.skeleton`,
  and PA-2's Empty State component (`emptyStateHtml`/badge classes) — the "No data yet"
  variant (§4) is exercised by real content for the first time here.
- **Reusable with adaptation:** `index.html`'s `.journey`/`.j-step` visual (§5).
- **Ripe for extraction, not before now:** docs/38 §7 named the dashboard's
  session-guard/header logic (`my-health-journey/dashboard.js`) as "worth revisiting
  only once a second authenticated page actually exists to reuse it." The full Timeline
  page and the detail view are exactly that second and third page. **Recommendation:**
  factor the session-guard (verify-via-`get_profile`-or-redirect) and the authenticated
  header into a small shared script once PA-3 adds these pages, rather than duplicating
  `dashboard.js`'s IIFE a second and third time. This is the natural point to make that
  change — not before, per the same "don't build for a hypothetical second consumer"
  discipline docs/29 itself applies elsewhere.

# 8. Relationship to Symptom Tracker

Independent for this batch, deliberately. docs/29 §6 scopes 5D's Timeline to
`ConsultationHistory` only; docs/33 §3.1 lists Symptom Log feeding Timeline Event only
as a **future extension**, not current scope. Symptom Tracker (5E) remains its own
separate dashboard card with its own Empty State until a later, explicitly-planned
batch merges the two feeds. PA-3 should not pull `SymptomLogs` into the Timeline query
— doing so would be scope creep into work docs/29 has not authorized here.

# 9. Relationship to Reports

Same relationship as §8: independent. Reports (5F) is not a Timeline source in docs/29
§6 either. The eventual cross-entity aggregator is Digital Twin (docs/33 §3.5, Phase
2D) — a computed view over Timeline Event, Symptom Log, and Report together — not
something Timeline itself should attempt to become early. PA-3's Timeline query should
read `ConsultationHistory` and nothing else.

# 10. Required Backend Contracts

Named here as requirements this review identifies — **not designed or implemented by
this document.** Per docs/29 §14 Decision 1's now-established pattern (a new,
distinctly-named entity file added to the existing `apps-script/` project, never
modifying frozen files):

- A new `shared/schemas/consultation-history.schema.json`, mirroring the existing
  `shared/schemas/*.schema.json` pattern — including `entry_type` if §2's
  recommendation is accepted.
- A new Foundation entity file (e.g. `FoundationConsultationHistory.gs`) providing: a
  staff-facing create function (mirroring `PatientIdentity.gs`'s manually-run wrapper
  precedent, or a small access-code-gated internal tool matching
  `internal/consultation-summary.html`'s existing pattern) and a patient-facing,
  session-authenticated read function returning the capped, sorted list (§3).
- **A new authorization shape Foundation hasn't needed before.** Every existing
  authenticated route (`get_profile`) takes no client-supplied identifier at all — it
  derives everything from the verified session. A detail-view fetch necessarily takes a
  client-supplied `record_id`, which means the handler must verify that record's own
  `patient_id` matches the session-derived `patient_id` **before** returning it —
  otherwise a patient could request another patient's `record_id` and read their
  clinical history. This is the first Foundation route where "derive `patient_id` from
  the session" (ADR-002, unchanged) is necessary but not sufficient — ownership of the
  specific requested record must also be checked. Worth its own explicit test case,
  the same way docs/29 §11 flagged Report Upload's cross-patient isolation as the
  highest-risk property to test explicitly.
- Two new `FoundationRouter.gs` dispatch cases (e.g. `get_timeline`, `get_timeline_entry`),
  following `get_profile`'s existing thin-wiring precedent.

# 11. Accessibility Considerations

- The `.journey`/`.j-step` list should be a real ordered list (`<ol>`) in markup, not
  just visually sequential `<div>`s — chronological order is meaningful content here,
  not decoration.
- Each entry needs its own heading level (`<h3>`, since the Timeline card/page title is
  already an `<h2>` per docs/37 §8's established hierarchy) so screen-reader users can
  navigate entry-to-entry.
- The detail view needs the same heading-hierarchy discipline plus a labeled "back to
  Timeline" link, not a bare browser-back reliance.
- The "No data yet" Empty State (§4) must remain fully present in the accessible tree
  with a plain-text explanation — not conveyed by an icon or illustration alone.
- Loading skeletons for the list (while the timeline fetch resolves) should follow
  PA-2's existing `aria-busy`/skeleton-then-swap pattern exactly, not a new convention.

# 12. Recommended Implementation Sequence

1. **Backend contracts** (§10): `shared/schemas/consultation-history.schema.json`,
   `FoundationConsultationHistory.gs` (create + patient-scoped list + single-record
   ownership-checked read), `FoundationRouter.gs` wiring, a new conformance stage.
2. **Staff entry tool** — needed before any real patient can see a populated timeline;
   mirrors `internal/consultation-summary.html`'s existing access-code-gated pattern.
3. **Shared session-guard/header extraction** (§7) — done once, before the two new
   pages duplicate `dashboard.js`'s pattern a second and third time.
4. **Full Timeline page** — the `.journey`/`.j-step` list, the "No data yet" Empty
   State (its first real consumer), loading skeletons.
5. **Consultation History detail view** — read-only, full text, "back to Timeline"
   link.
6. **Dashboard shell update** — the existing Timeline card wired to real data (last 3 +
   "View full timeline"), replacing its "Coming later in Phase 2A" Empty State.
7. **Validation** — a new conformance stage for the schema/functions above; a new
   committed browser-test suite extending `validation/pa-2-dashboard/`'s pattern
   (`get_timeline`/`get_timeline_entry` mocked at the network layer, the cross-patient
   authorization case explicitly tested per §10).
8. **Documentation** — docs/04 (concrete Timeline/Consultation History component
   entries), docs/29 §13/§16 (Batch 5D implementation notes), docs/24 (roadmap), docs/33
   (Timeline Event's `*Planned*` label updated to `*Implemented*`), CHANGELOG.

---

# Repository Consistency Review

A scoped pass across the documents this batch touches or depends on — not a full
re-run of docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md's whole-repository sweep, which
remains the historical record of what it found. This pass checks only what has changed
or become relevant since: PA-1/PA-2's additions, this document, and docs/38.

**Finding 1 — `entry_type` gap between docs/29 §4 and docs/33 §3.1 (real, actionable).**
Already detailed in §2 above. Not a contradiction (docs/29 §4 explicitly defers to
docs/33 for entity *meaning*, and never claimed to duplicate it column-for-column) but
a concrete implementation gap worth closing at build time rather than after a second
Timeline Event source exists.

**Finding 2 — docs/33's `*Planned*` labels are already known-stale, unresolved since the
last closeout.** docs/36 §12's own "still open" list already named "docs/33's stale
`*Planned*` labels for Patient/Patient Identity/Session" as unresolved after Identity &
Access shipped. Timeline Event/Symptom Log/Report (§3.1–§3.3) are correctly labeled
`*Planned*` today — accurate, since none is built yet — but will need the same update
this batch's own docs/33 relabeling (§12 item 8 above) should close for Timeline Event.
Recommend closing all of these stale labels together in one pass rather than one at a
time per batch, to avoid the same item recurring in a fourth closeout.

**Finding 3 — docs/09's Phase 2A/2B split and Entry Point wording remains open, unrelated
to this batch.** Still tracked in docs/29 §12 and docs/32, pre-dating PA-1/PA-2/this
review. Not a blocker for PA-3 — noted only so it isn't mistaken for a new finding.

**Finding 4 — no contradiction found between docs/38's deferred-work note and this
review's §7 recommendation.** docs/38 §7 anticipated exactly the condition (a second
authenticated page) this review's §7 now confirms has arrived — the two documents agree
rather than conflict.

**No duplication found** between this document and docs/37 — the two reviews cover
different batches (5C vs. 5D) and do not restate each other's content; where relevant,
this document cross-references docs/37/docs/38 rather than repeating them.

---

# Validation Run at Time of This Review

All four re-run clean, confirming the frozen PA-1/PA-2 surface (docs/38) is
undisturbed and this review introduced no code change:

- `node validation/static-analysis/analyze.js` — 0 findings.
- `node validation/phase-2a-foundation/conformance.js` — 61/61.
- `node validation/phase-1-5/validate.js` — 42/42.
- `validation/pa-2-dashboard/browser-test.js` — 26/26.

---

**This review does not authorize Batch PA-3 to begin.** Per this session's explicit
instruction, implementation waits for separate approval.
