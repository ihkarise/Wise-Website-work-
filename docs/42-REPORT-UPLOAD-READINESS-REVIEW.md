# 42 - Report Upload Readiness Review
## Version 1.0 — 2026-07-04

> Pre-implementation review for **Batch PA-5** (docs/29 §13 Batch 5F: the `Reports`
> sheet, Drive integration, and the platform's highest-risk feature, file upload — per
> docs/29 §8/§11). Scoped strictly to the already-approved docs/29 §8 (Report Upload
> Architecture), docs/29 §10 (Security Model), docs/33 §3.3 (Report), and
> `shared/constants/upload-limits.md`/`shared/schemas/report.md` (created alongside this
> review, per `shared/README.md`'s bootstrap exception — the same one Foundation's F2/F3
> and PA-4's `condition-slugs.json` batches already used). Seven architecture decisions
> that docs/29 §8 left open at the plan level are resolved by explicit approval below,
> before implementation began, the same discipline docs/37/docs/39/docs/41 were held to
> before PA-2/PA-3/PA-4.
>
> **Approved. Implementation proceeds immediately following this review, per this
> session's explicit instruction** — unlike docs/37/39/41, which were each committed in
> a separate session before their batch's own implementation began, this review and
> Batch PA-5's implementation were approved and built together in one session. This does
> not relax the discipline: every decision below was resolved and recorded before the
> corresponding code was written, in the order listed.
>
> **PA-4 status:** Batch PA-4 (docs/29 §13 Batch 5E) is now **frozen except for bug
> fixes**, joining Foundation, Identity & Access, and PA-1/PA-2/PA-3 as stable, tested
> surface. Nothing in this review modifies or depends on changing any PA-4 file.

---

# 1. File Size

**Decision: 5 MB (5,242,880 bytes) per file, stored as a shared constant, never
hardcoded.**

`shared/constants/upload-limits.json` (version 1.0.0) is this value's one canonical
home — the bootstrap exception, created alongside its first implementation
(`apps-script/FoundationReports.gs`). `FoundationReports.gs` ports it into its own
`FOUNDATION_REPORT_MAX_UPLOAD_BYTES_`; `my-health-journey/dashboard.js` ports the same
value for its own client-side, UX-only pre-check. The **only** trustworthy enforcement
is server-side, against the real decoded byte length — a client-reported file size (or a
client-side check alone) is never sufficient, per docs/29 §8's existing "client-side
limits are UX only, never trusted" rule.

# 2. MIME Validation

**Decision: use every mechanism realistically available on this platform. Never rely on
the filename extension alone. Disclose the limitation explicitly if full content
validation isn't possible — never imply stronger validation than actually exists.**

Three layers, in increasing order of trustworthiness (`shared/constants/upload-limits.md`
has the full detail):

1. **Filename extension** — trivially spoofed, checked only as a named, disclosed,
   non-sole signal.
2. **Client-declared `File.type`/`mime_type`** — also spoofable by any client capable of
   crafting its own request; a fast, UX-only rejection before any bytes are decoded.
3. **Server-side, content-based detection** — `Utilities.newBlob(bytes)`, whose
   documented behavior is to "attempt to determine the correct extension and
   content-type of the data based on the structure of the byte array." This is the only
   one of the three that inspects the actual uploaded bytes, and the one
   `foundationCreateReport_()` treats as authoritative.

**The explicitly disclosed limitation:** this is a byte-signature heuristic, not a
parser and not a malware/virus scanner. A file that is byte-for-byte a valid PDF/JPG/PNG
but carries a malicious embedded payload can still pass. No malware/virus scanning
capability exists anywhere in this stack — the same accepted, already-stated limitation
docs/29 §8 records, mitigated the same way (type/size restriction plus doctor review
before any file is opened by staff), not a technical guarantee of file safety. Neither
`shared/constants/upload-limits.md` nor `apps-script/FoundationReports.gs`'s own header
comment claims otherwise.

# 3. Authorization

**Decision: authorization always begins with the application. Always verify patient
ownership before exposing metadata or downloads. Drive permissions are defense-in-depth
only — never the authorization boundary.**

Every list (`get_reports`) and download (`download_report`) route derives `patient_id`
exclusively from the verified session (ADR-002), the same primitive every prior
Foundation route already uses. `download_report` additionally accepts a client-supplied
`record_id`; `foundationGetReportById_()` independently verifies the fetched row's own
`patient_id` matches before `foundationDownloadReport_()` ever calls `DriveApp` — the
same "unguessability is not itself an authorization boundary" discipline
`foundationGetConsultationEntryById_()` established (docs/40 Q3), extended here to Drive
content instead of a Sheet row. The Drive file itself is never explicitly shared
("anyone with the link" or otherwise) — its default, script-owner-only permission is a
second, independent layer, never the mechanism a legitimate request relies on.
`download_report` never returns a Drive URL to the browser; the server fetches bytes
inside its own already-authorized execution and returns them base64-encoded, so a
patient's browser is never given any Drive-level access of its own — verifying that a
bypassed or misconfigured Drive permission still could not leak a file without the
application's own check first passing.

# 4. Metadata

**Decision: a Report's metadata becomes immutable immediately after upload. No edit
operation.**

`apps-script/FoundationReports.gs` provides create, list, and get-by-id/download
functions only — no update function exists or should exist. Verified as an absence in
`validation/phase-2a-foundation/conformance.js` Stage 9, not merely omitted from a
feature list.

# 5. Delete

**Decision: no delete operation. Deletion is outside Phase 2A/Batch PA-5.**

Consistent with #4 — no delete function exists in `FoundationReports.gs`, and none is
planned for this phase. docs/33 §3.3's own "no automated deletion currently planned"
line is unchanged by this batch.

# 6. Staff Upload

**Decision: no staff Web App upload route. If staff upload is required, use a manually
executed wrapper only.**

`FoundationRouter.gs` gains no staff-facing case for this batch. The one staff-attributed
path is `createFoundationReportForExistingDriveFile()`, a manually-run Apps Script
editor wrapper — the same no-route, no-Sheet-menu pattern
`createFoundationConsultationEntry()`/`createFoundationPatient()` already established
for exactly this category of gap. It attaches an already-existing Drive file (uploaded
to Drive directly by staff, outside this application) to a patient's Reports list,
running the identical content-based type/size validation the patient upload route uses,
and never re-uploads or moves the referenced file.

# 7. Existing Documentation Bug

**Decision: do not fix the `FoundationConsultationHistory.gs` header comment bug during
PA-5. Leave it as documented technical debt unless implementation genuinely requires
touching that file.**

Batch PA-5 does not touch `FoundationConsultationHistory.gs` at all — it has no
dependency on Consultation History, so this exception was never triggered. The bug (not
otherwise re-described here, per this decision's own instruction to leave it untouched)
remains open, tracked as non-blocking technical debt in this batch's closeout summary,
exactly as instructed.

---

# 8. Validation Rules — summary

Both patient-facing input fields (`file_name`, `mime_type`, `file_base64`) are validated
before any byte is decoded (extension/declared-type/base64-shape); size and real content
type are validated only after decoding, against the real bytes. A `patient_id` and
`uploaded_by` are always session-derived for the patient route — never client-supplied
— mirroring `log_symptom`'s own authorization primitive (docs/41 §12), applied here to
the platform's highest-risk feature.

# 9. Accessibility

The upload form reuses `login.html`'s/the Symptom Tracker's `.field`/`label for`
pattern unchanged — a single `<input type="file">` with a real, associated label, no new
CSS needed (`.field input` already covers it). Submission feedback reuses the existing
`.status`/`role="status"`/`aria-live="polite"` component. The Reports full-history
page's per-entry "Download" action is a real `<button>`, not a bare link to a Drive URL
— consistent with #3's authorization model, and keyboard-operable by default.

# 10. Component Reuse

`assets/site.css`: zero new rules — `.field`/`.status`/`.submit`/`.secondary`/`.card`
and PA-3's `.tl-track`/`.tl-item` visual are all reused unchanged. The Reports page adds
two small, page-local rules (`.rp-meta`, `.rp-actions`) for the one piece of markup
(filename + type/size + a Download action) that doesn't fit Timeline's or Symptom
History's existing per-entry shape exactly — the same "freshly implemented per-page,
not a shared file" convention this repo already follows for `.tl-track`/`.tl-item`
itself.

# 11. Recommended Implementation Sequence

1. `shared/constants/upload-limits.json`/`.md` and `shared/schemas/report.schema.json`/
   `.md` (the bootstrap exception).
2. `apps-script/FoundationReports.gs` (create/list/download/staff-wrapper functions).
3. `apps-script/FoundationRouter.gs`'s three new, additive dispatch cases.
4. `validation/phase-2a-foundation/harness.js`/`conformance.js` (DriveApp mock, Stage 9).
5. `my-health-journey/dashboard.js`'s Reports card wiring.
6. `my-health-journey/reports/` (full history page).
7. `validation/pa-2-dashboard/browser-test.js` update + `validation/pa-5-reports/`
   (new suite).
8. Documentation and CHANGELOG.

---

# Validation Run at Time of This Review

Not applicable in the same sense as docs/41's — this review and Batch PA-5's
implementation were approved and built together in this session (see this document's
own header note). The real validation run against the actual implementation is recorded
in `docs/29-PHASE-2A-TECHNICAL-PLAN.md` §16's Batch PA-5 notes and this batch's Build
Summary, not here.
