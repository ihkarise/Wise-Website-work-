# Report

Explains `report.schema.json` (version `1.0.0`, the authoritative definition — this file
explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch PA-5 (docs/29 §13 Batch 5F)

This contract, and `apps-script/FoundationReports.gs`'s implementation of it, back the
platform's highest-risk Phase 2A feature (docs/29 §8/§11) — the first arbitrary
file-handling surface. Metadata only: the binary content lives in Google Drive, keyed by
`drive_file_id`. Preceded by `docs/42-REPORTS-UPLOAD-READINESS-REVIEW.md`, which
resolved this schema's four open questions (§11 there) before it was written.

## Lifecycle: create → persist → read. No update. No delete.

Per the approved architecture decisions (docs/42 §1/§11 Q2/Q3): a Report's metadata
becomes immutable immediately after upload (no edit operation) and there is no delete
operation in this phase (deletion is explicitly out of Phase 2A/Batch PA-5 scope). This
mirrors `symptom-log.schema.json`'s own create-only lifecycle discipline, applied here
for a different reason — this is a document of record (a lab result, a prior
prescription), not a mutable journal entry.

## Authorization: the application is the boundary, Drive is defense-in-depth only

Per the approved architecture decision and docs/42 §6 ("the single most important
property to design for and test explicitly in this batch"), authorization always
begins with the application, never with Drive's own sharing permissions:

- Every list (`get_reports`) and download (`download_report`) call re-derives
  `patient_id` from the verified session (ADR-002) exactly like every other Foundation
  route, and — for `download_report`, which additionally takes a client-supplied
  `record_id` — independently verifies the fetched row's own `patient_id` matches the
  session-derived one before ever calling `DriveApp.getFileById()`, the same
  "unguessability is not itself an authorization boundary" discipline
  `foundationGetConsultationEntryById_()` already established
  (docs/40-CONSULTATION-IDENTITY-STRATEGY.md Q3). An unknown `record_id` and a
  `record_id` belonging to a different patient return the identical
  `FOUNDATION_NOT_FOUND` envelope.
- **The Drive file itself is a second, independent access-control boundary beyond the
  Sheets row** (docs/42 §6) — not merely left at an assumed default. Every file this
  application creates has its sharing explicitly set to private/no-access
  (`foundationEnsureReportFilePrivate_()`, called immediately after
  `DriveApp.createFile()`), never "anyone with the link" or otherwise. This is an
  enforced, verified property (`validation/phase-2a-foundation/conformance.js` Stage 9
  asserts the created file's sharing access directly), not an unverified assumption
  about Apps Script's own default behavior — docs/42 §6's own words: "a default is not
  the same as a verified guarantee."
- `download_report` never returns a Drive URL to the browser; the server fetches bytes
  inside its own already-authorized execution and returns them base64-encoded, so a
  patient's browser is never given any Drive-level access of its own — verifying that a
  bypassed or misconfigured Drive permission still could not leak a file without the
  application's own check first passing.

## Google Drive integration: one file, one folder, record_id-named objects

Per docs/42 §5's recommendations, resolved by explicit approval:

- **Folder structure:** one fixed, private Drive folder — never patient-partitioned by
  subfolder. Access control is enforced at the application layer (above), not by Drive
  folder boundaries, so a per-patient folder scheme would add real complexity for no
  security benefit at pilot scale.
- **File naming:** the Drive object is named using the generated `record_id` alone
  (plus an extension derived from the validated content type) — **never the
  patient-supplied filename, and never `patient_id`.** The original filename is stored
  only as the `file_name` metadata column, shown to the patient but never used to
  address the file itself (the same "identity vs. display" separation docs/40 already
  established for `record_id` vs. `entry_date`). `patient_id` is deliberately excluded
  from the object name too — docs/42 §5's own reasoning against a per-patient-subfolder
  scheme ("another place patient_id could leak into a name") applies equally to naming
  a single flat file after it.
- **Partial-write failure (Drive succeeds, Sheets fails):** the platform's first entity
  whose lifecycle spans two independent storage systems, per docs/42 §1's own framing.
  `foundationCreateReport_()` writes Drive first, then Sheets, and if the Sheets write
  then fails, **rolls back by trashing the just-created Drive file**
  (`DriveApp.File.setTrashed(true)`) before returning the standard generic error
  envelope — preferring rollback over leaving an orphaned file, per the approved
  decision. If the rollback attempt itself fails (a genuinely rare double-failure), the
  file is left in place as an accepted, explicitly audit-logged orphan
  (`report_upload_orphaned_file`, distinguishable from a normal
  `report_upload_rolled_back` event) rather than silently disappearing from view —
  documented and tested (`validation/phase-2a-foundation/conformance.js` Stage 9), not
  assumed away.

## `mime_type` and the disclosed content-validation limitation

See `shared/constants/upload-limits.md` for the full three-layer validation discipline
(extension, client-declared MIME, server-side content sniffing) and its explicitly
disclosed limitation, including the specific open item docs/42 §11 raised (the exact
behavior of `Utilities.newBlob()`'s content detection has not been verified against a
live Apps Script deployment — this repository's own conformance mock approximates it).
`report.schema.json`'s `mime_type` field always stores the *server-detected* value,
never the client-declared one — the two can legitimately differ if a client mislabels a
real, otherwise-valid file (e.g. a PDF sent with the generic `application/octet-stream`
MIME type), which this schema treats as authoritative-by-content, not
authoritative-by-claim.

## `file_name` — display only, never a path component

The original filename a patient sees on the full history page — HTML-escaped wherever
rendered, exactly like `notes`/`source_ref` elsewhere in this platform. Never used to
name the actual Drive object or to construct any path; the stored Drive file is named
deterministically from `record_id` alone (above), so a filename containing unusual
characters, a very long name, or an attempted path-traversal string can never affect
where or how the file is actually stored.

## `uploaded_by` — patient self-upload, or a disclosed staff exception

The normal path (the patient-facing Web App route) always sets this to the
session-derived `patient_id` — the uploader is definitionally the same patient the
report belongs to. Per the approved architecture decision and docs/42 §7's own
recommendation, **no staff Web App upload route exists.** The only staff-attributed
path is `createFoundationReportForExistingDriveFile()`, a manually-run Apps Script
editor wrapper (same category as `createFoundationConsultationEntry()`/
`createFoundationPatient()`) for the rare case a staff member needs to attach a document
to a patient's record on their behalf; running it sets `uploaded_by` to a staff
identifier string instead of a `patient_id`. It reuses an already-existing Drive file in
place — the sharing-privacy enforcement above applies only to files this application
itself creates via the patient upload path, not to a file staff placed in Drive by some
other means, which remains staff's own placement responsibility (this file's own header
comment documents that boundary explicitly).

## Ordering

Full-history display order is `uploaded_at` descending — a single sort key, the same
scheme `symptom-log.schema.json` already uses.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `record_id` | Yes | No — permanent identity, also the Drive object's own name |
| `patient_id` | Yes (session-derived) | No |
| `uploaded_at` | Yes (server-set to "now") | No |
| `file_name` | Yes (client-supplied, display only) | No |
| `drive_file_id` | Yes (server-assigned) | No |
| `mime_type` | Yes (server-detected from content) | No |
| `size_bytes` | Yes (server-measured from decoded bytes) | No |
| `uploaded_by` | Yes (session-derived patient_id, or a staff identifier) | No |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change — including ever adding an
update/delete endpoint — requires a new version here first, then a subsequent update to
`apps-script/FoundationReports.gs` — never the reverse, per `shared/README.md`.
