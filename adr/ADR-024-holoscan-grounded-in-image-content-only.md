# ADR-024: Holoscan Recognition Is Grounded Only in Uploaded Image Content, Never External Medical Inference, Diagnosis, or Treatment Recommendation

## Status
Accepted. Extends ADR-001 (Knowledge Engine primary source) and ADR-004 (Digital Twin
never diagnoses or treats) for Holoscan (WPI-11) specifically; amends neither.

## Context
docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md designs Holoscan as a patient-facing
medication-photo recognition pipeline: a patient uploads one or more photographs of
medicines they are currently taking, and a vision-capable model extracts whatever text
is visible on the packaging (name, strength, dosage form, manufacturer, batch, expiry).
This is the platform's first AI feature whose input is an image rather than text, and
its first patient-initiated (not doctor-initiated) AI capability. Two risks are specific
to this shape, neither fully covered by ADR-001/004/005/013 as written for text-based
features: (1) a vision model asked to "identify this medicine" could plausibly volunteer
what the medicine is *for*, a dosage opinion, or a side-effect summary — clinical content
no numbered prompt rule elsewhere on the platform was written to anticipate; (2) no
structured Medicine Catalog or drug-reference entity exists anywhere on the platform
today (`InventoryItem`, docs/33 §7.4, is this clinic's own homeopathic stock, not a
general medicine dictionary) — the same "Knowledge Engine does not exist yet" gap
ADR-021 named for AI Assistant recurs here in a new shape and must be disclosed, not
silently worked around by inventing a fake catalog as a side effect of this freeze.

## Decision
Holoscan's recognition pipeline extracts and reports only what is literally visible in
the uploaded image(s) — a name, strength, dosage form, manufacturer, batch, and expiry
date, each independently nullable if not legible or not present — and nothing else.
The pipeline's prompt-level constraints (mirroring `Ai.gs`'s and AI Assistant's
`SUMMARY_SYSTEM_PROMPT_`-style numbered-rule convention, docs/55 §7.2) forbid, at
minimum: any statement of what a recognized medicine treats, any dosage or
administration instruction beyond what is printed on the packaging itself, any
drug-interaction claim, and any diagnosis, prognosis, or treatment recommendation of any
kind. `HoloscanRecognitionItem.confidence_score` reflects only the model's confidence in
its own text extraction — never a clinical judgment. Because no structured Medicine
Catalog exists, the pipeline's catalog-matching step (docs/56 §8) is deliberately
best-effort and reserved: `catalog_match_status`/`catalog_match_ref` are defined fields
on `HoloscanRecognitionItem` but are not backed by any real reference data in this
freeze — exactly the same disclosed-gap treatment ADR-021 gave the Knowledge Engine,
applied here to a Medicine Catalog instead. A doctor's own clinical judgment, exercised
during mandatory review (ADR-025), remains the only source of any medical meaning
attached to a recognized medicine.

This ADR does not:
- Build a real Medicine Catalog, or commit to a timeline for one.
- Permit Holoscan to answer any question beyond "what does this packaging say."
- Change what ADR-001/004/005/013 already require of any other AI feature.

## Consequences
- Holoscan cannot tell a patient or doctor what a recognized medicine is used for,
  whether it is safe, or how it interacts with anything else — only what its own
  packaging visibly states, mirroring ADR-021's "only what the patient's own record
  says" restraint, applied to image content instead of stored records.
- `HoloscanRecognitionItem`'s extracted fields are individually nullable by design —
  an honest reflection of what a photograph can and cannot legibly contain, never
  guessed or filled in to look more complete than the source image supports.
- A future "interaction checker" (docs/56 §12) or a real Medicine Catalog both require
  their own future, separately-approved ADRs extending this one — never a silent
  broadening of Holoscan's extraction scope.

## Future Considerations
Once a real Medicine Catalog exists (a future, separately-scoped system, the same
category of future work ADR-021's own Future Considerations names for a real Knowledge
Engine), a future ADR may extend Holoscan's matching step to use it. This ADR's
image-content-only boundary is Holoscan's starting scope, not a permanent ceiling.
