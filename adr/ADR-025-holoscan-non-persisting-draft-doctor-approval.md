# ADR-025: Holoscan Recognition Output Is Always a Non-Persisting Draft Requiring Doctor Approval Through Medication History's Own Existing Write Path

## Status
Accepted. Extends ADR-004/ADR-005 (AI supervision) and ADR-022 (AI Assistant's
non-persisting-draft precedent) for Holoscan (WPI-11) specifically; amends none of them.

## Context
ADR-022 established, for AI Assistant (WPI-10), that AI-generated output never gains a
write path into any clinical entity — every draft is held only in its own audit row
until a doctor separately invokes the target entity's own existing write path. Holoscan
(docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md) raises the identical question in a new
shape: once a doctor reviews a `HoloscanRecognitionItem` and approves (or corrects and
approves) it, does the recognition pipeline itself get to create the corresponding
`MedicationHistory` row, or must the doctor take a separate, deliberate action on
`MedicationHistory`'s own authoring path? Left undecided, a future implementation could
wire "approve" directly to a `MedicationHistory` write as a convenience, which would
erode the exact doctor-supervision boundary ADR-022 was written to protect — the same
"well-meaning insights widget that starts suggesting next steps" failure mode ADR-004's
Context section names, recurring here because Holoscan is patient-initiated rather than
doctor-initiated and could otherwise feel more "automatic" than AI Assistant by default.
A second, related question is new to Holoscan: what happens to a medicine over time,
after it has already entered `MedicationHistory`? The patient's brief for this freeze
names an explicit, ongoing doctor action set (Continue / Stop / Replace / Unknown) that
ADR-022 never had to address, since AI Assistant produces no entity with its own
multi-visit lifecycle.

## Decision
Holoscan never writes to `MedicationHistory`, `MedicationDecision`, or any other
Sheet-backed entity, beyond its own `HoloscanRecognition`/`HoloscanRecognitionItem` rows
(docs/56 §11). Recording a doctor's decision on a `HoloscanRecognitionItem` — approve,
corrected-and-approve, or reject — persists that decision only; it never itself creates
a `MedicationHistory` row. If the doctor wants an approved recognition to become a
permanent medication-history entry, the doctor must separately invoke
`MedicationHistory`'s own existing, already-authenticated write path
(`create_medication_history_entry`, docs/56 §17), using the approved draft's fields as
pre-fill only — exactly the same two-step discipline ADR-022 established for AI
Assistant, applied here to a patient-initiated capture instead of a doctor-initiated
query. Holoscan gains **zero** write authority over `MedicationHistory`, ever, under this
ADR.

This same non-automatic principle governs `MedicationHistory`'s own ongoing lifecycle,
independent of Holoscan: every Continue/Stop/Replace/Unknown action is a doctor-authored
`MedicationDecision` row (docs/56 §11), append-only, never inferred, defaulted, or
auto-applied by any code path — including Holoscan's own pipeline, which has no
awareness of, or effect on, `MedicationDecision` at all beyond being the origin of the
`MedicationHistory` row a later decision may reference.

This ADR does not:
- Prohibit a future, separately-approved UX refinement that pre-fills
  `MedicationHistory`'s own authoring form with an approved draft's text, provided the
  doctor's own existing save action remains the only thing that actually persists data —
  the identical carve-out ADR-022 already grants for AI Assistant.
- Change what ADR-004/ADR-005/ADR-022 require of any other AI feature.

## Consequences
- Every approved Holoscan recognition costs the doctor one additional, deliberate save
  action to actually enter it into `MedicationHistory` — the same accepted friction
  ADR-022 already named for AI Assistant, now extended to a second feature.
- `HoloscanRecognitionItem` and `MedicationHistory` remain two structurally distinct
  entities with two distinct write paths, even though one commonly follows the other —
  the audit trail stays honest: a `MedicationHistory.source_recognition_item_id`
  reference records provenance without implying automatic creation.
- The static-analysis rule docs/55 §18 item 1 required for AI Assistant is required
  again here, in the same shape, for Holoscan (docs/56 §23 item 1) — this ADR's
  guarantee must be a code-level fact, not merely a documented intention.

## Future Considerations
If this friction proves too costly in real doctor usage, a future, separately-approved
ADR may consider a tighter integration (e.g., a one-click "add to Medication History"
action still gated on an explicit doctor click) — mirroring ADR-022's own identical
Future Considerations exactly. This ADR does not pre-approve or schedule that change.
