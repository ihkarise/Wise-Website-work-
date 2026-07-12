/**
 * Browser-driven verification for Batch PXP-11 — Health Milestones (Phase 2C,
 * docs/58-PHASE-2C-HEALTH-MILESTONES-ARCHITECTURE-FREEZE.md §19-§21). Mirrors
 * validation/wpi-11-holoscan/browser-test.js's discipline exactly: a local static server +
 * headless Chromium (Playwright), the backend mocked at the network layer, external font
 * requests blocked for speed/determinism.
 *
 * Per docs/58 §21, this suite's own highest-priority checks are: the Health Milestones
 * (patient) card and the Milestone Review (doctor) card each do not render at all when
 * their own registry entry or module state is disabled (fail-closed); the patient page is
 * read-only (no anchor/authoring/publish control, and never a draft — only published
 * reviews); and the doctor card's Publish control makes the draft-vs-published visibility
 * boundary explicit (a draft is private; publishing is what makes it patient-visible).
 *
 * No apps-script/*.gs file is exercised by this suite — the backend's own pipeline
 * (roster-scoping, the computed schedule, the one-way publish transition, published-only
 * patient visibility) is validation/phase-2a-foundation/conformance.js's Stage 28, added in
 * this same batch, not duplicated here.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/phase-2c-milestones/browser-test.js
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

const FAKE_DOCTOR_TOKEN = 'fake-doctor-session-token-for-pxp11-tests';
const FAKE_PATIENT_TOKEN = 'fake-patient-session-token-for-pxp11-tests';

const DOCTOR_PROFILE_ENVELOPE = { status: 'ok', data: { doctor_id: 'd1', full_name: 'Dr. Asha Rao', role: 'physician', email: 'asha@example.com', specialty_slug: 'homeopathy', status: 'active' } };
const PATIENT_PROFILE_ENVELOPE = { status: 'ok', data: { patient_id: 'p1', full_name: 'Patient One', email: 'p1@example.com', condition_slug: 'mcas', status: 'active' } };

function doctorStateRow(capabilityKey, enabled) {
  return { state_key: 'd1::' + capabilityKey, doctor_id: 'd1', capability_key: capabilityKey, enabled: enabled, enabled_by: enabled ? 'staff-1' : '', enabled_at: enabled ? '2026-07-16T00:00:00.000Z' : '' };
}
function patientStateRow(moduleId, enabled) {
  return { state_key: 'p1::' + moduleId, patient_id: 'p1', module_id: moduleId, enabled: enabled, enabled_by: enabled ? 'staff-1' : '', enabled_at: enabled ? '2026-07-16T00:00:00.000Z' : '' };
}

const ROSTER_FIXTURE = [{ patient_id: 'p1', full_name: 'Patient One', condition_slugs: ['mcas'] }];

function reviewFixture(milestoneType, status, targetDate) {
  return {
    review_id: 'rev_' + milestoneType, patient_id: 'p1', track_id: 't1', milestone_type: milestoneType, target_date: targetDate,
    progress_summary: 'Sleeping better; itching much reduced.', improvements: 'Energy up.', medicines_review: '',
    investigations: '', recommendations: 'Continue current remedy.', next_goals: 'Maintain routine.',
    status: status, authored_by: 'd1', created_at: '2026-07-16T00:00:00.000Z', updated_at: '', published_at: status === 'published' ? '2026-07-16T00:05:00.000Z' : ''
  };
}

// Doctor view (get_patient_milestones): includes drafts. 30_day published, 90_day draft.
function doctorMilestonesFixture() {
  return {
    track: { track_id: 't1', patient_id: 'p1', care_start_date: '2020-01-01', status: 'active', created_by: 'd1', created_at: '2026-07-16T00:00:00.000Z', updated_at: '' },
    schedule: [
      { milestone_type: '30_day', target_date: '2020-01-31', state: 'completed' },
      { milestone_type: '90_day', target_date: '2020-03-31', state: 'overdue' },
      { milestone_type: '6_month', target_date: '2020-07-01', state: 'overdue' },
      { milestone_type: '1_year', target_date: '2021-01-01', state: 'overdue' }
    ],
    reviews: [reviewFixture('30_day', 'published', '2020-01-31'), reviewFixture('90_day', 'draft', '2020-03-31')]
  };
}

// Patient view (get_health_milestones): published reviews only (server-enforced). Only the
// 30_day published review is present — the 90_day draft is NEVER returned to the patient.
function patientMilestonesFixture() {
  return {
    track: { track_id: 't1', patient_id: 'p1', care_start_date: '2020-01-01', status: 'active', created_by: 'd1', created_at: '2026-07-16T00:00:00.000Z', updated_at: '' },
    schedule: [
      { milestone_type: '30_day', target_date: '2020-01-31', state: 'completed' },
      { milestone_type: '90_day', target_date: '2020-03-31', state: 'overdue' },
      { milestone_type: '6_month', target_date: '2020-07-01', state: 'overdue' },
      { milestone_type: '1_year', target_date: '2021-01-01', state: 'overdue' }
    ],
    reviews: [reviewFixture('30_day', 'published', '2020-01-31')]
  };
}

async function mockFoundation(page, opts) {
  const options = Object.assign({
    doctorProfileEnvelope: DOCTOR_PROFILE_ENVELOPE,
    patientProfileEnvelope: PATIENT_PROFILE_ENVELOPE,
    doctorModuleStates: [],
    patientModuleStates: [],
    roster: ROSTER_FIXTURE,
    doctorMilestones: doctorMilestonesFixture(),
    patientMilestones: patientMilestonesFixture()
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
      get_patient_milestones: { status: 'ok', data: options.doctorMilestones },
      get_health_milestones: { status: 'ok', data: options.patientMilestones }
    };
    if (action === 'set_milestone_track') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: { track_id: 't1', patient_id: 'p1', care_start_date: body.care_start_date, status: 'active', created_by: 'd1', created_at: '2026-07-16T00:00:00.000Z', updated_at: '2026-07-16T00:10:00.000Z' } }) });
      return;
    }
    if (action === 'save_milestone_review') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: reviewFixture(body.milestone_type, 'draft', '2020-03-31') }) });
      return;
    }
    if (action === 'publish_milestone_review') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: reviewFixture('90_day', 'published', '2020-03-31') }) });
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
    // ---- 1. Patient dashboard: health_milestones disabled -> no card, fail-closed ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { patientModuleStates: [patientStateRow('health_milestones', false)] });
      await withPatientSession(page, baseUrl, FAKE_PATIENT_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#dashEmptyState');
      const card = await page.$('#card-health_milestones-body');
      check('My Health Journey: a patient with health_milestones disabled sees no Health Milestones card at all', card === null);
      check('My Health Journey: get_health_milestones is never called when the module is disabled', calls.filter((a) => a === 'get_health_milestones').length === 0);
      await context.close();
    }

    // ---- 2. Patient dashboard: health_milestones enabled -> card renders schedule summary + link ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { patientModuleStates: [patientStateRow('health_milestones', true)] });
      await withPatientSession(page, baseUrl, FAKE_PATIENT_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#card-health_milestones-body a[href*="my-health-journey/milestones/"]');
      const bodyText = await page.textContent('#card-health_milestones-body');
      check('My Health Journey: the Health Milestones card summarizes celebrated progress (1 of 4)', /1 of 4/.test(bodyText) && /celebrated/i.test(bodyText));
      const link = await page.$('#card-health_milestones-body a[href*="my-health-journey/milestones/"]');
      check('My Health Journey: the card links to the full Health Milestones page', link !== null);
      check('My Health Journey: get_health_milestones is called exactly once on load', calls.filter((a) => a === 'get_health_milestones').length === 1);
      // The card has no write affordance at all (read-only, doctor-authored).
      const cardForms = await page.$$('#card-health_milestones-body form, #card-health_milestones-body textarea, #card-health_milestones-body input');
      check('My Health Journey: the Health Milestones card has no form/input/textarea — read-only, no patient write affordance', cardForms.length === 0);
      await context.close();
    }

    // ---- 3. Patient milestones page: read-only, only published reviews, never a draft, no controls ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page);
      await withPatientSession(page, baseUrl, FAKE_PATIENT_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/milestones/`);
      await page.waitForSelector('.tl-track, .empty-badge');

      const contentText = await page.textContent('#msContent');
      check('Milestones page (patient): the published 30-day review\'s own content renders (doctor-authored, read-only)', /Sleeping better/.test(contentText) && /Maintain routine/.test(contentText));
      check('Milestones page (patient): the completed milestone reads "Celebrated"', /Celebrated/.test(contentText));

      const writeControls = await page.$$eval('button, textarea, input, [data-ms-save], [data-ms-publish], [data-ms-decision]',
        (els) => els.filter((e) => e.id !== 'signOutBtn').length);
      check('Milestones page (patient): no anchor/authoring/publish/decision control renders anywhere — read-only (docs/58 §19.1)', writeControls === 0);

      // The patient payload contains only published reviews; the draft's own distinctive
      // marker must never appear on this page.
      const html = await page.innerHTML('#msContent');
      check('Milestones page (patient): no "Draft" visibility banner or draft marker appears — a patient never sees a draft', !/Draft/.test(html) && !/private to you/.test(html));
      await context.close();
    }

    // ---- 4. Doctor dashboard: milestone_review disabled -> no card, fail-closed (normal rollout) ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { doctorModuleStates: [doctorStateRow('milestone_review', false)] });
      await withDoctorSession(page, baseUrl, FAKE_DOCTOR_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dashEmptyState');
      const card = await page.$('#card-milestone_review-body');
      check('Doctor Dashboard: a doctor with milestone_review disabled sees no Milestone Review card at all (fail-closed by absence)', card === null);
      check('Doctor Dashboard: get_patient_milestones is never called when the capability is disabled', calls.filter((a) => a === 'get_patient_milestones').length === 0);
      await context.close();
    }

    // ---- 5. Doctor dashboard: milestone_review enabled -> picker + authoring + draft/publish boundary ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { doctorModuleStates: [doctorStateRow('milestone_review', true)] });
      await withDoctorSession(page, baseUrl, FAKE_DOCTOR_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#msLoadBtn');
      await page.selectOption('#msPatientSelect', 'p1');
      await page.click('#msLoadBtn');
      await page.waitForSelector('#msAnchorForm');

      const anchorInput = await page.$('#msCareStartDate');
      check('Doctor Dashboard: the care-start anchor control renders, pre-filled with the patient\'s current care_start_date', anchorInput !== null && (await page.$eval('#msCareStartDate', (el) => el.value)) === '2020-01-01');

      const points = await page.$$('.ms-point');
      check('Doctor Dashboard: all four milestone points render an authoring block', points.length === 4);

      // The 90_day point is a DRAFT — its visibility banner must say it is private and that
      // publishing is what makes it patient-visible.
      const draftBanner = await page.textContent('[data-ms-point="90_day"] [data-ms-visibility="draft"]');
      check('Doctor Dashboard: a draft point\'s banner states it is private to the doctor and the patient sees nothing until Publish', /private to you/i.test(draftBanner) && /Publish/.test(draftBanner));
      const draftPublishBtn = await page.$('[data-ms-point="90_day"] [data-ms-publish]');
      check('Doctor Dashboard: a draft review shows an explicit "Publish to patient" control', draftPublishBtn !== null);

      // The 30_day point is PUBLISHED — banner says visible to the patient; content readonly; no Save/Publish.
      const publishedBanner = await page.textContent('[data-ms-point="30_day"] [data-ms-visibility="published"]');
      check('Doctor Dashboard: a published point\'s banner states it is visible to the patient', /visible to the patient/i.test(publishedBanner));
      const publishedReadonly = await page.$eval('[data-ms-point="30_day"] textarea', (el) => el.hasAttribute('readonly'));
      check('Doctor Dashboard: a published review\'s fields are read-only (content frozen after publish)', publishedReadonly === true);
      const publishedSaveBtn = await page.$('[data-ms-point="30_day"] [data-ms-save]');
      check('Doctor Dashboard: a published review offers no Save-draft control (one-way, content frozen)', publishedSaveBtn === null);

      // Saving the 90_day draft calls save_milestone_review exactly once, doctor-typed.
      await page.click('[data-ms-point="90_day"] [data-ms-save]');
      await page.waitForFunction(() => !document.querySelector('#msResultArea .skeleton'));
      check('Doctor Dashboard: clicking Save draft calls save_milestone_review exactly once, with the milestone_type and doctor-typed progress_summary',
        calls.filter((a) => a === 'save_milestone_review').length === 1 &&
        calls.bodies[calls.bodies.length - 1].milestone_type === '90_day' &&
        /Sleeping better/.test(calls.bodies[calls.bodies.length - 1].progress_summary));

      // Publishing the 90_day draft calls publish_milestone_review with its review_id.
      await page.click('[data-ms-point="90_day"] [data-ms-publish]');
      await page.waitForFunction(() => !document.querySelector('#msResultArea .skeleton'));
      check('Doctor Dashboard: clicking Publish calls publish_milestone_review exactly once, with the review_id — the single act that makes it patient-visible',
        calls.filter((a) => a === 'publish_milestone_review').length === 1 &&
        calls.bodies[calls.bodies.length - 1].review_id === 'rev_90_day');

      // Setting the anchor calls set_milestone_track (never a patient-supplied schedule).
      await page.fill('#msCareStartDate', '2020-02-01');
      await page.click('#msAnchorSubmitBtn');
      await page.waitForFunction(() => !document.querySelector('#msResultArea .skeleton'));
      check('Doctor Dashboard: updating the care-start date calls set_milestone_track with the doctor-chosen date',
        calls.filter((a) => a === 'set_milestone_track').length === 1 &&
        calls.bodies[calls.bodies.length - 1].care_start_date === '2020-02-01');

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
