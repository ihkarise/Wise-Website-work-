/**
 * Browser-driven verification for Batch WPI-4 — the Doctor Dashboard
 * (doctor-dashboard/dashboard.js's registry-driven renderer, WPI-3's
 * get_doctor_module_states as its per-doctor enablement source, and this
 * batch's own new get_doctor_patient_roster capability). Mirrors the
 * discipline every earlier browser suite already uses (most directly,
 * validation/pxp-4-dashboard-registry/browser-test.js, its exact
 * structural precedent on the patient side): a local static server +
 * headless Chromium (Playwright), the backend mocked at the network
 * layer, external font requests blocked for speed/determinism.
 *
 * Covers only this batch's own new surface (doctor-dashboard/, doctor-
 * login.html, doctor-verify.html): empty dashboard, per-doctor enablement,
 * the one patient_roster card's own render/empty states, loader dispatch,
 * fail-closed session handling, and sign-out. The backend's own
 * get_doctor_patient_roster route (roster derivation, cross-identity-type
 * rejection) is validation/phase-2a-foundation/conformance.js's Stage 20,
 * not duplicated here.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/wpi-4-doctor-dashboard/browser-test.js
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

const FAKE_TOKEN = 'fake-doctor-session-token-for-wpi4-tests';

const PROFILE_ENVELOPE = {
  status: 'ok',
  data: { doctor_id: 'd1', full_name: 'Dr. Asha Rao', role: 'physician', email: 'asha@example.com', specialty_slug: 'homeopathy', status: 'active' }
};

// Fixture rows shaped exactly like DoctorModuleState (docs/50 §7.2,
// shared/schemas/doctor-module-state.schema.json) — the same shape the
// live get_doctor_module_states route returns per WPI-3.
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

function rosterEntry(patientId, fullName, conditionSlugs) {
  return { patient_id: patientId, full_name: fullName, condition_slugs: conditionSlugs };
}

// Routes by the parsed request's foundation_action. Records every action
// the dashboard actually calls (in order) so a test can assert not just
// what rendered but also what was requested.
async function mockFoundation(page, opts) {
  const options = Object.assign({
    profileEnvelope: PROFILE_ENVELOPE,
    moduleStatesEnvelope: null,
    moduleStates: [],
    rosterEnvelope: null,
    roster: []
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
    if (action === 'get_doctor_patient_roster') {
      const envelope = options.rosterEnvelope
        || { status: 'ok', data: options.roster };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelope) });
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
    // ---- 1. No session token at all -> immediate redirect to doctor-login.html, no fetch ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, {});
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#loginForm');
      check('Doctor Dashboard: a missing session token redirects straight to doctor-login.html', page.url().indexOf('doctor-login.html') !== -1);
      check('Doctor Dashboard: no foundation_action is ever called when there is no session token', calls.length === 0);
      await context.close();
    }

    // ---- 2. Zero enabled capabilities -> dashboard-level empty state, no cards ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      // The fail-closed default the backend already synthesizes for a
      // fresh doctor (WPI-3, foundationGetDoctorModuleStates_ per-
      // registered-capability default).
      await mockFoundation(page, { moduleStates: [stateRow('patient_roster', false)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#dashEmptyState');

      const cardH2Count = await page.$$eval('.dash-card h2', (els) => els.length);
      check('Doctor Dashboard: a doctor with zero enabled capabilities sees zero card headings', cardH2Count === 0);

      const emptyText = await page.textContent('#dashEmptyState');
      check('Doctor Dashboard: the dashboard-level empty state names the intentional outcome ("no capabilities enabled") rather than looking like an error',
        emptyText.indexOf('No dashboard capabilities are enabled') !== -1);

      const ariaBusy = await page.getAttribute('#dashGrid', 'aria-busy');
      check('Doctor Dashboard: an empty dashboard still flips aria-busy to false (loaded, not stuck)', ariaBusy === 'false');

      const greetingText = await page.textContent('#greeting');
      check('Doctor Dashboard: the greeting shows the doctor\'s own full_name from get_doctor_profile', greetingText.indexOf('Dr. Asha Rao') !== -1);

      await context.close();
    }

    // ---- 3. patient_roster enabled, with real roster entries -> the card renders them ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {
        moduleStates: [stateRow('patient_roster', true)],
        roster: [
          rosterEntry('p1', 'Alice Roster', ['mcas']),
          rosterEntry('p2', 'Carol Roster', ['mcas', 'allergic-rhinitis'])
        ]
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-patient_roster-body:not(:has(.skeleton))');

      const cardTitles = await page.$$eval('.dash-card h2', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: the enabled Patient Roster capability renders exactly one card', cardTitles.length === 1 && cardTitles[0] === 'Patient Roster');

      const rosterNames = await page.$$eval('.roster-name', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: both roster entries render, in the order the backend returned them',
        rosterNames.length === 2 && rosterNames[0] === 'Alice Roster' && rosterNames[1] === 'Carol Roster');

      const conditionsText = await page.textContent('.roster-conditions');
      check('Doctor Dashboard: the first entry\'s matching condition_slugs render as a joined list',
        conditionsText.indexOf('mcas') !== -1);

      await context.close();
    }

    // ---- 4. patient_roster enabled, zero roster entries -> the card's own "nodata" empty state ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('patient_roster', true)], roster: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-patient_roster-body .badge-nodata');

      const emptyText = await page.textContent('#card-patient_roster-body');
      check('Doctor Dashboard: an empty roster shows the card\'s own "no patients" empty state, not an error',
        emptyText.indexOf('No patients are currently assigned') !== -1);

      await context.close();
    }

    // ---- 5. Loader dispatch: get_doctor_profile + get_doctor_module_states run in parallel; get_doctor_patient_roster fires once for the one enabled capability ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { moduleStates: [stateRow('patient_roster', true)], roster: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-patient_roster-body .badge-nodata');

      const profileCalls = calls.filter((a) => a === 'get_doctor_profile').length;
      const stateCalls = calls.filter((a) => a === 'get_doctor_module_states').length;
      const rosterCalls = calls.filter((a) => a === 'get_doctor_patient_roster').length;

      check('Doctor Dashboard: get_doctor_profile is called exactly once', profileCalls === 1);
      check('Doctor Dashboard: get_doctor_module_states is called exactly once (in parallel with get_doctor_profile)', stateCalls === 1);
      check('Doctor Dashboard: get_doctor_patient_roster (the Patient Roster capability\'s registered data_source) is called exactly once', rosterCalls === 1);

      const unexpected = calls.filter((a) => a !== 'get_doctor_profile' && a !== 'get_doctor_module_states' && a !== 'get_doctor_patient_roster');
      check('Doctor Dashboard: no unexpected foundation_action is called during dashboard boot', unexpected.length === 0);

      await context.close();
    }

    // ---- 6. A rejected get_doctor_module_states redirects to doctor-login.html?reason=expired and clears the session token ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {
        moduleStatesEnvelope: { status: 'error', data: null, error: { code: 'FOUNDATION_UNAUTHORIZED', message: 'Please log in again.' } }
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#loginForm');
      // doctor-login.html's own script strips ?reason=expired from the
      // visible URL via history.replaceState() almost immediately after
      // reading it (mirrors login.html's own hygiene step) — so the query
      // string may already be gone by the time this check runs. Accepting
      // either the pre-strip or post-strip URL is the same permissive
      // check validation/pxp-4-dashboard-registry/browser-test.js's own
      // analogous "rejected get_patient_module_states" assertion already
      // uses for this exact race.
      check('Doctor Dashboard: a rejected get_doctor_module_states collapses to doctor-login.html?reason=expired',
        page.url().indexOf('reason=expired') !== -1 || page.url() === `${baseUrl}/doctor-login.html`);

      const tokenAfter = await page.evaluate(() => window.sessionStorage.getItem('wise_doctor_session_token'));
      check('Doctor Dashboard: a rejected get_doctor_module_states clears the session token from sessionStorage', tokenAfter === null);

      await context.close();
    }

    // ---- 7. Sign out clears the token and returns to doctor-login.html ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('patient_roster', false)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dashEmptyState');

      await page.click('#signOutBtn');
      await page.waitForSelector('#loginForm');
      check('Doctor Dashboard: clicking "Sign out" navigates to doctor-login.html', page.url().indexOf('doctor-login.html') !== -1);

      const tokenAfter = await page.evaluate(() => window.sessionStorage.getItem('wise_doctor_session_token'));
      check('Doctor Dashboard: signing out clears the session token from sessionStorage', tokenAfter === null);

      await context.close();
    }

    // ---- 8. Keyboard accessibility: the sign-out control has a visible focus outline ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('patient_roster', false)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dashEmptyState');

      await page.evaluate(() => document.getElementById('signOutBtn').focus());
      const outlineStyle = await page.evaluate(() => window.getComputedStyle(document.getElementById('signOutBtn'), null).outlineStyle);
      check('Doctor Dashboard: keyboard-focused sign-out control has a visible focus outline', outlineStyle !== 'none');

      await context.close();
    }

    // ---- 9. Pure-function unit checks against window.WiseDoctorDashboard, mirroring window.WiseDashboard's own precedent ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('patient_roster', false)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dashEmptyState');

      // Updated at Batch WPI-5 (docs/50 §8/§19): DOCTOR_MODULE_REGISTRY now
      // carries two entries (patient_roster, appointments). Updated again at
      // Batch WPI-7 (docs/50 §10/§19): a third entry, inventory. Updated
      // again at Batch WPI-8 (docs/50 §11/§19): a fourth entry,
      // pillfill_orders — mechanical, disclosed updates to this batch's own
      // stale factual count each time, mirroring
      // validation/phase-2a-foundation/conformance.js's Stage19 own
      // precedent for updating an earlier stage's count when a later batch
      // adds a registry entry. This suite's remaining assertions (empty
      // dashboard, patient_roster rendering/empty-state, loader dispatch,
      // fail-closed session handling, sign-out) are untouched, still
      // WPI-4's own scope.
      const registryLength = await page.evaluate(() => window.WiseDoctorDashboard.DOCTOR_MODULE_REGISTRY.length);
      check('Doctor Dashboard: the hand-ported DOCTOR_MODULE_REGISTRY carries exactly five entries (patient_roster, appointments, inventory, pillfill_orders, analytics, as of Batch WPI-9)', registryLength === 5);

      const filterResult = await page.evaluate(() => {
        var stateEntries = [
          { state_key: 'd1::patient_roster', doctor_id: 'd1', capability_key: 'patient_roster', enabled: true, enabled_by: 'staff-1', enabled_at: '2026-07-16T00:00:00.000Z' },
          { state_key: 'd1::unregistered_capability', doctor_id: 'd1', capability_key: 'unregistered_capability', enabled: true, enabled_by: 'staff-1', enabled_at: '2026-07-16T00:00:00.000Z' }
        ];
        return window.WiseDoctorDashboard.filterEnabledCapabilities(stateEntries).map(function (e) { return e.descriptor.capability_key; });
      });
      check('Doctor Dashboard: filterEnabledCapabilities() keeps only entries with a matching registry descriptor (fail-closed on an unregistered capability_key)',
        filterResult.length === 1 && filterResult[0] === 'patient_roster');

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
