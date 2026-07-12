/**
 * Browser-driven verification for Batch WPI-11 — Holoscan (my-health-journey/
 * dashboard.js's new registry-driven Holoscan card + medications/ full-history
 * page; doctor-dashboard/dashboard.js's new Holoscan Review + Medication History
 * cards). Mirrors validation/wpi-10-ai-assistant/browser-test.js's discipline
 * exactly: a local static server + headless Chromium (Playwright), the backend
 * mocked at the network layer, external font requests blocked for speed/
 * determinism.
 *
 * Per docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md §21, this suite's own
 * highest-priority checks are: the Holoscan (patient) card and the Holoscan
 * Review / Medication History (doctor) cards each do not render at all when
 * their own registry entry or module state is disabled (fail-closed); the
 * "AI-recognized — not yet in Medication History" banner is present and
 * precedes any Approve/Reject control; the Approve action's own UI copy never
 * implies MedicationHistory was updated by that action alone; Continue/Stop/
 * Replace/Unknown controls never imply a change occurred before the doctor's
 * own explicit confirmation completes; and the patient's own Medication
 * History page renders read-only, with no decision control at all.
 *
 * No apps-script/*.gs file is exercised by this suite — the backend's own
 * pipeline (fail-closed enablement, roster-scoping, the recognition check, the
 * one-way decision transition, the ledger recompute) is
 * validation/phase-2a-foundation/conformance.js's Stage 27, added in this same
 * batch, not duplicated here.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/wpi-11-holoscan/browser-test.js
 * (see validation/pa-2-dashboard/README.md for why NODE_PATH may be needed)
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
  if (condition) {
    passCount++;
    console.log('PASS —', label);
  } else {
    failCount++;
    console.log('FAIL —', label);
  }
}

function startServer() {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const filePath = path.join(ROOT, urlPath);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const FAKE_DOCTOR_TOKEN = 'fake-doctor-session-token-for-wpi11-tests';
const FAKE_PATIENT_TOKEN = 'fake-patient-session-token-for-wpi11-tests';

const DOCTOR_PROFILE_ENVELOPE = {
  status: 'ok',
  data: { doctor_id: 'd1', full_name: 'Dr. Asha Rao', role: 'physician', email: 'asha@example.com', specialty_slug: 'homeopathy', status: 'active' }
};
const PATIENT_PROFILE_ENVELOPE = { status: 'ok', data: { patient_id: 'p1', full_name: 'Patient One', email: 'p1@example.com', condition_slug: 'mcas', status: 'active' } };

function doctorStateRow(capabilityKey, enabled) {
  return { state_key: 'd1::' + capabilityKey, doctor_id: 'd1', capability_key: capabilityKey, enabled: enabled, enabled_by: enabled ? 'staff-1' : '', enabled_at: enabled ? '2026-07-16T00:00:00.000Z' : '' };
}
function patientStateRow(moduleId, enabled) {
  return { state_key: 'p1::' + moduleId, patient_id: 'p1', module_id: moduleId, enabled: enabled, enabled_by: enabled ? 'staff-1' : '', enabled_at: enabled ? '2026-07-16T00:00:00.000Z' : '' };
}

const ROSTER_FIXTURE = [{ patient_id: 'p1', full_name: 'Patient One', condition_slugs: ['mcas'] }];

function pendingItemFixture() {
  return {
    recognition_item_id: 'ri1', recognition_id: 'r1', patient_id: 'p1', source_image_ref: 'drive1',
    extracted_name: 'Arnica Montana 30C', extracted_strength: '30C', extracted_dosage_form: 'pellets',
    extracted_manufacturer: '', extracted_batch: '', extracted_expiry: '', confidence_score: 0.9,
    check_flags: [], catalog_match_status: '', catalog_match_ref: '', doctor_decision: 'pending',
    corrected_fields: {}, decision_notes: '', decided_by: '', decided_at: '', created_at: '2026-07-16T00:00:00.000Z'
  };
}
function recognitionFixture() {
  return {
    recognition_id: 'r1', patient_id: 'p1', image_refs: [{ drive_file_id: 'drive1', mime_type: 'image/jpeg', size_bytes: 1000 }],
    status: 'completed', model: 'anthropic/claude-haiku-4.5', prompt_template_version: '1.0',
    submitted_at: '2026-07-16T00:00:00.000Z', processed_at: '2026-07-16T00:00:05.000Z', error_log: '',
    items: [pendingItemFixture()]
  };
}
function medicationHistoryFixture() {
  // Two entries for the same patient — the second exists specifically so the first has
  // a real Replace target to select (record_medication_decision's own
  // replacement_medication_history_id must reference a different, existing
  // MedicationHistory row for the same patient, docs/56 §11.4).
  return [
    {
      medication_history_id: 'mh1', patient_id: 'p1', medicine_name: 'Arnica Montana 30C', strength: '30C',
      dosage_form: 'pellets', manufacturer: '', source_type: 'holoscan_recognition', source_recognition_item_id: 'ri1',
      current_status: 'active', created_at: '2026-07-16T00:00:00.000Z', created_by: 'd1',
      decisions: []
    },
    {
      medication_history_id: 'mh2', patient_id: 'p1', medicine_name: 'Belladonna 200C', strength: '200C',
      dosage_form: 'pellets', manufacturer: '', source_type: 'doctor_manual_entry', source_recognition_item_id: '',
      current_status: 'active', created_at: '2026-07-15T00:00:00.000Z', created_by: 'd1',
      decisions: []
    }
  ];
}

async function mockFoundation(page, opts) {
  const options = Object.assign({
    doctorProfileEnvelope: DOCTOR_PROFILE_ENVELOPE,
    patientProfileEnvelope: PATIENT_PROFILE_ENVELOPE,
    doctorModuleStates: [],
    patientModuleStates: [],
    reviewQueue: [pendingItemFixture()],
    roster: ROSTER_FIXTURE,
    recognitions: [recognitionFixture()],
    medicationHistory: medicationHistoryFixture(),
    decisionEnvelope: null
  }, opts || {});
  const calls = [];
  const bodies = [];
  calls.bodies = bodies; // exposed as calls.bodies so existing call sites need no signature change
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
      get_holoscan_review_queue: { status: 'ok', data: options.reviewQueue },
      get_doctor_patient_roster: { status: 'ok', data: options.roster },
      get_holoscan_recognitions: { status: 'ok', data: options.recognitions },
      get_medication_history: { status: 'ok', data: options.medicationHistory }
    };
    if (action === 'post_holoscan_recognition_decision') {
      const decided = Object.assign({}, pendingItemFixture(), { doctor_decision: body.doctor_decision, decided_at: '2026-07-16T00:05:00.000Z' });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.decisionEnvelope || { status: 'ok', data: decided }) });
      return;
    }
    if (action === 'create_medication_history_entry') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: medicationHistoryFixture()[0] }) });
      return;
    }
    if (action === 'record_medication_decision') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          data: {
            decision_id: 'dec1', medication_history_id: body.medication_history_id, patient_id: 'p1',
            decision_type: body.decision_type, replacement_medication_history_id: body.replacement_medication_history_id || '',
            notes: '', decided_by: 'd1', decided_at: '2026-07-16T00:10:00.000Z'
          }
        })
      });
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
    // ---- 1. Holoscan Review disabled by default (ADR-026) -> no card at all, fail-closed ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { doctorModuleStates: [doctorStateRow('holoscan_review', false), doctorStateRow('medication_history', false)] });
      await withDoctorSession(page, baseUrl, FAKE_DOCTOR_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dashEmptyState');

      const reviewCard = await page.$('#card-holoscan_review-body');
      const medHistoryCard = await page.$('#card-medication_history-body');
      check('Doctor Dashboard: a doctor with holoscan_review disabled (the default, ADR-026) sees no Holoscan Review card at all', reviewCard === null);
      check('Doctor Dashboard: a doctor with medication_history disabled sees no Medication History card at all', medHistoryCard === null);

      const reviewCalls = calls.filter((a) => a === 'get_holoscan_review_queue').length;
      check('Doctor Dashboard: get_holoscan_review_queue is never called when the capability is disabled', reviewCalls === 0);

      await context.close();
    }

    // ---- 2. Holoscan Review enabled -> queue renders, banner precedes Approve/Reject ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { doctorModuleStates: [doctorStateRow('holoscan_review', true)] });
      await withDoctorSession(page, baseUrl, FAKE_DOCTOR_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('.ai-assistant-banner');

      const bodyHtml = await page.innerHTML('#card-holoscan_review-body');
      const bannerIdx = bodyHtml.indexOf('ai-assistant-banner');
      const controlsIdx = bodyHtml.indexOf('ai-assistant-decision-controls');
      check('Doctor Dashboard: the "AI-recognized — not yet in Medication History" banner is present', bannerIdx !== -1);
      check('Doctor Dashboard: the banner appears BEFORE any Approve/Reject control in markup order', bannerIdx !== -1 && controlsIdx !== -1 && bannerIdx < controlsIdx);

      const bannerText = await page.textContent('.ai-assistant-banner');
      check('Doctor Dashboard: the banner\'s own text names Medication History explicitly', /Medication History/.test(bannerText));

      const buttonLabels = await page.$$eval('.ai-assistant-decision-controls button', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: Approve/Reject controls both render', buttonLabels.join(',').indexOf('Approve') !== -1 && buttonLabels.join(',').indexOf('Reject') !== -1);

      const reviewCalls = calls.filter((a) => a === 'get_holoscan_review_queue').length;
      check('Doctor Dashboard: get_holoscan_review_queue is called exactly once on load', reviewCalls === 1);

      await context.close();
    }

    // ---- 3. Approving never implies MedicationHistory was updated by that action alone ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { doctorModuleStates: [doctorStateRow('holoscan_review', true)] });
      await withDoctorSession(page, baseUrl, FAKE_DOCTOR_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('[data-holoscan-decision="approved"]');
      await page.click('[data-holoscan-decision="approved"]');
      await page.waitForSelector('.ai-assistant-decision');

      const decisionCalls = calls.filter((a) => a === 'post_holoscan_recognition_decision').length;
      check('Doctor Dashboard: clicking Approve calls post_holoscan_recognition_decision exactly once', decisionCalls === 1);
      const medicationWriteCalls = calls.filter((a) => a === 'create_medication_history_entry').length;
      check('Doctor Dashboard: Approve never itself calls create_medication_history_entry (ADR-025) — a separate, deliberate action is required', medicationWriteCalls === 0);

      const decisionText = await page.textContent('.ai-assistant-decision');
      check('Doctor Dashboard: the UI explicitly directs the doctor to the separate Medication History card/action — never implying this decision alone saved anything',
        /Medication History/i.test(decisionText) && /does not save anything|open the Medication History/i.test(decisionText));

      await context.close();
    }

    // ---- 4. Medication History card — Continue/Stop/Replace/Unknown controls never imply a change before confirmation ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { doctorModuleStates: [doctorStateRow('medication_history', true)] });
      await withDoctorSession(page, baseUrl, FAKE_DOCTOR_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#mhLoadBtn');
      await page.selectOption('#mhPatientSelect', 'p1');
      await page.click('#mhLoadBtn');
      await page.waitForSelector('#mhAddEntryForm');

      const beforeText = await page.textContent('#mhResultArea');
      check('Doctor Dashboard: Medication History lists the loaded patient\'s own entries (both fixture medicines) before any decision is recorded',
        /Arnica Montana/.test(beforeText) && /Belladonna/.test(beforeText));

      // Fixture has two entries for this patient (mh1, mh2), so each entry's own
      // controls have a real Replace target available — scope every action to mh1's
      // own controls container specifically, since both entries render a full control
      // set and an unscoped selector would match more than one element.
      const mh1Controls = '[data-mh-decision-controls="mh1"]';
      const decisionButtons = await page.$$(`${mh1Controls} [data-mh-decision]`);
      check('Doctor Dashboard: Continue/Stop/Replace/Mark unknown controls are all four present, no status change implied until clicked',
        decisionButtons.length === 4);
      const decisionLabels = await page.$$eval(`${mh1Controls} [data-mh-decision]`, (els) => els.map((e) => e.getAttribute('data-mh-decision')));
      check('Doctor Dashboard: the four controls are exactly continue/stop/replace/unknown, matching docs/56 §19.3',
        JSON.stringify(decisionLabels.slice().sort()) === JSON.stringify(['continue', 'replace', 'stop', 'unknown']));

      const replaceSelectOptions = await page.$$eval(`${mh1Controls} [data-mh-replace-select] option`, (els) => els.map((e) => ({ value: e.value, text: e.textContent })));
      check('Doctor Dashboard: the Replace control\'s own select is populated with the patient\'s other MedicationHistory entry (mh2, Belladonna), never itself (mh1)',
        replaceSelectOptions.length === 1 && replaceSelectOptions[0].value === 'mh2' && /Belladonna/.test(replaceSelectOptions[0].text));

      await page.click(`${mh1Controls} [data-mh-decision="continue"]`);
      await page.waitForFunction(() => !document.querySelector('#mhResultArea .skeleton'));
      check('Doctor Dashboard: clicking Continue calls record_medication_decision exactly once, only after the explicit click, decision_type "continue"',
        calls.filter((a) => a === 'record_medication_decision').length === 1 &&
        calls.bodies[calls.bodies.length - 1].decision_type === 'continue');

      // Re-select the replacement target and click Replace (the list re-rendered after
      // the Continue click above, so mh1's controls are queried fresh).
      await page.selectOption(`${mh1Controls} [data-mh-replace-select]`, 'mh2');
      await page.click(`${mh1Controls} [data-mh-decision="replace"]`);
      await page.waitForFunction(() => !document.querySelector('#mhResultArea .skeleton'));
      const replaceCallBody = calls.bodies[calls.bodies.length - 1];
      check('Doctor Dashboard: clicking Replace (with a target selected) calls record_medication_decision with decision_type "replace" and the selected replacement_medication_history_id',
        calls.filter((a) => a === 'record_medication_decision').length === 2 &&
        replaceCallBody.decision_type === 'replace' && replaceCallBody.medication_history_id === 'mh1' &&
        replaceCallBody.replacement_medication_history_id === 'mh2');

      await context.close();
    }

    // ---- 5. Patient dashboard: Holoscan card fail-closed when the module state is disabled ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { patientModuleStates: [patientStateRow('holoscan', false)] });
      await withPatientSession(page, baseUrl, FAKE_PATIENT_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#dashEmptyState');

      const card = await page.$('#card-holoscan-body');
      check('My Health Journey Dashboard: a patient with holoscan disabled sees no Medication Photo Scan card at all', card === null);

      await context.close();
    }

    // ---- 6. Patient dashboard: Holoscan card enabled — upload form + recognition history render ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { patientModuleStates: [patientStateRow('holoscan', true)] });
      await withPatientSession(page, baseUrl, FAKE_PATIENT_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#holoscanForm');

      const fileInput = await page.$('#holoscanFiles');
      const multipleAttr = await page.$eval('#holoscanFiles', (el) => el.hasAttribute('multiple'));
      check('My Health Journey Dashboard: the Holoscan upload form accepts multiple photos in one submission', fileInput !== null && multipleAttr === true);

      const listText = await page.textContent('#holoscanList');
      check('My Health Journey Dashboard: the recognition-history list shows each submission\'s own status plus its item\'s own review decision — never a raw, un-reviewed candidate presented as already-confirmed',
        /Reviewed by pipeline/.test(listText) && /Awaiting doctor review/.test(listText));

      const historyLink = await page.$('a[href*="my-health-journey/medications/"]');
      check('My Health Journey Dashboard: the card links to the full Medication History page', historyLink !== null);

      await context.close();
    }

    // ---- 7. Patient's own Medication History page — read-only, no decision control at all ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page);
      await withPatientSession(page, baseUrl, FAKE_PATIENT_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/medications/`);
      await page.waitForSelector('.tl-track, .empty-badge');

      const decisionControls = await page.$$('[data-mh-decision], [data-holoscan-decision], button');
      const writeButtons = await page.$$eval('button', (els) => els.filter((e) => /continue|stop|replace|unknown|approve|reject/i.test(e.textContent)).length);
      check('Medication History page (patient): no Continue/Stop/Replace/Unknown/Approve/Reject control renders anywhere — read-only', writeButtons === 0);

      const statusBadge = await page.textContent('.mh-status');
      check('Medication History page (patient): the current, doctor-confirmed status is shown', /Active/.test(statusBadge));

      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n${passCount + failCount} checks run, ${failCount} failed.`);
  process.exit(failCount === 0 ? 0 : 1);
}

main();
