/**
 * Browser-driven verification for Batch PXP-5 — the Daily Check-in Engine
 * (my-health-journey/dashboard.js's new registry-driven Daily Check-in
 * card, and my-health-journey/checkins/index.html's full-history page).
 * Mirrors validation/pxp-4-dashboard-registry/browser-test.js's discipline
 * exactly: a local static server + headless Chromium (Playwright), the
 * backend mocked at the network layer, external font requests blocked for
 * speed/determinism.
 *
 * Covers only PXP-5's own new surface (dynamic, template-driven form
 * rendering; unassigned-patient state; submission; full-history rendering).
 * The pre-existing Dashboard Registry mechanism (per-patient enablement,
 * display_order, empty dashboard, unregistered data_source fail-soft) is
 * still fully covered by validation/pxp-4-dashboard-registry/, unchanged by
 * this batch.
 *
 * No apps-script/*.gs file is exercised by this suite — the backend's own
 * get_checkin_template/submit_checkin_response/get_checkin_responses routes
 * (JSON-answers validation, docs/44 §10.2's assignment-enforcement
 * boundary, cross-patient isolation) are
 * validation/phase-2a-foundation/conformance.js's Stage 13, added in this
 * same batch, not duplicated here.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/pxp-5-checkin-engine/browser-test.js
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

const FAKE_TOKEN = 'fake-session-token-for-pxp5-tests';

const PROFILE_ENVELOPE = {
  status: 'ok',
  data: { patient_id: 'p1', full_name: 'Asha Menon', email: 'asha@example.com', condition_slug: 'mcas', status: 'active' }
};

const TEMPLATE = {
  template_id: 'daily_wellness_checkin',
  version: 1,
  template_category: 'daily_checkin',
  condition_slug: '',
  questions: [
    { field_key: 'overall_feeling', label: 'How are you feeling today, overall?', type: 'number', min: 1, max: 10, required: true },
    { field_key: 'symptom_severity', label: "Rate today's symptom severity", type: 'number', min: 1, max: 10, required: true },
    { field_key: 'took_medication', label: 'Did you take your prescribed medication today?', type: 'boolean', required: true },
    { field_key: 'notes', label: 'Anything else your doctor should know? (optional)', type: 'string', required: false }
  ],
  status: 'active',
  future_ai_capable: false,
  created_by: 'system',
  created_at: '2026-07-09T00:00:00.000Z'
};

// Fixture rows shaped exactly like PatientModuleState — the same shape the
// live get_patient_module_states route returns, per PXP-3/PXP-4.
function stateRow(moduleId, enabled) {
  return {
    state_key: 'p1::' + moduleId,
    patient_id: 'p1',
    module_id: moduleId,
    enabled: enabled,
    enabled_by: enabled ? 'staff-1' : '',
    enabled_at: enabled ? '2026-07-01T00:00:00.000Z' : ''
  };
}

function responseRow(recordId, loggedAt, answers) {
  return {
    record_id: recordId, patient_id: 'p1', template_id: 'daily_wellness_checkin', template_version: 1,
    logged_at: loggedAt, answers: answers, condition_slug: ''
  };
}

// Routes by the parsed request's foundation_action. Records every action
// the page actually calls (in order) so a test can assert not just what
// rendered but also what was requested — the same "black-box, but
// observable at the network boundary" discipline every earlier browser
// suite already uses.
async function mockFoundation(page, opts) {
  const options = Object.assign({
    profileEnvelope: PROFILE_ENVELOPE,
    moduleStates: [stateRow('daily_checkin', true)],
    checkinTemplateEnvelope: { status: 'ok', data: TEMPLATE },
    checkinResponses: [],
    submitResult: null, // { status, data, error } — defaults to a real success shaped after the request
    timeline: [], symptomLogs: [], reports: []
  }, opts || {});
  const calls = [];
  await page.route('**/macros/s/**/exec', async (route) => {
    let body = {};
    try { body = JSON.parse(route.request().postData()); } catch (e) { /* not JSON */ }
    const action = body.foundation_action;
    calls.push(action);
    if (action === 'get_profile') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.profileEnvelope) });
      return;
    }
    if (action === 'get_patient_module_states') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: options.moduleStates }) });
      return;
    }
    if (action === 'get_checkin_template') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.checkinTemplateEnvelope) });
      return;
    }
    if (action === 'get_checkin_responses') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: options.checkinResponses }) });
      return;
    }
    if (action === 'submit_checkin_response') {
      const result = options.submitResult || {
        status: 'ok',
        data: responseRow('new-record-1', '2026-07-12T09:00:00.000Z', body.answers)
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
      return;
    }
    if (action === 'get_timeline') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: options.timeline }) });
      return;
    }
    if (action === 'get_symptom_logs') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: options.symptomLogs }) });
      return;
    }
    if (action === 'get_reports') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: options.reports }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_UNKNOWN_ACTION', message: 'Unknown request.' } }) });
  });
  return calls;
}

// Same race/re-injection avoidance every earlier suite uses: land on a
// same-origin page first to get a JS context, set sessionStorage there
// once, then navigate.
async function withSessionToken(page, baseUrl, token) {
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
    // ---- 1. Enabled module, no active assignment yet -> "not assigned" state, no form ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { checkinTemplateEnvelope: { status: 'ok', data: null } });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-daily_checkin-body');

      const bodyText = await page.textContent('#card-daily_checkin-body');
      check('Daily Check-in: an enabled module with no active template assignment shows the "not assigned yet" message, not an error',
        bodyText.indexOf("hasn't assigned a daily check-in yet") !== -1);
      const formExists = await page.$('#checkInForm');
      check('Daily Check-in: no form renders when there is no template to render it from', formExists === null);

      await context.close();
    }

    // ---- 2. Assigned template -> a dynamic form is rendered from its own question list ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {});
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#checkInForm');

      const numberInputs = await page.$$eval('#checkInForm input[type="number"]', (els) => els.map((e) => e.id));
      check('Daily Check-in: a "number" question renders as a number input with the template\'s own min/max',
        numberInputs.indexOf('ci_overall_feeling') !== -1 && numberInputs.indexOf('ci_symptom_severity') !== -1);
      const overallMax = await page.getAttribute('#ci_overall_feeling', 'max');
      check('Daily Check-in: the number input\'s max attribute comes from the template\'s own question definition (10)', overallMax === '10');

      const booleanSelect = await page.$('#ci_took_medication');
      check('Daily Check-in: a "boolean" question renders as a Yes/No select, not a free-text field', booleanSelect !== null);

      const notesField = await page.$('#ci_notes');
      const notesTag = await page.$eval('#ci_notes', (el) => el.tagName.toLowerCase());
      check('Daily Check-in: a "string" question renders as a textarea', notesField !== null && notesTag === 'textarea');
      const notesRequired = await page.getAttribute('#ci_notes', 'required');
      check('Daily Check-in: the optional "notes" question has no required attribute', notesRequired === null);
      const overallRequired = await page.getAttribute('#ci_overall_feeling', 'required');
      check('Daily Check-in: a required question does carry the required attribute', overallRequired !== null);

      await context.close();
    }

    // ---- 3. Submission: answers are read per-type and posted to submit_checkin_response ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = [];
      await page.route('**/macros/s/**/exec', async (route) => {
        let body = {};
        try { body = JSON.parse(route.request().postData()); } catch (e) { /* not JSON */ }
        calls.push({ action: body.foundation_action, body: body });
        if (body.foundation_action === 'get_profile') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROFILE_ENVELOPE) });
          return;
        }
        if (body.foundation_action === 'get_patient_module_states') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: [stateRow('daily_checkin', true)] }) });
          return;
        }
        if (body.foundation_action === 'get_checkin_template') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: TEMPLATE }) });
          return;
        }
        if (body.foundation_action === 'get_checkin_responses') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: [] }) });
          return;
        }
        if (body.foundation_action === 'submit_checkin_response') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: responseRow('r1', '2026-07-12T09:00:00.000Z', body.answers) }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_UNKNOWN_ACTION', message: 'Unknown request.' } }) });
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#checkInForm');

      await page.fill('#ci_overall_feeling', '8');
      await page.fill('#ci_symptom_severity', '2');
      await page.selectOption('#ci_took_medication', 'yes');
      await page.fill('#ci_notes', 'feeling good today');
      await page.click('#checkInSubmitBtn');
      await page.waitForSelector('#checkInStatus.ok');

      const submitCall = calls.filter((c) => c.action === 'submit_checkin_response')[0];
      check('Daily Check-in: submitting the form posts submit_checkin_response with the template_id/template_version it was rendered from',
        submitCall && submitCall.body.template_id === 'daily_wellness_checkin' && submitCall.body.template_version === 1);
      check('Daily Check-in: a number question\'s answer is submitted as a real number, not a string',
        submitCall.body.answers.overall_feeling === 8 && submitCall.body.answers.symptom_severity === 2);
      check('Daily Check-in: a boolean question\'s "Yes" selection is submitted as the real boolean true',
        submitCall.body.answers.took_medication === true);
      check('Daily Check-in: a string question\'s answer is submitted verbatim',
        submitCall.body.answers.notes === 'feeling good today');

      const statusText = await page.textContent('#checkInStatus');
      check('Daily Check-in: a successful submission shows a friendly confirmation message', statusText.indexOf('Logged') !== -1);

      await context.close();
    }

    // ---- 4. Submission failure keeps the form's in-progress values (no silent reset) ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {
        submitResult: { status: 'error', data: null, error: { code: 'FOUNDATION_INVALID_INPUT', message: 'You are not currently assigned this check-in template.' } }
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#checkInForm');

      await page.fill('#ci_overall_feeling', '5');
      await page.fill('#ci_symptom_severity', '5');
      await page.selectOption('#ci_took_medication', 'no');
      await page.click('#checkInSubmitBtn');
      await page.waitForSelector('#checkInStatus.err');

      const statusText = await page.textContent('#checkInStatus');
      check('Daily Check-in: a rejected submission surfaces the server\'s own friendly error message',
        statusText.indexOf('not currently assigned') !== -1);
      const overallValue = await page.inputValue('#ci_overall_feeling');
      check('Daily Check-in: a rejected submission keeps the patient\'s in-progress answers in place (no silent form.reset())', overallValue === '5');

      await context.close();
    }

    // ---- 5. Recent-response summary renders from the template's own question labels ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {
        checkinResponses: [responseRow('r1', '2026-07-11T09:00:00.000Z', { overall_feeling: 7, symptom_severity: 3, took_medication: true })]
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#checkInSummary');
      await page.waitForFunction(() => {
        const el = document.getElementById('checkInSummary');
        return el && el.textContent.indexOf('Last checked in') !== -1;
      });

      const summaryText = await page.textContent('#checkInSummary');
      check('Daily Check-in: the recent-response summary names the response date', summaryText.indexOf('2026-07-11') !== -1);
      check('Daily Check-in: the summary renders the template\'s own question label, not the raw field_key',
        summaryText.indexOf('How are you feeling today, overall?') !== -1);
      check('Daily Check-in: a boolean answer displays as "Yes"/"No", not "true"/"false"',
        summaryText.indexOf('Yes') !== -1 && summaryText.indexOf('true') === -1);
      const historyLink = await page.getAttribute('#checkInSummary a', 'href');
      check('Daily Check-in: the summary links to the full check-in history page', historyLink === '../my-health-journey/checkins/');

      await context.close();
    }

    // ---- 6. Disabled module -> no Daily Check-in card at all (registry-driven, unchanged discipline) ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('daily_checkin', false)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#dashEmptyState');

      const card = await page.$('#card-daily_checkin-body');
      check('Daily Check-in: a patient with the module disabled sees no Daily Check-in card at all — PXP-4\'s fail-closed discipline applies unchanged to the new module', card === null);

      await context.close();
    }

    // ---- 7. Full history page renders every response, generically, from its own field_keys ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.route('**/macros/s/**/exec', async (route) => {
        let body = {};
        try { body = JSON.parse(route.request().postData()); } catch (e) { /* not JSON */ }
        if (body.foundation_action === 'get_profile') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROFILE_ENVELOPE) });
          return;
        }
        if (body.foundation_action === 'get_checkin_responses') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
            status: 'ok', data: [
              responseRow('r2', '2026-07-12T09:00:00.000Z', { overall_feeling: 9, symptom_severity: 1, took_medication: true, notes: 'great day' }),
              responseRow('r1', '2026-07-11T09:00:00.000Z', { overall_feeling: 4, symptom_severity: 6, took_medication: false })
            ]
          }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_UNKNOWN_ACTION', message: 'Unknown request.' } }) });
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/checkins/`);
      await page.waitForSelector('.tl-item');

      const items = await page.$$('.tl-item');
      check('Check-In History: renders one list item per response', items.length === 2);
      const firstItemText = await page.textContent('.tl-item');
      check('Check-In History: the newest response (2026-07-12) renders first', firstItemText.indexOf('2026-07-12') !== -1);
      check('Check-In History: a field_key like "overall_feeling" is humanized into "Overall Feeling"',
        firstItemText.indexOf('Overall Feeling') !== -1);
      check('Check-In History: a boolean answer displays as "Yes", not "true"',
        firstItemText.indexOf('Yes') !== -1 && firstItemText.indexOf('true') === -1);

      await context.close();
    }

    // ---- 8. Empty history -> the shared "No entries yet" empty state ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.route('**/macros/s/**/exec', async (route) => {
        let body = {};
        try { body = JSON.parse(route.request().postData()); } catch (e) { /* not JSON */ }
        if (body.foundation_action === 'get_profile') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROFILE_ENVELOPE) });
          return;
        }
        if (body.foundation_action === 'get_checkin_responses') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: [] }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_UNKNOWN_ACTION', message: 'Unknown request.' } }) });
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/checkins/`);
      await page.waitForSelector('.badge-nodata');

      const emptyText = await page.textContent('#ciContent');
      check('Check-In History: zero responses shows the shared "No entries yet" empty state', emptyText.indexOf('No entries yet') !== -1);

      await context.close();
    }

  } finally {
    await browser.close();
    server.close();
  }

  console.log('');
  console.log(`${passCount + failCount} checks run, ${failCount} failed.`);
  if (failCount > 0) {
    console.log('FAIL');
    process.exit(1);
  }
  console.log('PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
