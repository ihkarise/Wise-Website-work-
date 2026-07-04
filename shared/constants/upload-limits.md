# Report Upload Limits

Explains `upload-limits.json` (version `1.0.0`, the authoritative definition — this file
explains, it does not define, per `shared/README.md`'s format rule).

## Why this file exists

Batch PA-5 (Report Upload, docs/29 §8/§13 Batch 5F) is the platform's first
arbitrary-file-handling feature. Its approved architecture decisions require the
5&nbsp;MB size cap to be "stored as a shared constant," not hardcoded per file — this is
that constant's one canonical home, per the same `shared/` discipline
`condition-slugs.json` already established for a cross-cutting value with more than one
consumer.

## `max_upload_bytes` — 5 MB (5,242,880 bytes)

The maximum size of a single uploaded report, enforced **server-side, on the real
decoded byte length** — `apps-script/FoundationReports.gs` never trusts a
client-reported size. Any client-side check against this same number (the upload
form's own pre-flight size check) is a UX convenience only, exactly like docs/29 §8's
"client-side limits are UX only, never trusted."

## `allowed_file_types` — PDF, JPG, JPEG, PNG

The only file types Report Upload accepts, per docs/29 §8's "PDF/JPG/PNG only." Each
entry pairs a canonical MIME type with the filename extension(s) conventionally used for
it. Three independent, defense-in-depth checks are all layered against this same list
(none alone is sufficient):

1. **Filename extension** — the weakest signal, trivially spoofed by renaming any file.
   Checked, but never relied on alone (the approved architecture decision explicitly
   forbids this).
2. **Client-declared MIME type** (the browser's own `File.type`, sent by the upload
   form) — also spoofable by any client capable of crafting its own HTTP request; useful
   for UX (an immediate "unsupported file type" message) but not trusted as the
   authorization-grade check.
3. **Server-side content-based detection** — the real check. `apps-script/FoundationReports.gs`
   decodes the uploaded bytes and asks Apps Script's `Utilities.newBlob(bytes)` to infer
   the content type from the byte structure itself (documented Apps Script behavior:
   `newBlob(data)` "attempts to determine the correct extension and content-type of the
   data based on the structure of the byte array"). This is the only one of the three
   checks that inspects the file's actual bytes rather than caller-supplied metadata.

## An explicitly disclosed limitation — not silently implied as stronger than it is

Content-based detection via `Utilities.newBlob()` is a **heuristic based on recognizing
common file-format byte signatures** (e.g. a PDF's `%PDF` header, a PNG's fixed magic
bytes) — it is not a parser that validates a file's full internal structure, and it is
not a virus/malware scanner. A file that is byte-for-byte a valid PDF/JPG/PNG but
carries a malicious embedded payload (a polyglot file, a PDF with embedded JavaScript,
an image with appended data) can still pass this check. No malware/virus scanning
capability exists anywhere in this stack — the same accepted, openly-stated limitation
docs/29 §8 already names, mitigated the same way: type/size restriction plus doctor
review before any file is opened by staff, not a technical guarantee of file safety.
This file, and `apps-script/FoundationReports.gs`'s implementation of it, do not claim
otherwise.

## Who implements this

`apps-script/FoundationReports.gs` manually adapts both values into its own
`FOUNDATION_REPORT_MAX_UPLOAD_BYTES_`, `FOUNDATION_ALLOWED_REPORT_MIME_TYPES_`, and
`FOUNDATION_ALLOWED_REPORT_EXTENSIONS_` constants — the same "port a `shared/`
definition into a `Foundation`-prefixed file" convention `FoundationSymptomLog.gs`'s
`FOUNDATION_ALLOWED_CONDITION_SLUGS_` already uses. `my-health-journey/dashboard.js` and
`my-health-journey/reports/reports.js` separately port the same two values for their own
client-side, UX-only pre-checks (an immediate "file too large"/"unsupported type"
message before ever calling the server) — update all three by hand if this file's
values ever change, per `shared/README.md`'s rule.

## Versioning

Version `1.0.0`. Changing the size cap or the allowed-type list requires a new version
here first, then updating every conforming implementation afterward — never the
reverse, per `shared/README.md`.
