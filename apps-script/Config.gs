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
  }
};
