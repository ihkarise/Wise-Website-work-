# Report

Explains `report.schema.json` (version `1.0.0`, the authoritative definition — this file
explains, it does not define, per `shared/README.md`'s format rule).

## Scope: Batch PA-5 (docs/29 §13 Batch 5F)

This contract, and `apps-script/FoundationReports.gs`'s implementation of it, back the
platform's highest-risk Phase 2A feature (docs/29 §8/§11) — the first arbitrary
file-handling surface. Metadata only: the binary content lives in Google Drive, keyed by
`drive_file_id`.

## Lifecycle: create → persist → read. No update. No delete.

Per the approved architecture decisions: a Report's metadata becomes immutable
immediately after upload (no edit operation) and there is no delete operation in this
phase (deletion is explicitly out of Phase 2A/Batch PA-5 scope). This mirrors
`symptom-log.schema.json`'s own create-only lifecycle discipline, applied here for a
different reason — this is a document of record (a lab result, a prior prescription),
not a mutable journal entry.

## Authorization: the application is the boundary, Drive is defense-in-depth only

Per the approved architecture decision, authorization always begins with the
application, never with Drive's own sharing permissions:

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
- The Drive file itself is never shared ("anyone with the link" or otherwise, docs/29
  §8) — its default, script-owner-only Drive permission is a second, independent layer
  in case the application-layer check is ever bypassed by some other path, not the
  mechanism a legitimate request relies on. `download_report` never returns a Drive URL
  to the browser; it fetches the file's bytes server-side (inside the already-authorized
  Apps Script execution) and returns them base64-encoded in the response envelope, so
  the patient's browser never needs, and is never given, any Drive-level access of its
  own.

## `mime_type` and the disclosed content-validation limitation

See `shared/constants/upload-limits.md` for the full three-layer validation discipline
(extension, client-declared MIME, server-side content sniffing) and its explicitly
disclosed limitation: `Utilities.newBlob()`'s byte-signature detection is a heuristic,
not a parser or a malware scanner. `report.schema.json`'s `mime_type` field always stores
the *server-detected* value, never the client-declared one — the two can legitimately
differ if a client mislabels a real, otherwise-valid file (e.g. a PDF sent with the
generic `application/octet-stream` MIME type), which this schema treats as
authoritative-by-content, not authoritative-by-claim.

## `file_name` — display only, never a path component

The original filename a patient sees on the full history page — HTML-escaped wherever
rendered, exactly like `notes`/`source_ref` elsewhere in this platform. Never used to
name the actual Drive object or to construct any path; the stored Drive file is named
deterministically from `patient_id`/`record_id` instead (docs/29 §8), so a filename
containing unusual characters, a very long name, or an attempted path-traversal string
can never affect where or how the file is actually stored.

## `uploaded_by` — patient self-upload, or a disclosed staff exception

The normal path (the patient-facing Web App route) always sets this to the
session-derived `patient_id` — the uploader is definitionally the same patient the
report belongs to. Per the approved architecture decision, **no staff Web App upload
route exists.** The only staff-attributed path is
`createFoundationReportForExistingDriveFile()`, a manually-run Apps Script editor
wrapper (same category as `createFoundationConsultationEntry()`/
`createFoundationPatient()`) for the rare case a staff member needs to attach a document
to a patient's record on their behalf; running it sets `uploaded_by` to a staff
identifier string instead of a `patient_id`.

## Ordering

Full-history display order is `uploaded_at` descending — a single sort key, the same
scheme `symptom-log.schema.json` already uses.

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `record_id` | Yes | No — permanent identity |
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
