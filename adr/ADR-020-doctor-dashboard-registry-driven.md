# ADR-020: Doctor-Facing Capabilities Are Registry-Driven, Mirroring the Patient Dashboard

## Status
Accepted. Extends the registry-driven principle ADR-012 established for the patient
dashboard to the doctor-facing side; does not amend ADR-012 itself — a new, parallel
registry, not a widening of the existing one.

## Context
ADR-012 (amended twice) committed the entire patient "My Health Journey" dashboard to
being registry-driven: every card a patient sees corresponds to a Module Registry entry
they are enabled for, with no hardcoded per-module rendering logic in `dashboard.js`
(proven in practice at Batch PXP-4, docs/24's Phase 2B entry). No equivalent commitment
exists for doctor-facing surfaces, because no real, authenticated doctor-facing surface
has existed at all — every doctor-owned Phase 2B entity has been configured through a
manually-run Apps Script editor function, not a dashboard (docs/33 §6.2/§6.5/§3.4).
Once Doctor Identity (ADR-017) makes a real, authenticated Doctor Dashboard possible,
building it as a second, independently-invented rendering architecture would repeat the
exact mistake ADR-012 was written to prevent on the patient side — hardcoded,
per-capability pages that must each be individually touched to add, reorder, or retire
a capability.

## Decision
The Doctor Dashboard is driven by a new **Doctor Module Registry** — structurally
parallel to the existing Module Registry (ADR-012), but a separate registry, not a
shared one, since patient-facing and doctor-facing capabilities are exposed to
different identity types (Patient Identity vs. Doctor Identity, ADR-017) and must never
be conflated. Every doctor-facing capability (patient roster, condition assignment
tool, care-plan authoring, module/calculator/template enablement, inventory view,
analytics view) is a Doctor Module Registry entry; no doctor-facing page hardcodes
knowledge of a specific capability, mirroring `dashboard.js`'s own post-PXP-4
`renderDashboard()` discipline exactly.

The Doctor Module Registry reuses every applicable rule already proven for the Module
Registry: fail-closed enablement (absence of an enabled row means the capability does
not render, ADR-010's security-over-convenience principle applied identically), no
hardcoded disease- or specialty-specific branches (docs/47 §3, extended by ADR-018's
`specialty_scope` field, §Pillar 3 of docs/49), and an inert, reserved AI-compatibility
field (ADR-019).

This ADR does not:
- Design the Doctor Module Registry's exact schema (a docs/50 technical-plan decision,
  mirroring how ADR-012 stated the principle and docs/29/docs/44 carried the field-level
  design).
- Retire any existing manually-run editor function — each is retired individually, by
  its own future batch, once the Doctor Dashboard's equivalent capability ships,
  mirroring Batch PXP-10's own retirement discipline for Symptom Tracker.
- Merge with, or share storage with, the existing patient-facing Module Registry.

## Consequences
- Adding a new doctor-facing capability later is a new registry entry, never a new
  hardcoded page or a new `if`/`switch` branch — the same guarantee ADR-012 gives the
  patient dashboard, now given to the doctor side too.
- Two registries now exist for two different identity types, doing structurally the
  same job — a small, deliberate duplication accepted for the same reason Patient
  Identity and Doctor Identity are not merged (ADR-017): the two audiences' capabilities
  are genuinely different, and conflating them would eventually force one registry to
  carry an identity-type branch, the exact kind of hardcoded conditional this whole
  registry-driven approach exists to avoid.
- Every doctor-owned Phase 2B entity's real, authenticated write path (once Doctor
  Identity exists) is exposed through this registry, not through a bespoke doctor-side
  page per entity.

## Future Considerations
If, over time, patient-facing and doctor-facing registries prove to need identical
mechanics closely enough that maintaining two becomes a genuine duplication cost (not a
hypothetical one), unifying them behind a single identity-type-agnostic registry
mechanism would itself require a new ADR explicitly superseding this one and ADR-012 —
never a silent merge. Not anticipated as necessary now.
