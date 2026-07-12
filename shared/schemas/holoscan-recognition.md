# HoloscanRecognition

Explains `holoscan-recognition.schema.json` (version `1.0.0`, the authoritative
definition — this file explains, it does not define, per `shared/README.md`'s format
rule).

## Scope: Batch WPI-11 (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md §11.1, ADR-024/025/026)

One row per patient-initiated Holoscan photo submission — the parent capture session
for zero or more `HoloscanRecognitionItem` candidate rows
(`holoscan-recognition-item.schema.json`). Patient-owned at creation (the upload act),
system-owned thereafter (pipeline-driven status transitions only, `apps-script/
HoloscanRecognition.gs`) — the patient never edits or deletes a recognition once
submitted, the same "logged, never edited" discipline Symptom Log already established
(docs/33 §3.2).

## Lifecycle

`uploaded` → `processing` → `completed` | `failed`, one-way, mirroring
`Appointment`/`DoctorInstruction`'s existing transition discipline. `processed_at` is
server-set the moment `status` leaves `processing`; `error_log` is populated only on
`status: 'failed'`.

## Image storage — reuses Report's Drive pattern unmodified

`image_refs` reuses `Report.gs`'s own file-metadata shape (`drive_file_id`, `mime_type`,
`size_bytes` per uploaded image) — Holoscan introduces no new file-handling code path,
only a new caller of the existing one (docs/29 §8/§11, Batch PA-5). The same
content-based MIME detection, size ceiling, and private-Drive-sharing enforcement
`FoundationReports.gs` already established govern every Holoscan image upload.

## Security

`patient_id` is always `PatientSession`-derived, never client-supplied, on
`submit_holoscan_recognition`. Doctor read access is roster-scoped only (a doctor may
read a `HoloscanRecognition` only for a patient present in that doctor's own derived
roster, reusing `DoctorPatientRoster.gs` unmodified — never a new derivation).

## Fields at a glance

| Field | Set at creation? | Mutable? |
|---|---|---|
| `recognition_id` | Yes (server-generated UUID) | No |
| `patient_id` | Yes (session-derived) | No |
| `image_refs` | Yes | No |
| `status` | Yes (`'uploaded'`) | One-way transition only |
| `model` | No (`''` until the pipeline calls the model) | Set once, at pipeline run |
| `prompt_template_version` | No (`''` until the pipeline calls the model) | Set once, at pipeline run |
| `submitted_at` | Yes (server-set) | No |
| `processed_at` | No (`''` sentinel) | Set once, when status leaves `processing` |
| `error_log` | No (`''` sentinel) | Set only on `status: 'failed'` |

## Versioning

Version `1.0.0`. Any field addition, removal, or type change requires a new version
here first, then a subsequent update to `apps-script/HoloscanRecognition.gs` — never
the reverse, per `shared/README.md`.
