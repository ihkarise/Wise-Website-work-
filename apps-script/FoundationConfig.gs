/**
 * Central configuration for Phase 2A's Foundation layer.
 *
 * Foundation lives inside this same Apps Script project — the one already
 * hosting Phase 1.5's consultation-summary pipeline — per docs/29 §14's
 * Decision 1. This file is the Foundation-layer equivalent of Config.gs:
 * the only file that should change between test and production for
 * anything Foundation owns. It must never be read by, or modify, anything
 * Phase 1.5's Config.gs, Sheets.gs, or any other existing module owns.
 *
 * No logic lives here yet (Foundation batch F1 is scaffolding only, per
 * the approved Foundation plan) — just placeholders and property-name
 * declarations. See shared/README.md for the canonical, machine-readable
 * definitions this project's Foundation modules will conform to from F2
 * onward.
 */

var FOUNDATION_CONFIG = {
  // Placeholder — replace with the real, provisioned Patients spreadsheet
  // ID (test tier first, per docs/29 §7/§10's environment-separation
  // rule). Never the Phase1.5_ConsultationSummaries spreadsheet ID —
  // Patient data stays in its own spreadsheet, separate from Phase 1.5's,
  // even though the code now shares one Apps Script project.
  PATIENT_SPREADSHEET_ID: 'REPLACE_WITH_PATIENT_SPREADSHEET_ID',

  SCHEMA_VERSION: 1,

  // Script Properties key names Foundation modules will read via
  // PropertiesService (from F4 onward). The values themselves are never
  // stored here or anywhere in this repo — set them in the Apps Script
  // editor's Project Settings > Script Properties, same treatment as
  // Phase 1.5's STAFF_ACCESS_CODE/OPENROUTER_API_KEY. Prefixed
  // FOUNDATION_ to stay visually distinct in a Script Properties list this
  // project now shares with Phase 1.5's own keys.
  SCRIPT_PROPERTY_KEYS: {
    SESSION_SIGNING_SECRET: 'FOUNDATION_SESSION_SIGNING_SECRET'
  }
};
