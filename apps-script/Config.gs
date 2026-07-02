/**
 * Central configuration for the Phase 1.5 consultation-summary pipeline.
 * Only this file should change when moving between test and production
 * Sheets — no other module should hardcode a Sheet name, slug list, or limit.
 */

var CONFIG = {
  SHEET_NAME: 'Phase1.5_ConsultationSummaries',
  SCHEMA_VERSION: 1,

  // Canonical condition slugs already live on /conditions/ (docs/20 §5:
  // "the slug is the ID"). Keep this list in sync with the public site.
  ALLOWED_CONDITION_SLUGS: [
    'mcas',
    'hashimotos-thyroiditis',
    'chronic-urticaria',
    'eczema',
    'allergic-rhinitis',
    'eosinophilic-esophagitis',
    'pots',
    'dermographism'
  ],

  LIMITS: {
    STAFF_NOTE_MAX_LENGTH: 2000,
    STAFF_ID_MAX_LENGTH: 200,
    EMAIL_MAX_LENGTH: 254
  },

  // AI summarization (docs/25 §6, §9.4 — model choice is locked, not
  // swapped mid-pilot). Key comes from Script Properties, never from here.
  AI: {
    OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    MODEL: 'anthropic/claude-haiku-4.5',
    TEMPERATURE: 0,
    MAX_OUTPUT_TOKENS: 400,
    // Below this per-sentence word-overlap ratio with the source note, a
    // summary sentence is flagged as low-traceability for doctor review
    // (docs/25 §6: "flags any output that introduces content not
    // traceable to the source note"). Heuristic, not a hard block — see
    // Ai.gs.
    SENTENCE_TRACEABILITY_MIN_OVERLAP: 0.3
  }
};
