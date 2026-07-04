# 42 - Reports + Google Drive Integration Readiness Review
## Version 1.0 — 2026-07-04

> Pre-implementation review for **Batch PA-5** (docs/29 §13 Batch 5F: the `Reports`
> sheet, Google Drive integration, and the platform's highest-risk feature, file
> upload/download — docs/29 §8, §11 risk #3). Per this session's explicit instruction:
> **no code was written to produce this review**, no production code, shared contract,
> schema, Apps Script file, or frontend file was created or modified — everything below
> is scoped strictly to the already-approved docs/29 §8 (Report Upload Architecture),
> docs/33 §3.3 (Report), docs/21 (Digital Twin "Investigation history"), docs/30/31 (ADRs),
> and the shipped precedent from PA-3 (record-ownership authorization) and PA-4 (the
> platform's first patient-writable route). This document does not authorize PA-5 to
> begin; implementation waits for separate approval — the same discipline docs/37,
> docs/39, and docs/41 were held to before PA-2, PA-3, and PA-4.
>
> **PA-4 status:** per this session's instruction, Batch PA-4 (docs/29 §13 Batch 5E) is
> now **frozen except for bug fixes**, joining Foundation, Identity & Access, and
> PA-1/PA-2/PA-3 as stable, tested surface. Nothing in this review modifies or depends
> on changing any PA-4 file.

---

# 1. Report Lifecycle

Per docs/33 §3.3 and docs/29 §8 (already approved, not a new decision):

- **Created** by upload — a patient selects a file through the authenticated
  dashboard, or staff uploads on a patient's behalf (docs/33 §3.3: "Uploaded by a
  patient (or staff, on a patient's behalf)"). This is the second patient-writable
  entity after Symptom Log (PA-4), but the *first* whose content is an opaque binary
  blob rather than typed form fields.
- **Persisted** as two linked artifacts: the binary itself in Google Drive, and a
  metadata row (`record_id`, `patient_id`, `uploaded_at`, `file_name`, `drive_file_id`,
  `mime_type`, `size_bytes`, `uploaded_by`) in the new `Reports` sheet (docs/29 §4).
  Both must exist for a Report to be considered successfully created — a partial write
  (Drive succeeds, Sheets fails, or vice versa) is a real failure mode this batch must
  handle explicitly (§11 below), unlike every prior entity, which writes to exactly one
  store.
- **Read** by the patient (own uploads only) via a list (metadata) and a download
  (content) path, and viewable/downloadable, never alterable, by staff with Drive
  access (docs/33 §3.3 Ownership: "Patient-uploaded content, staff-reviewable").
- **Not edited.** Neither docs/29 §8 nor docs/33 §3.3 describes an update path for an
  already-uploaded Report's metadata or content. Applying the same discipline PA-4's
  review already established for Symptom Log (no persisted mutation once created), this
  review recommends no update endpoint — a correction is a new upload, not a patched
  row. **Not explicitly stated in the approved architecture, so flagged rather than
  assumed** (see Open Questions, §11).
- **Not deleted, currently.** docs/33 §3.3: "no automated deletion currently planned."
  Unlike Consultation Summary's 14-day purge (a narrow, Phase-1.5-specific policy) and
  unlike Symptom Log (deletion explicitly ruled out), Report's deletion is simply
  silent on whether a patient-initiated delete should exist at all. This review
  surfaces it as an open question (§11) rather than inferring an answer — a
  patient-initiated delete is a materially different capability from "no automated
  purge job," and conflating the two would be a real scope guess.
- **Consumed later** by Digital Twin's "Investigation history" component (docs/21 §4.3,
  docs/33 §3.3 Future evolution: "a natural target for future OCR/structured-data-
  extraction work... explicitly out of scope until an AI Summary-pattern implementation
  is designed for it, per ADR-001/005"). PA-5's only obligation toward that future
  consumer is storing clean, typed metadata — nothing about content extraction belongs
  in this batch.

This is the platform's first entity whose lifecycle spans two independent storage
systems (Sheets + Drive) rather than one — a structurally new category of risk neither
Timeline nor Symptom Log carried, and the reason docs/29 §11 names this the highest-risk
feature in the phase.

---

# 2. Report Information Architecture

Two levels, mirroring Symptom Log's already-approved "don't invent a level" discipline
(docs/41 §2), not three:

1. **Dashboard card** (docs/29 §5: "Reports card — upload control + recent uploads").
   Like the Symptom Tracker card, this is a **write-affordance-first** card, not a pure
   read preview — it needs a file-input control plus, once uploads exist, a short
   recent-uploads list (file name + upload date, each downloadable). Unlike the
   Symptom Tracker card, a Report's "content" is not renderable inline (no bare-value
   summary makes sense for a PDF) — the card's read affordance is a list of
   filenames/dates with download links, not a data summary.
2. **Full history page** (new, this batch, `/my-health-journey/reports/`) — the
   patient's own uploads, reverse-chronological, capped for payload size (same
   precedent as Timeline's 50-entry cap and Symptom Log's list cap). Each row exposes
   file name, upload date, and a download action.

**No third, per-report detail level is needed**, for a different reason than Symptom
Log's (docs/41 §2: "no long-form text that benefits from its own page"). A Report *is*
a file — the only meaningful action beyond "see it in a list" is "download/view it,"
which this review treats as the row-level download action itself, not a separate
detail page that then offers the same one action again. If a future phase adds
per-report annotations, tags, or OCR-derived structured fields (docs/33 §3.3 Future
evolution), a detail view could be justified then — not speculatively now.

---

# 3. Upload Lifecycle

Per docs/29 §8's already-approved mechanics, restated precisely because this is the
step this review scrutinizes hardest:

1. Patient selects a file via a standard `<input type="file">` (native browser file
   picker — no custom drag-and-drop widget needed for v1; see Accessibility §13).
2. Browser reads the file and encodes it as base64 — the only way to transmit binary
   content inside this platform's existing `Content-Type: text/plain;charset=utf-8`,
   no-preflight JSON-body convention (every existing Foundation call, from `login.html`
   onward, uses this exact convention specifically to avoid a CORS-preflighted
   `OPTIONS` request, which Apps Script Web Apps do not handle). This is not a new
   decision — docs/29 §8 already specifies "browser reads file as base64" — but it is
   the first batch to actually exercise it, and it has a real, quantifiable cost: base64
   inflates payload size by roughly 33%, on top of Apps Script's own request-size
   ceiling (§12 below).
3. POST (with `session_token`, exactly like every other write) to the Web App.
4. Server validates: MIME type against an allowlist (PDF/JPG/PNG) by actual content,
   not file extension or the client-reported MIME string (docs/29 §8); size against a
   server-enforced cap (client-side limits are UX-only hints, never trusted — the same
   "server validates, client is UX only" discipline every prior batch has applied).
5. Server writes the validated bytes to Drive under a private folder/permission scheme
   (§5 below), generates a `record_id`, and writes the `Reports` metadata row.
6. Server returns success/failure through the same response-envelope shape every other
   write already uses.

**A real difference from every prior write path:** this is the first Foundation write
whose request body is dominated by content size rather than field count. Every
performance and validation concern in this review traces back to that one fact.

---

# 4. Download Lifecycle

**Not previously designed anywhere in this repository — a genuine gap this review must
surface, not silently resolve.** docs/29 §8 says only "every list/download call
re-derives `patient_id` from the session token" — it names the authorization property
required but does not specify the wire mechanism. Two candidate approaches exist, and
this review recommends one rather than inventing a third:

- **Rejected: a direct Drive share link.** docs/29 §8 is explicit — "Drive permissions
  private — never 'anyone with the link.'" A shared-link approach is disqualified by
  the platform's own already-approved architecture, not by this review.
- **Recommended: base64 content returned through the same authenticated, session-
  verified action pattern as every other read.** A `download_report`-style action
  (naming TBD in implementation, mirroring `get_timeline_entry`'s existing precedent)
  takes a `record_id`, verifies session + row ownership (§6 below — the same pattern
  PA-3 already proved), reads the Drive blob, and returns its content base64-encoded
  inside the response envelope. The browser then reconstructs a `Blob` and triggers a
  download via `URL.createObjectURL` — a standard, well-supported technique requiring
  no new platform capability.

This carries the same payload-size cost as upload, in the other direction, and the
same recommendation applies: the list action (`get_reports`) should return **metadata
only**, never file content, exactly mirroring Timeline's and Symptom Log's existing
"list is cheap, detail is the expensive call" discipline — a per-record download is a
separate, explicit action a patient triggers by clicking a specific file, not something
bundled into the list response.

---

# 5. Google Drive Integration

**A wholly new platform primitive for this codebase.** A repository-wide search confirms
zero existing use of `DriveApp` anywhere in `apps-script/` — every prior batch
(Phase 1.5 and Phase 2A alike) has used only `SpreadsheetApp`, `MailApp`,
`PropertiesService`, `CacheService`, and `UrlFetchApp`. This review treats Drive
integration as genuinely new engineering, not a small variation on an established
pattern, and recommends the same discipline `FoundationDataStore.gs` already set for
`SpreadsheetApp`: **exactly one new Foundation file may call `DriveApp`**, so a future
storage-backend migration (ADR-006 — Drive is an implementation detail, exactly like
Sheets) touches one file, not every consumer.

Key integration decisions this review surfaces, none of them made here:

- **Folder structure.** A single private folder (or a small, fixed set — e.g. one
  top-level "Reports" folder, matching how `PATIENT_SPREADSHEET_ID` is one fixed
  spreadsheet) is the simplest option and matches ADR-006's "avoid over-abstraction at
  pilot scale" precedent already applied to `Patients`/`condition_slug`. A
  per-patient-subfolder scheme adds real complexity (folder-creation-on-first-upload
  logic, another place patient_id could leak into a name) for no benefit at pilot
  scale, since access control is enforced at the application layer (§6), not by Drive
  folder boundaries. **Recommendation: one fixed Drive folder, private, never
  patient-partitioned by folder.**
- **File naming.** docs/29 §8: "a client-supplied filename is never used as a path
  component." Drive has no real path hierarchy, but the same principle applies to the
  *name* Drive stores the file under — the original filename must never be trusted as
  the actual Drive object name (a name collision, or a deliberately malicious filename
  containing control characters, is otherwise possible). **Recommendation: the Drive
  file is named using the generated `record_id`, not the patient-supplied filename;
  the original filename is stored only as the `file_name` metadata column, shown to
  the patient but never used to address the file itself** — the same "identity vs.
  display" separation docs/40 already established for `record_id` vs. `entry_date`.
- **Permissions.** Every file must be created with no sharing beyond the script's own
  owning account — Apps Script's default (a file created by `DriveApp.createFile()` is
  private to the script's Drive by default) is the correct starting point, but this
  must be **verified**, not assumed: a conformance check should explicitly assert the
  created file's sharing access is not `ANYONE`/`ANYONE_WITH_LINK` before this batch is
  considered done (§15).
- **Quota.** docs/29 §11 risk #6, restated because Reports is the first feature to
  actually consume it: the free Google account's Drive storage (15GB, shared with
  Gmail) is a real, already-accepted ceiling — low risk at pilot scale, worth
  monitoring as uploads accumulate, not a blocker for this batch.
- **No malware/virus scanning** exists in this stack (docs/29 §8's own accepted
  limitation, unchanged, restated rather than silently dropped) — mitigated by
  type/size restriction and doctor/staff review before any file is opened, an accepted
  risk stated openly, not a gap this batch is expected to close.

---

# 6. Authorization Model

**The same primitive every Foundation route already uses, plus one new surface Reports
introduces that neither Timeline (PA-3) nor Symptom Log (PA-4) needed on their own.**

- **Upload and list** need only the authorization shape PA-4 already proved:
  `patient_id` derived exclusively from the verified session (`withFoundationAuth_()`,
  ADR-002), never from a client-supplied field. No second patient's record can even be
  named in these two calls, the same simplification docs/41 §12 noted for Symptom Log's
  create/list.
- **Download** needs PA-3's authorization shape instead: a client-supplied `record_id`
  whose row-level `patient_id` must be independently verified against the
  session-derived `patient_id` before returning anything (docs/40 Q3's already-proven
  pattern) — an unknown `record_id` and a cross-patient `record_id` must return the
  identical `FOUNDATION_NOT_FOUND` envelope, the same anti-enumeration discipline every
  record-level fetch in this codebase already follows.
- **A genuinely new authorization surface, not present in any prior batch: the Drive
  object itself is a second, independent access-control boundary beyond the Sheets
  row.** Every prior "ownership check" (PA-3's `get_timeline_entry`) only ever gated
  access to a Sheets row — there was no second system where the same data was also
  independently reachable. Here, even a perfectly correct application-layer ownership
  check on the `Reports` row is not sufficient by itself: if the underlying Drive file
  were ever created with non-private sharing (a configuration mistake, not a Sheets-
  layer bug), a leaked or guessed `drive_file_id` could bypass the Foundation
  authorization layer entirely by hitting Drive directly, never touching
  `withFoundationAuth_()` at all. This is the single most important property to design
  for and test explicitly in this batch — more important than the Sheets-row check
  alone, precisely because it is a failure mode none of PA-1 through PA-4 could
  have had.

**Recommendation:** treat "the Drive file's sharing is verifiably private" as a
first-class, independently tested property (§15), not an assumed consequence of
"we called `DriveApp.createFile()` and didn't set sharing" — a default is not the same
as a verified guarantee.

---

# 7. File Ownership

Per docs/33 §3.3 (already settled, not open for this review to decide): **patient-
uploaded content, staff-reviewable.** Two provenance values exist on
`uploaded_by` — `patient` (the normal, session-authenticated path) and `staff`
(uploaded on a patient's behalf). Ownership of the *record* (whose health data this
is) always remains the named `patient_id`, regardless of who performed the upload —
identical in spirit to Consultation History, where staff authors the row but the
patient owns the underlying history.

**Open question this review surfaces (§11):** is a staff-initiated upload actually in
this batch's scope, or a schema field describing a future capability with no code path
yet — the same category of decision PA-3's review resolved by deferring a full
staff Web App tool in favor of a manually-run editor wrapper (`createFoundationConsultationEntry()`
precedent). This review recommends the same resolution for Reports: `uploaded_by`
exists in the schema as approved (docs/29 §4), but only the patient-authenticated
upload path is built as a Web App route in PA-5; a staff-side upload, if wanted, gets
the same manually-run wrapper pattern already established twice (`PatientIdentity.gs`,
`FoundationConsultationHistory.gs`) rather than a second Web App route or new
staff-auth infrastructure this batch's scope does not otherwise require.

---

# 8. Relationship to Consultation History

**Independent, by design — no foreign key, mirroring Symptom Log's already-approved
asymmetry (docs/41 §6).** docs/29 §4's `Reports` columns (`record_id`, `patient_id`,
`uploaded_at`, `file_name`, `drive_file_id`, `mime_type`, `size_bytes`, `uploaded_by`)
include no `consultation_id` or `source_ref`-style pointer. A patient may upload a lab
report entirely independent of any consultation ever having been logged for them — the
two entities describe different things (a doctor-authored visit record vs. a
patient-supplied document) and this review finds no basis in the approved architecture
for linking them. PA-5 should not add a consultation link — doing so would be an
unrequested schema addition.

---

# 9. Relationship to Timeline

**Excluded from the Timeline feed in this batch — the same already-decided boundary
Symptom Log carried (docs/39 §8, docs/41 §7), extended to a third entity.** docs/29 §6
scopes Timeline strictly to `ConsultationHistory`; nothing in docs/29 or docs/33 names
Report as a Timeline Event source for this phase. PA-5 should not add Report rows into
the Timeline query. The natural future point to reconsider this is the same one docs/39
and docs/41 already named: once `entry_type` (fixed to `"consultation"` since PA-3) is
deliberately widened to accommodate a second real source — not before, and not as a
side effect of this batch.

---

# 10. Relationship to AI

**Categorically excluded, stated in at least three places in the already-approved
architecture, and this review adds no new interpretation.** docs/29 §0: "No AI is used
anywhere in this phase." docs/29 §8's own header line: "the platform's first arbitrary
file-handling surface" — no AI processing is described anywhere in that section.
docs/33 §3.3: "No AI processes report content in Phase 2A." The only AI-adjacent
mention anywhere is docs/33 §3.3's Future evolution note — "a natural target for future
OCR/structured-data-extraction work... explicitly out of scope until an AI Summary-
pattern implementation is designed for it, per ADR-001/005" — which is a forward
pointer, not a description of anything this batch builds. PA-5 stores bytes and
metadata; it does not read, summarize, transcribe, or classify file content in any way.

---

# 11. Validation Rules

Applying the same "server validates, client is UX only" discipline every prior batch
has used, plus the two mechanisms unique to file content:

- **MIME type** — validated server-side against an allowlist (PDF/JPG/PNG) **by actual
  content, not file extension or the client-declared MIME string** (docs/29 §8, already
  approved). **Resolved by live deployment verification (2026-07-04):** this review
  originally flagged `Utilities.newBlob(bytes)`'s undocumented content-type inference as
  an open, unverified question. Real-deployment testing found that
  `Utilities.newBlob(bytes)` with no explicit `contentType`/filename hint returns `null`
  for a genuinely valid PNG — every real upload was being rejected as a result.
  `FoundationReports.gs`'s `foundationDetectActualMimeType_()` was corrected to check
  each allowed type's own fixed magic-number byte signature directly, rather than
  depending on that platform behavior — still authoritative and content-based, just
  implemented explicitly instead of assumed.
- **File size** — a server-enforced cap is required (docs/29 §8: "enforces a size cap
  server-side"), but **no specific number appears anywhere in the approved
  architecture** (docs/29 §8, §11; docs/33 §3.3; docs/16-PERFORMANCE-STANDARDS.md has no
  file-size or payload-size guidance of any kind — confirmed by direct search, a real,
  pre-existing gap this review did not create). This is an open question that must be
  answered with an explicit number before the schema/backend are written, not inferred
  from silence (§12 below explores the platform constraint that bounds the answer).
- **Filename** — never used as a path/object-name component (§5); stored as display
  metadata only, HTML-escaped at render time using the same `escapeFoundationHtml_()`/
  `escapeHtmlForDisplay()`-style helper every other patient-facing free-text field
  already uses (PA-3/PA-4 precedent), since a filename is patient-controlled text.
- **`patient_id`** — always session-derived (ADR-002, unchanged), never accepted from
  the request body, identical to every existing Foundation route.
- **`uploaded_at`** — server-set at write time (`foundationNowIso_()`), consistent with
  every other `created_at`-style field's provenance discipline.
- **`drive_file_id`, `size_bytes`, `mime_type`** — all server-derived from the actual
  written Drive object and the actual validated content, never trusted from the
  client's own claims about its file (a client could lie about `size_bytes` in a
  request field; the server must read the real decoded byte length).

**Open questions this review surfaces rather than assumes an answer to:**
1. What is the exact file-size cap, in bytes? (§12)
2. Is a Report's metadata (in particular `file_name`) ever patient-editable after
   upload, or — like every other entity in this domain model except the still-mutable
   `Patients` profile fields — is it permanent once written? (§1)
3. Is a patient-initiated delete in scope for this batch, or explicitly deferred?
   (§1) — distinct from "no automated purge job," which is already settled.
4. Is staff-initiated upload (`uploaded_by = staff`) a real Web App-reachable path in
   this batch, or a schema field with no code path yet, deferred the same way PA-3
   deferred a full staff tool? (§7)

None of these four blocks this review, but all four should be resolved by explicit
approval before `shared/schemas/report.schema.json` is written — the same sequencing
docs/41 §10/§15 already used for Symptom Log's open questions.

---

# 12. File Size and File Type Restrictions

**Type:** PDF, JPG, PNG only (docs/29 §8, already approved, not open for this review to
change). No other document or image type, no archive/executable formats — a narrow,
already-justified allowlist matching what an "investigation history" document
realistically is (docs/21 §4.3).

**Size:** No specific cap exists in any approved document (§11). This review does not
invent one, but names the real platform constraint that should bound whatever number is
chosen: Google Apps Script Web Apps have documented request-size and execution-time
ceilings, and this repository's existing calling convention (a single JSON string body,
no streaming/chunked upload) means the **entire file, base64-inflated by roughly a
third, must fit inside one `doPost` invocation's request body and be processed within
one execution**. A conservative cap (commonly used in similar Apps Script integrations
is single-digit megabytes, e.g. 5MB, well under any documented ceiling) is far safer
than assuming headroom up to a platform maximum that this stack has never exercised
before. **Recommendation: pick a conservative number (e.g. 5MB) explicitly, verify it
against a real end-to-end upload in this environment before shipping, and document the
actual tested ceiling — not a number copied from generic Apps Script documentation
without having exercised it here.** This is exactly the kind of platform-specific
verification docs/29 §14's Foundation batches already modeled (e.g., F4's constant-time-
comparison and expiry-boundary checks) — real execution, not assumed behavior.

Both the type and size checks must be enforced **server-side, unconditionally** — a
client-side `accept=".pdf,.jpg,.png"` attribute and a client-side size check are UX
conveniences only (faster feedback, fewer wasted uploads), never the actual security
boundary, per every prior batch's "server validates, client is UX only" rule.

---

# 13. Accessibility

WCAG 2.2 AA (docs/14), applied to this batch's two new surfaces — a **file-upload
control** (genuinely new territory: no existing Phase 2A form has a file input) and a
**downloadable-file list** (structurally similar to PA-3/PA-4's read-only lists, with
one new per-row affordance: a download action):

- The file input needs a real, associated `<label for>`, exactly like every other
  field in this codebase — a bare `<input type="file">` with no label is a common, real
  accessibility gap.
- **No custom drag-and-drop widget for v1** — a plain, native `<input type="file">` is
  sufficient and avoids inventing new keyboard/focus/announcement behavior a native
  control already gets for free. If drag-and-drop is wanted as a future enhancement, it
  must be *additive* to a working native file input, never a replacement for it — this
  should be confirmed as a decision, not assumed silently either way.
- **Upload progress/status feedback** reuses the exact `.status`/`role="status"`/
  `aria-live="polite"` component PA-4 already established for its own "patient stays on
  the same page after submitting" pattern (docs/41 §13) — Reports is the second
  consumer of that pattern, not a reason to invent a third status mechanism. The submit
  control should be disabled during the upload round trip (mirroring PA-4's
  `submitBtn.disabled` pattern) with a plain-text "Uploading…" status, since a file
  upload can meaningfully take longer than a text-field submission and a sighted-only
  spinner would leave screen-reader users with no equivalent feedback.
- **The full history/recent-uploads list should be a real ordered list (`<ol>`)**,
  mirroring docs/39 §11's and docs/41 §13's existing rule — upload order/recency is
  meaningful content here too.
- **Each download action needs a specific, non-generic accessible name.** A row of
  identical "Download" buttons/links with no distinguishing accessible name is a real,
  common accessibility gap in file-list UIs — each control's accessible name (visible
  text or `aria-label`) must include enough to distinguish it (e.g. the file name and/or
  upload date), not a bare repeated "Download."
- The "No reports yet" Empty State must remain in the accessible tree as plain text
  (docs/39 §4's rule, applied identically here, third consumer after Timeline and
  Symptom Log).
- Loading skeletons should follow the existing `aria-busy`/skeleton-then-swap
  convention, not a new one.
- Carry forward the corrected `:focus-visible` handling already established since
  `login.html`/`verify.html` — not the still-unfixed `internal/consultation-summary.html`
  pattern (a Phase 1.5 file, out of scope, and still not this batch's problem to fix).

---

# 14. Component Reuse

- **Fully reusable, unchanged:** `assets/site.css` tokens, `.card`/`.status`/
  `.skeleton`/`.field`, and PA-2's Empty State component — the "No data yet" variant
  gets its third real consumer here (Timeline first, Symptom Tracker second).
- **Directly reusable, not rebuilt a fourth time:** `my-health-journey/session-guard.js`
  — the Reports full-history page is exactly the next consumer PA-3's own extraction
  already anticipated, the same way Symptom History was its second consumer.
- **Reusable with adaptation:** PA-3/PA-4's `.tl-track`/`.tl-item` list visual — the
  Reports list is the same underlying shape (a reverse-chronological list of dated
  entries), now with one new per-row affordance (a download action) that neither prior
  consumer needed. Should be adapted, not reinvented as a third list style, consistent
  with docs/41 §14's own "reuse this pattern rather than invent a third list style"
  precedent — now genuinely a fourth-plus consumer, reinforcing that this pattern has
  become this repository's de facto standard list component.
- **Reusable with adaptation:** PA-4's `.status`/`aria-live` "stay on page, get inline
  feedback after submitting" pattern — Reports' upload control is the second consumer
  of a flow that keeps the patient on the same page after a write (Symptom Tracker was
  the first).
- **Dashboard wiring pattern:** `dashboard.js`'s PA-3/PA-4 additions
  (`loadTimelinePreview()`/`loadSymptomPreview()` and their respective helper pairs) are
  the template to mirror for a new `loadReportsPreview()`-style pair — the same
  additive-only, disclosed-exception pattern to a frozen file, not a restructure of the
  shell.
- **Genuinely new, no existing precedent to adapt:** a file-input control and a
  client-side base64-encoding step (`FileReader`) — this batch's own first instance of
  both, since no prior Phase 2A form has ever taken a file as input.

---

# 15. Backend Contracts Required

Named here as requirements this review identifies — **not designed or implemented by
this document**, following docs/39 §10's and docs/41 §12's own framing exactly. Per
docs/29 §14 Decision 1's established pattern (a new, distinctly-named entity file added
to the existing `apps-script/` project, never modifying frozen files):

- A new `shared/schemas/report.schema.json` (+ `.md`), mirroring the existing
  `shared/schemas/*.schema.json` pattern — resolving §11's four open questions
  (size cap, metadata mutability, delete scope, staff-upload scope) before this
  contract is written.
- A new Foundation entity file (e.g. `FoundationReports.gs`) — the only Foundation file
  calling `DriveApp`, mirroring `FoundationDataStore.gs`'s existing "only file calling
  `SpreadsheetApp`" precedent (ADR-006, ADR-009) — providing:
  - A patient-facing, session-authenticated **upload** function: validates MIME (by
    actual content) and size server-side, writes to a private Drive location using a
    generated identifier (never the client-supplied filename) as the object's own
    name, and writes the `Reports` row only after the Drive write succeeds — with an
    explicit, tested answer for what happens if the Drive write succeeds but the
    Sheets write then fails (a new failure mode no prior single-store entity has had to
    handle).
  - A patient-facing, session-authenticated **list** function returning the caller's
    own Report metadata only (never file content), capped and sorted (`uploaded_at`
    descending, mirroring existing tiebreaker discipline).
  - A patient-facing, session-authenticated **download** function taking a `record_id`,
    performing the same ownership verification `foundationGetConsultationEntryById_()`
    already established (docs/40 Q3) before reading and returning the Drive blob's
    content.
- Three new `FoundationRouter.gs` dispatch cases (e.g. `upload_report`, `get_reports`,
  `download_report`), following `log_symptom`/`get_symptom_logs`'s existing
  thin-wiring precedent — the same category of additive, disclosed exception PA-3 and
  PA-4 already used for their own new cases.
- A **new mocked `DriveApp` primitive** in `validation/phase-2a-foundation/harness.js` —
  a real, new test-tooling requirement, not an incremental extension of an existing
  mock (every prior batch's harness extension — HMAC, `CacheService`, `computeDigest` —
  mocked a platform API the harness already partially covered; `DriveApp` is entirely
  new). The mock must be capable of asserting a created file's sharing/access setting,
  not just its existence, since §6 identifies that assertion as this batch's single
  most important test.
- A new conformance stage in `validation/phase-2a-foundation/conformance.js`, covering
  at minimum: schema conformance; MIME allowlist enforcement (accept PDF/JPG/PNG,
  reject others by actual content); size-cap enforcement; cross-patient isolation on
  list and download (the platform's highest-risk property, per docs/29 §11); the
  Drive-file-is-private assertion (§6); and the partial-failure handling named above.

---

# 16. Recommended Implementation Sequence

1. **Resolve open questions** (§11's four items: exact size-cap number, metadata
   mutability, delete scope, staff-upload scope; §5's Drive folder/naming scheme; §11's
   MIME-validation mechanism concretely verified against real Apps Script behavior) —
   needed before the schema is written, not discoverable from silence.
2. **Backend contracts** (§15): `shared/schemas/report.schema.json`,
   `FoundationReports.gs` (upload + list + download only — no update, no delete unless
   explicitly approved), `FoundationRouter.gs` wiring, the new `DriveApp` harness mock,
   a new conformance stage. Verify the actual, real, tested size ceiling in this
   environment (§12) before locking the cap into the schema/validation.
3. **Upload control** — the dashboard card's write affordance (file input +
   `FileReader`-based base64 encoding + upload call), built and verified in isolation
   before wiring into the live card, mirroring docs/41 §15's "quick-log form before
   dashboard wiring" sequencing applied to a file input instead of a text form.
4. **Full history page** — reusing PA-3/PA-4's `.tl-track`/`.tl-item` pattern and
   `session-guard.js` unchanged, adding the one new per-row download affordance
   (§13/§14).
5. **Dashboard card update** — replace the "Coming later in Phase 2A" Empty State with
   the upload control plus a short recent-uploads preview plus "View all reports" link,
   mirroring PA-3/PA-4's card-wiring pattern (an additive, disclosed change to
   `dashboard.js`, not a restructure).
6. **Validation** — the new conformance stage above, plus a new committed browser-test
   suite (e.g. `validation/pa-5-reports/`, mirroring `pa-4-symptom-tracker`'s
   discipline) explicitly covering: upload success/rejection (wrong type, oversized),
   cross-patient isolation on list and download, the Drive-privacy assertion (§6), and
   the full accessibility checklist (§13) — the same "prove the pattern, don't just
   design it" discipline every prior batch has been held to.
7. **Documentation** — docs/04 (concrete Reports component entries), docs/12 (Reports
   sheet + Drive integration, closing docs/29 §12's named "Open" item), docs/15 (a new
   Phase 2A implementation-notes section, mirroring the PA-3/PA-4 sections already
   there — this batch's authorization model, §6, is exactly the kind of new shape those
   sections exist to record), docs/29 §13/§16 (PA-5 implementation notes), docs/24
   (roadmap), docs/33 (Report's `*Planned*` label updated to `*Implemented*`),
   CHANGELOG.
8. **Security note carried forward, not repeated in full:** this is the platform's
   highest-risk Phase 2A feature (docs/29 §11 risk #3), sequenced last among
   data-features specifically because the write-authorization pattern was already
   proven on lower-risk, non-file data first (Timeline read-only in PA-3, Symptom
   Tracker's first patient-write in PA-4). PA-5 does not prove authorization for the
   first time — it proves a **second**, harder property on top of an already-proven
   pattern: that a second, independent storage system (Drive) cannot be used to bypass
   an authorization check that is correctly enforced at the Sheets layer.

---

# Repository Consistency Review

A scoped pass across the documents and code this batch touches or depends on — not a
full re-run of docs/34-ARCHITECTURE-CONSISTENCY-REVIEW.md's whole-repository sweep,
mirroring docs/39's and docs/41's own scoping: this checks only what has changed or
become newly relevant since PA-4 shipped, plus what this review itself touches.

**Finding 1 — docs/41's Repository Consistency Findings 2 and 3 (stale `*Planned*`
labels, Timeline Event Summary Table drift) are already resolved, not carried forward.**
Verified directly: docs/33 §1.1/§1.2/§1.3 now read `*Implemented*` for Patient, Patient
Identity, and Session, and the Summary Table's Timeline Event row now matches its
section header (`Implemented | 2A (Batch PA-3, one entry_type)`). Neither finding needs
repeating here — recorded only so a future reader doesn't mistake their absence from
this review for an oversight.

**Finding 2 (new) — `apps-script/FoundationConsultationHistory.gs`'s own header comment
contains a real, small self-contradiction.** Its header states: "Not Foundation-
prefixed, for the same reason PatientIdentity.gs and FoundationLoginTokens.gs aren't."
This is incorrect on both counts: the file itself is named
`FoundationConsultationHistory.gs` (it *is* Foundation-prefixed), and
`FoundationLoginTokens.gs` is also Foundation-prefixed — only `PatientIdentity.gs` is
genuinely unprefixed. The comment appears to be a copy-forward from reasoning that
applied only to `PatientIdentity.gs`, not updated when reused. **Practical effect on
this review's own recommendation:** the actually-observed convention (not the
mis-stated one) is that every concrete entity file built since `PatientIdentity.gs` —
`FoundationLoginTokens.gs`, `FoundationConsultationHistory.gs`, `FoundationSymptomLog.gs`
— *is* Foundation-prefixed. §15 above recommends `FoundationReports.gs`, consistent
with the real pattern in practice, not the misstated one in the comment. A small,
harmless documentation (comment) inconsistency — does not block PA-5, worth a one-line
fix in a future pass rather than a separate blocking change.

**Finding 3 — docs/16-PERFORMANCE-STANDARDS.md has no file-size or request-payload
guidance of any kind.** Confirmed by direct search (zero matches for "size," "payload,"
"MB," or "KB"). This is a real, pre-existing gap this review did not create but must
name, since §11/§12 above depend on a number that has never been established anywhere
in this repository's standards documents — the same category of "genuine gap, not a
settled decision this review can just apply" docs/41 §11 already found for offline
support. Recommend docs/16 gain an explicit file-size/payload-size standard once §12's
open question is resolved, closing this gap permanently rather than leaving each future
batch to rediscover it.

**Finding 4 — no contradiction found between PA-4's actual shipped state and its own
documentation.** Verified directly, not assumed: re-running every committed Node
validation suite against the current repository state reproduces the exact same results
docs/29 §16 already recorded for PA-4's shipped state (see Validation Run below) —
confirming zero drift since PA-4's closeout.

**Finding 5 — the committed Playwright browser-test suites still cannot be executed in
this review's environment, unchanged from docs/41's Finding 5.** No `package.json`
exists anywhere in this repository, and `node_modules/playwright` is absent from this
session (`require.resolve('playwright')` fails). This is the same disclosed
tooling/environment gap docs/41 already recorded, not a new regression — every
Node-only suite (`static-analysis`, `phase-2a-foundation` conformance, `phase-1-5`
regression) ran cleanly to completion (see below). PA-4's own closeout notes
(docs/29 §16) already disclose that its own browser-test runs used a session-local,
uncommitted Playwright install to work around this same gap — this remains a real,
carried-forward, disclosed limitation, not something this review resolves.

**No duplication found** between this document and docs/37/docs/39/docs/40/docs/41 —
each reviews a different batch and does not restate another's content; where relevant,
this document cross-references them rather than repeating them.

---

# Validation Run at Time of This Review

Executed directly against the current repository state (branch
`claude/pa-5-readiness-review-12g3k8`, synced to `origin/main` at commit `473f3f2`, the
PA-4 merge commit), not assumed from prior documents:

- **Static Analysis** — `node validation/static-analysis/analyze.js` → **PASS, 0
  findings** across duplicate globals, duplicate function names, duplicate constants,
  namespace collisions, unused exported helpers, and circular dependencies (31
  `apps-script/*.gs` files scanned).
- **Conformance** — `node validation/phase-2a-foundation/conformance.js` → **PASS,
  107/107 checks**, covering Foundation, Identity & Access, PA-3's Consultation
  History, and PA-4's Symptom Log stages exactly as documented in docs/29 §16.
- **Regression** — `node validation/phase-1-5/validate.js` → **PASS, 42/42 checks**,
  confirming zero regression to the Phase 1.5 pipeline.
- **Repository state** — `git status`: clean, no uncommitted changes.
- **Frontend browser suites** — `validation/pa-2-dashboard/browser-test.js`,
  `validation/pa-3-timeline/browser-test.js`, and
  `validation/pa-4-symptom-tracker/browser-test.js` could not be run in this environment
  (Finding 5 above — missing `playwright` dependency, no committed `package.json`). Not
  re-verified independently by this review; their last-recorded results (30/30, 29/29,
  and 28/28 respectively) stand as documented in docs/29 §16, unchanged since none of
  their target files were touched by this review.

All three executable suites reproduce the exact counts docs/29 §16 already recorded for
PA-4's shipped state — independent confirmation of zero drift, not a re-statement of a
prior claim.

---

**This review does not authorize Batch PA-5 to begin.** Per this session's explicit
instruction, implementation waits for separate approval — and per §11 above, four open
questions (exact size cap, metadata mutability, delete scope, staff-upload scope) plus
§5's Drive folder/naming scheme and §11's MIME-validation mechanism should be explicitly
answered before that approval is given, not inferred silently once implementation
starts.
