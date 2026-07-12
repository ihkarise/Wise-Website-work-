/**
 * Browser-driven verification for Batch WPI-5 — the Appointments capability
 * (doctor-dashboard/dashboard.js's new registry-driven Appointments card,
 * backed by this batch's new get_doctor_appointments route). Mirrors
 * validation/wpi-4-doctor-dashboard/browser-test.js's discipline exactly: a
 * local static server + headless Chromium (Playwright), the backend mocked
 * at the network layer, external font requests blocked for speed/
 * determinism.
 *
 * Covers only this batch's own new surface (the Appointments card's own
 * render/empty states, and that it participates correctly in loader
 * dispatch alongside patient_roster). The pre-existing Doctor Dashboard
 * mechanism (per-doctor enablement, empty dashboard, fail-closed session
 * handling, sign-out, patient_roster's own rendering) is still fully
 * covered by validation/wpi-4-doctor-dashboard/, unchanged by this batch —
 * mirroring the PXP-4/pxp-5-checkin-engine split precedent exactly.
 *
 * No apps-script/*.gs file is exercised by this suite — the backend's own
 * get_doctor_appointments route (specialty derivation, patient-name
 * enrichment, cross-identity-type rejection, Appointment.gs's own create/
 * confirm/status-transition lifecycle) is
 * validation/phase-2a-foundation/conformance.js's Stage 21, added in this
 * same batch, not duplicated here.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/wpi-5-appointment/browser-test.js
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

const FAKE_TOKEN = 'fake-doctor-session-token-for-wpi5-tests';

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

// Fixture rows shaped exactly like get_doctor_appointments's own return
// shape (Appointment.gs's foundationGetDoctorAppointments_()).
function appointmentEntry(overrides) {
  return Object.assign({
    appointment_id: 'a1',
    patient_id: 'p1',
    patient_full_name: 'Dawn Appointment',
    doctor_id: '',
    requested_at: '2026-07-16T00:00:00.000Z',
    scheduled_at: '',
    status: 'requested',
    condition_slug: 'mcas',
    specialty_slug: 'homeopathy'
  }, overrides || {});
}

async function mockFoundation(page, opts) {
  const options = Object.assign({
    profileEnvelope: PROFILE_ENVELOPE,
    moduleStatesEnvelope: null,
    moduleStates: [],
    appointmentsEnvelope: null,
    appointments: []
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
    if (action === 'get_doctor_appointments') {
      const envelope = options.appointmentsEnvelope
        || { status: 'ok', data: options.appointments };
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
    // ---- 1. appointments enabled, zero entries -> the card's own "nodata" empty state ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('appointments', true)], appointments: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-appointments-body .badge-nodata');

      const emptyText = await page.textContent('#card-appointments-body');
      check('Doctor Dashboard: an empty Appointments view shows the card\'s own "no appointments" empty state, not an error',
        emptyText.indexOf('No appointments have been requested') !== -1);

      await context.close();
    }

    // ---- 2. appointments enabled, with real entries -> the card renders them ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {
        moduleStates: [stateRow('appointments', true)],
        appointments: [
          appointmentEntry({ appointment_id: 'a1', patient_full_name: 'Dawn Appointment', condition_slug: 'mcas', status: 'requested', scheduled_at: '' }),
          appointmentEntry({ appointment_id: 'a2', patient_id: '', patient_full_name: '', condition_slug: 'eczema', status: 'confirmed', scheduled_at: '2026-07-20T10:00:00.000Z' })
        ]
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-appointments-body:not(:has(.skeleton))');

      const cardTitles = await page.$$eval('.dash-card h2', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: the enabled Appointments capability renders exactly one card', cardTitles.length === 1 && cardTitles[0] === 'Appointments');

      const names = await page.$$eval('#card-appointments-body .roster-name', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: a linked appointment shows its patient\'s own full_name', names[0] === 'Dawn Appointment');
      check('Doctor Dashboard: an unlinked (first-time-visitor) appointment shows a friendly fallback, not a blank name',
        names[1] === 'Not yet linked to a patient record');

      const details = await page.$$eval('#card-appointments-body .roster-conditions', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: a requested appointment with no scheduled_at shows "Not yet scheduled"',
        details[0].indexOf('Requested') !== -1 && details[0].indexOf('Not yet scheduled') !== -1);
      check('Doctor Dashboard: a confirmed appointment shows its real scheduled_at',
        details[1].indexOf('Confirmed') !== -1 && details[1].indexOf('2026-07-20T10:00:00.000Z') !== -1);

      await context.close();
    }

    // ---- 3. Both patient_roster and appointments enabled -> both cards render, both loaders fire exactly once ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, {
        moduleStates: [stateRow('patient_roster', true), stateRow('appointments', true)],
        appointments: []
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-appointments-body .badge-nodata');

      const cardTitles = await page.$$eval('.dash-card h2', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: both enabled capabilities render, in display_order (Patient Roster, then Appointments)',
        cardTitles.length === 2 && cardTitles[0] === 'Patient Roster' && cardTitles[1] === 'Appointments');

      const appointmentsCalls = calls.filter((a) => a === 'get_doctor_appointments').length;
      const rosterCalls = calls.filter((a) => a === 'get_doctor_patient_roster').length;
      check('Doctor Dashboard: get_doctor_appointments (the Appointments capability\'s registered data_source) is called exactly once', appointmentsCalls === 1);
      check('Doctor Dashboard: get_doctor_patient_roster still fires exactly once alongside it — no interference between the two capabilities\' own loaders', rosterCalls === 1);

      await context.close();
    }

    // ---- 4. appointments disabled -> no Appointments card at all (registry-driven, fail-closed discipline unchanged) ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { moduleStates: [stateRow('appointments', false)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dashEmptyState');

      const card = await page.$('#card-appointments-body');
      check('Doctor Dashboard: a doctor with the Appointments capability disabled sees no Appointments card at all', card === null);

      const appointmentsCalls = calls.filter((a) => a === 'get_doctor_appointments').length;
      check('Doctor Dashboard: get_doctor_appointments is never called when the capability is disabled', appointmentsCalls === 0);

      await context.close();
    }

    // ---- 5. Pure-function unit check: appointmentsHtml() against window.WiseDoctorDashboard ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('appointments', false)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dashEmptyState');

      // Updated at Batch WPI-7 (docs/50 §10/§19): the hand-ported registry
      // now carries a third entry, `inventory`. Updated again at Batch WPI-8
      // (docs/50 §11/§19): a fourth entry, `pillfill_orders` — mechanical,
      // disclosed updates to this assertion's own stale count each time,
      // mirroring the same update validation/wpi-4-doctor-dashboard/
      // browser-test.js already received in each of those same changes.
      const registryLength = await page.evaluate(() => window.WiseDoctorDashboard.DOCTOR_MODULE_REGISTRY.length);
      check('Doctor Dashboard: the hand-ported DOCTOR_MODULE_REGISTRY now carries nine entries (patient_roster, appointments, inventory, pillfill_orders, analytics, ai_assistant, holoscan_review, medication_history, milestone_review)', registryLength === 9);

      const html = await page.evaluate(() => window.WiseDoctorDashboard.appointmentsHtml([]));
      check('Doctor Dashboard: appointmentsHtml([]) returns the "nodata" empty state directly, matching the live rendering above',
        html.indexOf('No appointments have been requested') !== -1);

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
