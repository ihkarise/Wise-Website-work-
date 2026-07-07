/**
 * Browser-driven verification for Batch PXP-7 — the Personal Care Plan
 * capability (my-health-journey/dashboard.js's new registry-driven Care
 * Plan card, and my-health-journey/care-plan/index.html's full-detail
 * page). Mirrors validation/pxp-5-checkin-engine/browser-test.js's
 * discipline exactly: a local static server + headless Chromium
 * (Playwright), the backend mocked at the network layer, external font
 * requests blocked for speed/determinism.
 *
 * Covers only PXP-7's own new surface (unauthored-plan state, the
 * dashboard card's read-only preview, the full-detail page's plan summary
 * + instruction history). The pre-existing Dashboard Registry mechanism
 * (per-patient enablement, display_order, empty dashboard, unregistered
 * data_source fail-soft) is still fully covered by
 * validation/pxp-4-dashboard-registry/, unchanged by this batch.
 *
 * No apps-script/*.gs file is exercised by this suite — the backend's own
 * get_care_plan/get_doctor_instructions routes (versioning/supersession,
 * care_plan_id ownership validation, one-way instruction status
 * transitions, cross-patient isolation) are
 * validation/phase-2a-foundation/conformance.js's Stage 15, added in this
 * same batch, not duplicated here.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/pxp-7-care-plan-engine/browser-test.js
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

const FAKE_TOKEN = 'fake-session-token-for-pxp7-tests';

const PROFILE_ENVELOPE = {
  status: 'ok',
  data: { patient_id: 'p1', full_name: 'Asha Menon', email: 'asha@example.com', condition_slug: 'mcas', status: 'active' }
};

function carePlanRow(version, goals, nextReviewDate, status) {
  return {
    version_key: 'cp1::' + version, care_plan_id: 'cp1', patient_id: 'p1', version: version,
    status: status || 'active', goals: goals, next_review_date: nextReviewDate || '',
    created_by: 'dr-rao', created_at: '2026-07-01T00:00:00.000Z'
  };
}

function instructionRow(id, carePlanId, type, content, effectiveDate, status) {
  return {
    instruction_id: id, patient_id: 'p1', care_plan_id: carePlanId, consultation_id: '',
    instruction_type: type, content: content, prescribed_by: 'dr-rao',
    effective_date: effectiveDate, status: status || 'active'
  };
}

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

// Routes by the parsed request's foundation_action. The same "black-box,
// but observable at the network boundary" discipline every earlier browser
// suite already uses.
async function mockFoundation(page, opts) {
  const options = Object.assign({
    profileEnvelope: PROFILE_ENVELOPE,
    moduleStates: [stateRow('care_plan', true)],
    carePlanEnvelope: { status: 'ok', data: null },
    instructions: [],
    timeline: [], symptomLogs: [], reports: [], checkinResponses: []
  }, opts || {});
  await page.route('**/macros/s/**/exec', async (route) => {
    let body = {};
    try { body = JSON.parse(route.request().postData()); } catch (e) { /* not JSON */ }
    const action = body.foundation_action;
    if (action === 'get_profile') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.profileEnvelope) });
      return;
    }
    if (action === 'get_patient_module_states') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: options.moduleStates }) });
      return;
    }
    if (action === 'get_care_plan') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.carePlanEnvelope) });
      return;
    }
    if (action === 'get_doctor_instructions') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: options.instructions }) });
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
    if (action === 'get_checkin_responses') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: options.checkinResponses }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_UNKNOWN_ACTION', message: 'Unknown request.' } }) });
  });
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
    // ---- 1. Enabled module, no plan authored yet -> "not created yet" state ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { carePlanEnvelope: { status: 'ok', data: null } });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-care_plan-body');

      const bodyText = await page.textContent('#card-care_plan-body');
      check('Care Plan: an enabled module with no plan authored yet shows the "hasn\'t created a care plan" message, not an error',
        bodyText.indexOf("hasn't created a care plan") !== -1);
      const linkExists = await page.$('#card-care_plan-body a');
      check('Care Plan: no "view full plan" link renders when there is no plan to view', linkExists === null);

      await context.close();
    }

    // ---- 2. Authored plan -> a short, truncated preview with a link to the full page ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const longGoals = 'Reduce flare frequency to under once per month. '.repeat(4);
      await mockFoundation(page, {
        carePlanEnvelope: { status: 'ok', data: carePlanRow(2, longGoals, '2026-09-01') }
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#card-care_plan-body a');

      const bodyText = await page.textContent('#card-care_plan-body');
      check('Care Plan: the dashboard preview shows a truncated version of the goals text, not the full plan',
        bodyText.indexOf('…') !== -1 && bodyText.indexOf(longGoals.trim()) === -1);
      check('Care Plan: the dashboard preview shows the next review date', bodyText.indexOf('2026-09-01') !== -1);
      const historyLink = await page.getAttribute('#card-care_plan-body a', 'href');
      check('Care Plan: the preview links to the full care plan page', historyLink === '../my-health-journey/care-plan/');
      check('Care Plan: the dashboard card never renders the instruction list itself (summary only)',
        (await page.$$('#card-care_plan-body .tl-item')).length === 0);

      await context.close();
    }

    // ---- 3. Disabled module -> no Care Plan card at all (registry-driven, unchanged discipline) ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('care_plan', false)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#dashEmptyState');

      const card = await page.$('#card-care_plan-body');
      check('Care Plan: a patient with the module disabled sees no Care Plan card at all — PXP-4\'s fail-closed discipline applies unchanged to the new module', card === null);

      await context.close();
    }

    // ---- 4. Full-detail page renders the plan summary and every instruction ----
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
        if (body.foundation_action === 'get_care_plan') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: carePlanRow(2, 'Follow elimination diet. Taper antihistamines.', '2026-09-01') }) });
          return;
        }
        if (body.foundation_action === 'get_doctor_instructions') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
            status: 'ok', data: [
              instructionRow('i2', 'cp1', 'lifestyle', 'Avoid known trigger foods for 8 weeks.', '2026-07-10', 'active'),
              instructionRow('i1', 'cp1', 'medicine', 'Arsenicum album 30C, twice daily.', '2026-07-07', 'completed')
            ]
          }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_UNKNOWN_ACTION', message: 'Unknown request.' } }) });
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/care-plan/`);
      await page.waitForSelector('.tl-item');

      const summaryText = await page.textContent('.cp-summary');
      check('Care Plan History: the plan summary shows the full, untruncated goals text',
        summaryText.indexOf('Follow elimination diet. Taper antihistamines.') !== -1);
      check('Care Plan History: the plan summary shows the current version number', summaryText.indexOf('Version 2') !== -1);
      check('Care Plan History: the plan summary shows the next review date', summaryText.indexOf('2026-09-01') !== -1);

      const items = await page.$$('.tl-item');
      check('Care Plan History: renders one list item per instruction', items.length === 2);
      const firstItemText = await page.textContent('.tl-item');
      check('Care Plan History: the newest instruction (2026-07-10) renders first', firstItemText.indexOf('2026-07-10') !== -1);
      check('Care Plan History: instruction_type is humanized into a readable badge (e.g. "Lifestyle")',
        firstItemText.indexOf('Lifestyle') !== -1);

      const allText = await page.textContent('.tl-track');
      check('Care Plan History: an active instruction is labeled "Active"', allText.indexOf('Active') !== -1);
      check('Care Plan History: a completed instruction is labeled "Completed"', allText.indexOf('Completed') !== -1);
      check('Care Plan History: instruction_type "medicine" is humanized into "Medicine"', allText.indexOf('Medicine') !== -1);

      await context.close();
    }

    // ---- 5. No plan at all -> the shared "No entries yet" empty state ----
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
        if (body.foundation_action === 'get_care_plan') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: null }) });
          return;
        }
        if (body.foundation_action === 'get_doctor_instructions') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: [] }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_UNKNOWN_ACTION', message: 'Unknown request.' } }) });
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/care-plan/`);
      await page.waitForSelector('.badge-nodata');

      const emptyText = await page.textContent('#cpContent');
      check('Care Plan History: no plan at all shows the shared "No entries yet" empty state', emptyText.indexOf('No entries yet') !== -1);

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
