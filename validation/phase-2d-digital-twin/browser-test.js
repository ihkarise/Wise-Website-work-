/**
 * Browser-driven verification for Batch PXP-12 — Wise Digital Twin & AI Summaries (Phase 2D,
 * docs/59-PHASE-2D-DIGITAL-TWIN-ARCHITECTURE-FREEZE.md §16). Mirrors
 * validation/phase-2c-milestones/browser-test.js's discipline exactly: a local static server +
 * headless Chromium (Playwright), the backend mocked at the network layer, external fonts
 * blocked for speed/determinism.
 *
 * Per docs/59 §16, this suite's highest-priority checks are: the Health Story (patient) card and
 * the Digital Twin Review (doctor) card each do not render at all when their registry entry or
 * module state is disabled (fail-closed); the patient page shows only approved published_output
 * and the honest empty state (NEVER a pending/rejected draft, never the raw ai_output, never a
 * write control); and the doctor card's draft banner ("AI-generated draft — not yet visible to
 * the patient") precedes any Approve/Edit/Reject control, with Approve naming patient visibility
 * as what it unlocks.
 *
 * No apps-script/*.gs file is exercised by this suite — the backend pipeline (roster-scoping, the
 * doctor-approval gate, approved-only patient visibility, the drift check) is
 * validation/phase-2a-foundation/conformance.js's Stage 29, added in this same batch.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/phase-2d-digital-twin/browser-test.js
 */

const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };

let passCount = 0;
let failCount = 0;
function check(label, condition) {
  if (condition) { passCount++; console.log('PASS —', label); }
  else { failCount++; console.log('FAIL —', label); }
}

function startServer() {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const filePath = path.join(ROOT, urlPath);
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => { server.listen(0, '127.0.0.1', () => resolve(server)); });
}

const FAKE_DOCTOR_TOKEN = 'fake-doctor-session-token-for-pxp12-tests';
const FAKE_PATIENT_TOKEN = 'fake-patient-session-token-for-pxp12-tests';

const DOCTOR_PROFILE_ENVELOPE = { status: 'ok', data: { doctor_id: 'd1', full_name: 'Dr. Asha Rao', role: 'physician', email: 'asha@example.com', specialty_slug: 'homeopathy', status: 'active' } };
const PATIENT_PROFILE_ENVELOPE = { status: 'ok', data: { patient_id: 'p1', full_name: 'Patient One', email: 'p1@example.com', condition_slug: 'mcas', status: 'active' } };

function doctorStateRow(capabilityKey, enabled) {
  return { state_key: 'd1::' + capabilityKey, doctor_id: 'd1', capability_key: capabilityKey, enabled: enabled, enabled_by: enabled ? 'staff-1' : '', enabled_at: enabled ? '2026-07-16T00:00:00.000Z' : '' };
}
function patientStateRow(moduleId, enabled) {
  return { state_key: 'p1::' + moduleId, patient_id: 'p1', module_id: moduleId, enabled: enabled, enabled_by: enabled ? 'staff-1' : '', enabled_at: enabled ? '2026-07-16T00:00:00.000Z' : '' };
}

const ROSTER_FIXTURE = [{ patient_id: 'p1', full_name: 'Patient One', condition_slugs: ['mcas'] }];

const DIGITAL_TWIN_VIEW = { patient_id: 'p1', generated_at: '2026-07-16T00:00:00.000Z', care_plan_present: true, care_plan_status: 'active', check_in_count: 3, calculator_result_count: 1, symptom_log_count: 2, medication_active_count: 1, medication_total_count: 1, milestones_total: 4, milestones_celebrated: 1 };
const PROGRESS_ANALYTICS = { patient_id: 'p1', generated_at: '2026-07-16T00:00:00.000Z', check_in_engagement: { total_check_ins: 3 }, symptom_trend: { total_logs: 2, average_severity: 3.5 }, calculator_engagement: { total_results: 1, results_by_calculator_slug: {} }, milestone_progress: { total: 4, celebrated: 1 } };

// Doctor view: full shape, includes the PENDING draft (ai_output present) + one approved.
function doctorDigitalTwinFixture() {
  return {
    narrative_types: [
      { narrative_type: 'health_story', display_name: 'Health Story' },
      { narrative_type: 'ai_summary', display_name: 'AI Summary' }
    ],
    digital_twin: DIGITAL_TWIN_VIEW,
    progress_analytics: PROGRESS_ANALYTICS,
    narratives: [
      { narrative_id: 'n_pending', patient_id: 'p1', narrative_type: 'health_story', ai_output: 'Your recorded check-ins show steady improvement in sleep.', ai_output_flags: [], review_status: 'pending', published_output: '', reviewed_by: '', review_notes: '', created_at: '2026-07-16T00:00:00.000Z', reviewed_at: '' },
      { narrative_id: 'n_appr', patient_id: 'p1', narrative_type: 'ai_summary', ai_output: 'Approved raw output.', ai_output_flags: [], review_status: 'approved', published_output: 'A short approved progress summary.', reviewed_by: 'd1', review_notes: '', created_at: '2026-07-15T00:00:00.000Z', reviewed_at: '2026-07-15T01:00:00.000Z' }
    ]
  };
}

// Patient view: ONLY approved narratives, patient-safe shape (no ai_output/context_snapshot).
function patientHealthStoryFixture() {
  return {
    digital_twin: DIGITAL_TWIN_VIEW,
    narratives: [
      { narrative_id: 'n_appr', narrative_type: 'health_story', published_output: 'Your recorded journey shows steady, encouraging progress.', created_at: '2026-07-15T00:00:00.000Z', reviewed_at: '2026-07-15T01:00:00.000Z' }
    ]
  };
}

async function mockFoundation(page, opts) {
  const options = Object.assign({
    doctorProfileEnvelope: DOCTOR_PROFILE_ENVELOPE,
    patientProfileEnvelope: PATIENT_PROFILE_ENVELOPE,
    doctorModuleStates: [],
    patientModuleStates: [],
    roster: ROSTER_FIXTURE,
    doctorDigitalTwin: doctorDigitalTwinFixture(),
    patientHealthStory: patientHealthStoryFixture(),
    progressAnalytics: PROGRESS_ANALYTICS
  }, opts || {});
  const calls = [];
  const bodies = [];
  calls.bodies = bodies;
  await page.route('**/macros/s/**/exec', async (route) => {
    let body = {};
    try { body = JSON.parse(route.request().postData()); } catch (e) { /* not JSON */ }
    const action = body.foundation_action;
    calls.push(action);
    bodies.push(body);
    const envelopeFor = {
      get_doctor_profile: options.doctorProfileEnvelope,
      get_profile: options.patientProfileEnvelope,
      get_doctor_module_states: { status: 'ok', data: options.doctorModuleStates },
      get_patient_module_states: { status: 'ok', data: options.patientModuleStates },
      get_doctor_patient_roster: { status: 'ok', data: options.roster },
      get_patient_digital_twin: { status: 'ok', data: options.doctorDigitalTwin },
      get_health_story: { status: 'ok', data: options.patientHealthStory },
      get_progress_analytics: { status: 'ok', data: options.progressAnalytics }
    };
    if (action === 'generate_digital_twin_narrative') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: { narrative_id: 'n_new', patient_id: 'p1', narrative_type: body.narrative_type, ai_output: 'A freshly generated draft.', ai_output_flags: [], review_status: 'pending', published_output: '', reviewed_by: '', review_notes: '', created_at: '2026-07-16T00:00:00.000Z', reviewed_at: '' } }) });
      return;
    }
    if (action === 'review_digital_twin_narrative') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: { narrative_id: body.narrative_id, review_status: body.review_status } }) });
      return;
    }
    if (envelopeFor[action]) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelopeFor[action]) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_UNKNOWN_ACTION', message: 'Unknown request.' } }) });
  });
  return calls;
}

async function withDoctorSession(page, baseUrl, token) {
  await page.goto(`${baseUrl}/doctor-login.html`);
  await page.evaluate((t) => window.sessionStorage.setItem('wise_doctor_session_token', t), token);
}
async function withPatientSession(page, baseUrl, token) {
  await page.goto(`${baseUrl}/login.html`);
  await page.evaluate((t) => window.sessionStorage.setItem('wise_session_token', t), token);
}
async function blockExternalFonts(context) {
  await context.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await context.route('https://fonts.gstatic.com/**', (route) => route.abort());
}

async function main() {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  try {
    // ---- 1. Patient dashboard: health_story disabled -> no card, fail-closed ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { patientModuleStates: [patientStateRow('health_story', false)] });
      await withPatientSession(page, baseUrl, FAKE_PATIENT_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#dashEmptyState');
      const card = await page.$('#card-health_story-body');
      check('My Health Journey: a patient with health_story disabled sees no Health Story card at all (fail-closed by absence)', card === null);
      check('My Health Journey: get_health_story is never called when the module is disabled', calls.filter((a) => a === 'get_health_story').length === 0);
      await context.close();
    }

    // ---- 2. Patient dashboard: health_story enabled -> card renders summary + link, read-only ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { patientModuleStates: [patientStateRow('health_story', true)] });
      await withPatientSession(page, baseUrl, FAKE_PATIENT_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#card-health_story-body a[href*="my-health-journey/health-story/"]');
      const bodyText = await page.textContent('#card-health_story-body');
      check('My Health Journey: the Health Story card summarizes approved summaries from the doctor', /approved/i.test(bodyText));
      check('My Health Journey: get_health_story is called exactly once on load', calls.filter((a) => a === 'get_health_story').length === 1);
      const cardForms = await page.$$('#card-health_story-body form, #card-health_story-body textarea, #card-health_story-body input, #card-health_story-body button');
      check('My Health Journey: the Health Story card has no form/input/textarea/button — read-only, no patient write affordance', cardForms.length === 0);
      await context.close();
    }

    // ---- 3. Patient health-story page: read-only, only approved published_output, no draft ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page);
      await withPatientSession(page, baseUrl, FAKE_PATIENT_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/health-story/`);
      await page.waitForSelector('.hs-story, .empty-badge');

      const contentText = await page.textContent('#hsContent');
      check('Health Story page (patient): the approved narrative\'s published_output renders (doctor-approved, read-only)', /steady, encouraging progress/.test(contentText));
      check('Health Story page (patient): the "reviewed & approved by your doctor" badge is shown', /approved by your doctor/i.test(contentText));

      const html = await page.innerHTML('#hsContent');
      check('Health Story page (patient): no "not yet visible to the patient" draft banner ever appears — a patient never sees a draft (ADR-028)', !/not yet visible to the patient/.test(html));
      check('Health Story page (patient): the raw model output ("Approved raw output.") never appears — only the published_output does', !/Approved raw output/.test(html));

      const writeControls = await page.$$eval('button, textarea, input, [data-dt-decision], [data-dt-generate]',
        (els) => els.filter((e) => e.id !== 'signOutBtn').length);
      check('Health Story page (patient): no generate/approve/edit control renders anywhere — read-only (docs/59 §14.1)', writeControls === 0);
      await context.close();
    }

    // ---- 4. Doctor dashboard: digital_twin_review disabled -> no card, fail-closed (ADR-030) ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { doctorModuleStates: [doctorStateRow('digital_twin_review', false)] });
      await withDoctorSession(page, baseUrl, FAKE_DOCTOR_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dashEmptyState');
      const card = await page.$('#card-digital_twin_review-body');
      check('Doctor Dashboard: a doctor with digital_twin_review disabled sees no Digital Twin Review card at all (disabled by default, ADR-030)', card === null);
      check('Doctor Dashboard: get_patient_digital_twin is never called when the capability is disabled', calls.filter((a) => a === 'get_patient_digital_twin').length === 0);
      await context.close();
    }

    // ---- 5. Doctor dashboard: enabled -> picker + generate + draft banner + approve ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { doctorModuleStates: [doctorStateRow('digital_twin_review', true)] });
      await withDoctorSession(page, baseUrl, FAKE_DOCTOR_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dtLoadBtn');
      await page.selectOption('#dtPatientSelect', 'p1');
      await page.click('#dtLoadBtn');
      await page.waitForSelector('#dtGenerateBtn');

      const draftBanner = await page.textContent('[data-dt-narrative="n_pending"] [data-dt-visibility="draft"]');
      check('Doctor Dashboard: a pending narrative\'s banner names patient visibility as what approval unlocks ("not yet visible to the patient")', /not yet visible to the patient/i.test(draftBanner) && /Approving/i.test(draftBanner));

      // The banner precedes the decision controls in markup order.
      const bannerBeforeControls = await page.$eval('[data-dt-narrative="n_pending"]', (li) => {
        const banner = li.querySelector('[data-dt-visibility="draft"]');
        const control = li.querySelector('[data-dt-decision="approved"]');
        return banner && control && (banner.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      });
      check('Doctor Dashboard: the draft banner precedes the Approve/Edit/Reject controls in markup order', bannerBeforeControls === true);

      // The approved narrative shows "visible to the patient", never a decision control.
      const approvedBanner = await page.textContent('[data-dt-narrative="n_appr"] [data-dt-visibility="published"]');
      check('Doctor Dashboard: an approved narrative\'s banner states it is visible to the patient', /visible to the patient/i.test(approvedBanner));
      const approvedControls = await page.$$('[data-dt-narrative="n_appr"] [data-dt-decision]');
      check('Doctor Dashboard: an approved narrative offers no decision control (terminal, one-way)', approvedControls.length === 0);

      // Generating calls generate_digital_twin_narrative with the chosen narrative_type.
      await page.selectOption('#dtNarrativeType', 'ai_summary');
      await page.click('#dtGenerateBtn');
      await page.waitForFunction(() => !document.querySelector('#dtResultArea .skeleton'));
      check('Doctor Dashboard: clicking Generate calls generate_digital_twin_narrative once, with the chosen narrative_type',
        calls.filter((a) => a === 'generate_digital_twin_narrative').length === 1 &&
        calls.bodies.filter((b) => b.foundation_action === 'generate_digital_twin_narrative')[0].narrative_type === 'ai_summary');

      // Approving the pending draft calls review_digital_twin_narrative with review_status approved.
      await page.click('[data-dt-narrative="n_pending"] [data-dt-decision="approved"]');
      await page.waitForFunction(() => !document.querySelector('#dtResultArea .skeleton'));
      check('Doctor Dashboard: clicking Approve calls review_digital_twin_narrative once, with the narrative_id and review_status approved — the single act that makes it patient-visible',
        calls.filter((a) => a === 'review_digital_twin_narrative').length === 1 &&
        calls.bodies.filter((b) => b.foundation_action === 'review_digital_twin_narrative')[0].narrative_id === 'n_pending' &&
        calls.bodies.filter((b) => b.foundation_action === 'review_digital_twin_narrative')[0].review_status === 'approved');

      await context.close();
    }

    console.log('\n' + (passCount + failCount) + ' checks run, ' + failCount + ' failed.');
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
