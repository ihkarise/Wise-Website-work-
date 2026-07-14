/**
 * Browser-driven verification for Batch WPI-9 — the Analytics capability
 * (doctor-dashboard/dashboard.js's new registry-driven Analytics card,
 * backed by this batch's new get_doctor_analytics route). Mirrors
 * validation/wpi-8-pillfill/browser-test.js's discipline exactly: a local
 * static server + headless Chromium (Playwright), the backend mocked at
 * the network layer, external font requests blocked for speed/determinism.
 *
 * Covers only this batch's own new surface (the Analytics card's own
 * render of a real, non-empty report and an all-zero report, and that it
 * participates correctly in loader dispatch alongside patient_roster/
 * appointments/inventory/pillfill_orders). The pre-existing Doctor
 * Dashboard mechanism (per-doctor enablement, empty dashboard, fail-closed
 * session handling, sign-out) is still fully covered by
 * validation/wpi-4-doctor-dashboard/, unchanged by this batch — mirroring
 * the wpi-4/wpi-5/wpi-7/wpi-8 split precedent exactly.
 *
 * No apps-script/*.gs file is exercised by this suite — the backend's own
 * get_doctor_analytics route (specialty scoping reused from
 * DoctorPatientRoster.gs/InventoryItem.gs/PillFillOrder.gs, the fixed
 * trailing 30-day window, and every report section's own aggregation
 * math) is validation/phase-2a-foundation/conformance.js's Stage 25, added
 * in this same batch, not duplicated here. Unlike every prior WPI card,
 * Analytics has no "empty list" state — a report is always a real object,
 * even when every count in it is zero — so this suite covers an all-zero
 * report and a real, non-zero report instead of an empty-vs-populated
 * list pair.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/wpi-9-analytics/browser-test.js
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

const FAKE_TOKEN = 'fake-doctor-session-token-for-wpi9-tests';

const PROFILE_ENVELOPE = {
  status: 'ok',
  data: { doctor_id: 'd1', full_name: 'Dr. Asha Rao', role: 'physician', email: 'asha@example.com', specialty_slug: 'homeopathy', status: 'active' }
};

function stateRow(capabilityKey, enabled) {
  return {
    state_key: 'd1::' + capabilityKey,
    doctor_id: 'd1',
    capability_key: capabilityKey,
    enabled: enabled,
    enabled_by: enabled ? 'staff-1' : '',
    enabled_at: enabled ? '2026-07-16T00:00:00.000Z' : ''
  };
}

// Fixture shaped exactly like get_doctor_analytics's own return shape
// (Analytics.gs's foundationGetAnalyticsForDoctor_()). An all-zero report
// (every count 0) is just as real a report as a populated one — Analytics
// never returns an empty list to check against.
function allZeroReportFixture() {
  return {
    window: { from: '2026-06-16T00:00:00.000Z', to: '2026-07-16T00:00:00.000Z' },
    specialty_slug: 'homeopathy',
    check_in_completion: { total_check_ins: 0, distinct_patients_checked_in: 0, completion_rate: 0 },
    care_plan_activity: { total_plan_versions: 0, active_plan_versions: 0, superseded_plan_versions: 0 },
    calculator_engagement: { total_results: 0, distinct_patients_engaged: 0, results_by_calculator_slug: {} },
    inventory_turnover: { total_transactions: 0, dispensed_quantity: 0, restocked_quantity: 0 },
    pillfill_fulfillment: { total_orders: 0, fulfilled_or_later: 0, fulfillment_rate: 0 },
    appointment_conversion: { total_appointments: 0, by_status: { requested: 0, confirmed: 0, completed: 0, cancelled: 0 }, completion_rate: 0 }
  };
}

function realReportFixture() {
  return {
    window: { from: '2026-06-16T00:00:00.000Z', to: '2026-07-16T00:00:00.000Z' },
    specialty_slug: 'homeopathy',
    check_in_completion: { total_check_ins: 12, distinct_patients_checked_in: 4, completion_rate: 0.5 },
    care_plan_activity: { total_plan_versions: 3, active_plan_versions: 2, superseded_plan_versions: 1 },
    calculator_engagement: { total_results: 7, distinct_patients_engaged: 3, results_by_calculator_slug: { bmi: 5, thyroid_risk: 2 } },
    inventory_turnover: { total_transactions: 6, dispensed_quantity: 40, restocked_quantity: 100 },
    pillfill_fulfillment: { total_orders: 4, fulfilled_or_later: 3, fulfillment_rate: 0.75 },
    appointment_conversion: { total_appointments: 8, by_status: { requested: 1, confirmed: 2, completed: 5, cancelled: 0 }, completion_rate: 0.625 }
  };
}

async function mockFoundation(page, opts) {
  const options = Object.assign({
    profileEnvelope: PROFILE_ENVELOPE,
    moduleStatesEnvelope: null,
    moduleStates: [],
    analyticsEnvelope: null,
    analyticsReport: null
  }, opts || {});
  const calls = [];
  await page.route('**/macros/s/**/exec', async (route) => {
    let action = null;
    try { action = JSON.parse(route.request().postData()).foundation_action; } catch (e) { /* not JSON */ }
    calls.push(action);
    if (action === 'get_doctor_profile') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.profileEnvelope) });
      return;
    }
    if (action === 'get_doctor_module_states') {
      const envelope = options.moduleStatesEnvelope
        || { status: 'ok', data: options.moduleStates };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelope) });
      return;
    }
    if (action === 'get_doctor_analytics') {
      const envelope = options.analyticsEnvelope
        || { status: 'ok', data: options.analyticsReport };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelope) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_UNKNOWN_ACTION', message: 'Unknown request.' } }) });
  });
  return calls;
}

async function withSessionToken(page, baseUrl, token) {
  await page.goto(`${baseUrl}/doctor-login.html`);
  await page.evaluate((t) => window.sessionStorage.setItem('wise_doctor_session_token', t), token);
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
    // ---- 1. analytics enabled, an all-zero report -> real counts (all zero), never a "nodata" badge ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('analytics', true)], analyticsReport: allZeroReportFixture() });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-analytics-body:not(:has(.skeleton))');

      const bodyText = await page.textContent('#card-analytics-body');
      check('Doctor Dashboard: an all-zero Analytics report renders its own real, zeroed-out summary — not the "nodata" empty-state badge',
        bodyText.indexOf('badge-nodata') === -1 && bodyText.indexOf('Check-in completion') !== -1 && bodyText.indexOf('0 check-in(s)') !== -1);

      const noDataBadge = await page.$('#card-analytics-body .badge-nodata');
      check('Doctor Dashboard: an all-zero Analytics report does not trigger the generic empty-state badge (Analytics has no "empty list" state)', noDataBadge === null);

      await context.close();
    }

    // ---- 2. analytics enabled, a real, non-zero report -> every section's own numbers render ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('analytics', true)], analyticsReport: realReportFixture() });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-analytics-body:not(:has(.skeleton))');

      const cardTitles = await page.$$eval('.dash-card h2', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: the enabled Analytics capability renders exactly one card', cardTitles.length === 1 && cardTitles[0] === 'Analytics');

      const rowLabels = await page.$$eval('#card-analytics-body .roster-name', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: the Analytics card renders one row per report section (check-in, care plan, calculator, inventory, pillfill, appointment)',
        rowLabels.length === 6 &&
        rowLabels[0].indexOf('Check-in completion') !== -1 &&
        rowLabels[1].indexOf('Care plan activity') !== -1 &&
        rowLabels[2].indexOf('Calculator engagement') !== -1 &&
        rowLabels[3].indexOf('Inventory turnover') !== -1 &&
        rowLabels[4].indexOf('PillFill fulfillment') !== -1 &&
        rowLabels[5].indexOf('Appointment conversion') !== -1);

      const rowDetails = await page.$$eval('#card-analytics-body .roster-conditions', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: check_in_completion row shows its own real counts and rounded completion percentage',
        rowDetails[0].indexOf('12 check-in(s)') !== -1 && rowDetails[0].indexOf('4') !== -1 && rowDetails[0].indexOf('50%') !== -1);
      check('Doctor Dashboard: inventory_turnover row shows its own real dispensed/restocked counts',
        rowDetails[3].indexOf('40 dispensed') !== -1 && rowDetails[3].indexOf('100 restocked') !== -1);
      check('Doctor Dashboard: appointment_conversion row shows its own real completed/total counts and rounded conversion percentage',
        rowDetails[5].indexOf('5 of 8 completed') !== -1 && rowDetails[5].indexOf('63%') !== -1);

      await context.close();
    }

    // ---- 3. All five capabilities enabled -> all five cards render, all five loaders fire exactly once ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, {
        moduleStates: [stateRow('patient_roster', true), stateRow('appointments', true), stateRow('inventory', true), stateRow('pillfill_orders', true), stateRow('analytics', true)],
        analyticsReport: allZeroReportFixture()
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-analytics-body:not(:has(.skeleton))');

      const cardTitles = await page.$$eval('.dash-card h2', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: all five enabled capabilities render, in display_order (Patient Roster, Appointments, Inventory, PillFill Orders, then Analytics)',
        cardTitles.length === 5 && cardTitles[0] === 'Patient Roster' && cardTitles[1] === 'Appointments' && cardTitles[2] === 'Inventory' &&
        cardTitles[3] === 'PillFill Orders' && cardTitles[4] === 'Analytics');

      const analyticsCalls = calls.filter((a) => a === 'get_doctor_analytics').length;
      const pillfillCalls = calls.filter((a) => a === 'get_pillfill_orders').length;
      const inventoryCalls = calls.filter((a) => a === 'get_inventory_items').length;
      const appointmentsCalls = calls.filter((a) => a === 'get_doctor_appointments').length;
      const rosterCalls = calls.filter((a) => a === 'get_doctor_patient_roster').length;
      check('Doctor Dashboard: get_doctor_analytics (the Analytics capability\'s registered data_source) is called exactly once', analyticsCalls === 1);
      check('Doctor Dashboard: get_pillfill_orders still fires exactly once alongside it — no interference between capabilities\' own loaders', pillfillCalls === 1);
      check('Doctor Dashboard: get_inventory_items still fires exactly once alongside it too', inventoryCalls === 1);
      check('Doctor Dashboard: get_doctor_appointments still fires exactly once alongside it too', appointmentsCalls === 1);
      check('Doctor Dashboard: get_doctor_patient_roster still fires exactly once alongside it too', rosterCalls === 1);

      await context.close();
    }

    // ---- 4. analytics disabled -> no Analytics card at all (registry-driven, fail-closed discipline unchanged) ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { moduleStates: [stateRow('analytics', false)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dashEmptyState');

      const card = await page.$('#card-analytics-body');
      check('Doctor Dashboard: a doctor with the Analytics capability disabled sees no Analytics card at all', card === null);

      const analyticsCalls = calls.filter((a) => a === 'get_doctor_analytics').length;
      check('Doctor Dashboard: get_doctor_analytics is never called when the capability is disabled', analyticsCalls === 0);

      await context.close();
    }

    // ---- 5. Pure-function unit checks: analyticsHtml() and the registry, against window.WiseDoctorDashboard ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('analytics', false)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dashEmptyState');

      const registryLength = await page.evaluate(() => window.WiseDoctorDashboard.DOCTOR_MODULE_REGISTRY.length);
      check('Doctor Dashboard: the hand-ported DOCTOR_MODULE_REGISTRY now carries ten entries (patient_roster, appointments, inventory, pillfill_orders, analytics, ai_assistant, holoscan_review, medication_history, milestone_review, digital_twin_review)', registryLength === 10);

      const nullHtml = await page.evaluate(() => window.WiseDoctorDashboard.analyticsHtml(null));
      check('Doctor Dashboard: analyticsHtml(null) returns the "nodata" empty state directly — the one defensive branch a real report envelope never reaches',
        nullHtml.indexOf('badge-nodata') !== -1);

      const realHtml = await page.evaluate((report) => window.WiseDoctorDashboard.analyticsHtml(report), realReportFixture());
      check('Doctor Dashboard: analyticsHtml() called directly against a real report matches the live rendering above',
        realHtml.indexOf('Check-in completion') !== -1 && realHtml.indexOf('12 check-in(s)') !== -1);

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
