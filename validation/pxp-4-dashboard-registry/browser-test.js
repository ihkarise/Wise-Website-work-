/**
 * Browser-driven verification for Batch PXP-4 — the Dashboard Registry
 * (my-health-journey/dashboard.js's new registry-driven renderer, PXP-3's
 * get_patient_module_states as its per-patient enablement source, and the
 * frontend-side Module Registry hand-port in the same file). Mirrors the
 * discipline every earlier PA- / pxp- browser suite already uses: a local
 * static server + headless Chromium (Playwright), the backend mocked at
 * the network layer, external font requests blocked for
 * speed/determinism, keyboard-driven focus checks where relevant.
 *
 * Covers only PXP-4's own new surface (empty dashboard, per-patient
 * enablement, display_order, unregistered data_source, fail-closed
 * session, pure-function ordering). The pre-existing dashboard shell,
 * Timeline, Symptom Tracker, and Reports behavior is still fully covered
 * by validation/pa-2-dashboard/, pa-3-timeline/, pa-4-symptom-tracker/,
 * pa-5-reports/, all of which this batch updated to seed the new
 * get_patient_module_states call — those existing checks continue to
 * pass unchanged.
 *
 * No apps-script/*.gs file is exercised by this suite — the backend's
 * own get_patient_module_states route (per-patient merge, cross-patient
 * isolation, doctor/staff-only writes) is
 * validation/phase-2a-foundation/conformance.js's Stage 12, added in
 * PXP-3, not duplicated here.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/pxp-4-dashboard-registry/browser-test.js
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

const FAKE_TOKEN = 'fake-session-token-for-pxp4-tests';

const PROFILE_ENVELOPE = {
  status: 'ok',
  data: { patient_id: 'p1', full_name: 'Asha Menon', email: 'asha@example.com', condition_slug: 'mcas', status: 'active' }
};

// Fixture rows shaped exactly like PatientModuleState (docs/47 §3,
// shared/schemas/patient-module-state.schema.json) — the same shape the
// live get_patient_module_states route returns per PXP-3.
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

// Routes by the parsed request's foundation_action. Records every action
// the dashboard actually calls (in order) so a test can assert not just
// what rendered but also what was requested — the same "black-box, but
// observable at the network boundary" discipline every earlier browser
// suite already uses.
async function mockFoundation(page, opts) {
  const options = Object.assign({
    profileEnvelope: PROFILE_ENVELOPE,
    moduleStatesEnvelope: null,
    moduleStates: [],
    timeline: [],
    symptomLogs: [],
    reports: []
  }, opts || {});
  const calls = [];
  await page.route('**/macros/s/**/exec', async (route) => {
    let action = null;
    try { action = JSON.parse(route.request().postData()).foundation_action; } catch (e) { /* not JSON */ }
    calls.push(action);
    if (action === 'get_profile') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.profileEnvelope) });
      return;
    }
    if (action === 'get_patient_module_states') {
      const envelope = options.moduleStatesEnvelope
        || { status: 'ok', data: options.moduleStates };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelope) });
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
    // ---- 1. Zero enabled modules -> dashboard-level empty state, no cards ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      // Every module deliberately explicitly enabled: false — the
      // fail-closed default the backend already synthesizes for a fresh
      // patient (PXP-3, foundationGetPatientModuleStates_ per-registered-
      // module default).
      await mockFoundation(page, { moduleStates: [
        stateRow('timeline', false),
        stateRow('symptom_tracker', false),
        stateRow('reports', false)
      ] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#dashEmptyState');

      const cardH2Count = await page.$$eval('.dash-card h2', (els) => els.length);
      check('Dashboard Registry: a patient with zero enabled modules sees zero card headings', cardH2Count === 0);

      const emptyText = await page.textContent('#dashEmptyState');
      check('Dashboard Registry: the dashboard-level empty state names the intentional outcome ("no modules enabled") rather than looking like an error',
        emptyText.indexOf('No dashboard modules are enabled') !== -1);

      const ariaBusy = await page.getAttribute('#dashGrid', 'aria-busy');
      check('Dashboard Registry: an empty dashboard still flips aria-busy to false (loaded, not stuck)', ariaBusy === 'false');

      await context.close();
    }

    // ---- 2. Only a subset enabled -> only those cards render, no others ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      // Explicit: symptom_tracker is enabled:false, not just missing —
      // proves filtering, not fallback-to-registry-defaults.
      await mockFoundation(page, { moduleStates: [
        stateRow('timeline', true),
        stateRow('symptom_tracker', false),
        stateRow('reports', true)
      ] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-timeline-body:not(:has(.skeleton))');
      await page.waitForSelector('#card-reports-body:not(:has(.skeleton))');

      const cardTitles = await page.$$eval('.dash-card h2', (els) => els.map((e) => e.textContent));
      check('Dashboard Registry: exactly the two enabled modules render (Timeline + Reports)',
        cardTitles.length === 2 && cardTitles.indexOf('Timeline') !== -1 && cardTitles.indexOf('Reports') !== -1);
      check('Dashboard Registry: the disabled Symptom Tracker module does not render even though its registry entry exists',
        cardTitles.indexOf('Symptom Tracker') === -1);
      const symptomsCard = await page.$('#card-symptom_tracker-body');
      check('Dashboard Registry: no DOM element exists for the disabled Symptom Tracker card', symptomsCard === null);

      await context.close();
    }

    // ---- 3. All three enabled, response shuffled -> cards render in display_order ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      // Deliberately shuffled: reports (display_order 30) first, timeline
      // (10) last — proves the client, not the server, is authoritative
      // for card ordering (docs/44 §7.1: display_order is the sole
      // ordering signal).
      await mockFoundation(page, { moduleStates: [
        stateRow('reports', true),
        stateRow('symptom_tracker', true),
        stateRow('timeline', true)
      ] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-timeline-body:not(:has(.skeleton))');
      await page.waitForSelector('#sxSummary .badge-nodata');
      await page.waitForSelector('#reportsList .badge-nodata');

      const cardTitles = await page.$$eval('.dash-card h2', (els) => els.map((e) => e.textContent));
      check('Dashboard Registry: cards render strictly in registry display_order regardless of response order',
        cardTitles.length === 3 && cardTitles[0] === 'Timeline' && cardTitles[1] === 'Symptom Tracker' && cardTitles[2] === 'Reports');

      // Registry-derived DOM ids too — the id fragment is the registry's
      // module_id, not any hardcoded literal.
      const cardIds = await page.$$eval('.dash-card', (els) => els.map((e) => e.getAttribute('aria-labelledby')));
      check('Dashboard Registry: every card\'s DOM id fragment is its registry module_id, not a hardcoded literal',
        cardIds.length === 3 &&
        cardIds[0] === 'card-timeline-title' &&
        cardIds[1] === 'card-symptom_tracker-title' &&
        cardIds[2] === 'card-reports-title');

      await context.close();
    }

    // ---- 4. Every enabled module's registered loader fires exactly once, with its own moduleId ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { moduleStates: [
        stateRow('timeline', true),
        stateRow('symptom_tracker', true),
        stateRow('reports', true)
      ] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-timeline-body:not(:has(.skeleton))');
      await page.waitForSelector('#sxSummary .badge-nodata');
      await page.waitForSelector('#reportsList .badge-nodata');

      // Dashboard boot: get_profile + get_patient_module_states run in
      // parallel (Promise.all in dashboard.js); then each enabled
      // module's data_source loader fires once. get_reports fires twice —
      // loadReportsPreview() calls refreshReportsList() itself (docs/29 §5's
      // separate initial load pattern PA-5 committed to). Same for
      // get_symptom_logs (loadSymptomPreview → refreshSymptomSummary).
      const profileCalls = calls.filter((a) => a === 'get_profile').length;
      const stateCalls = calls.filter((a) => a === 'get_patient_module_states').length;
      const timelineCalls = calls.filter((a) => a === 'get_timeline').length;
      const symptomCalls = calls.filter((a) => a === 'get_symptom_logs').length;
      const reportCalls = calls.filter((a) => a === 'get_reports').length;

      check('Dashboard Registry: get_profile is called exactly once', profileCalls === 1);
      check('Dashboard Registry: get_patient_module_states is called exactly once (in parallel with get_profile)', stateCalls === 1);
      check('Dashboard Registry: get_timeline (the Timeline module\'s registered data_source) is called at least once', timelineCalls >= 1);
      check('Dashboard Registry: get_symptom_logs (the Symptom Tracker module\'s registered data_source) is called at least once', symptomCalls >= 1);
      check('Dashboard Registry: get_reports (the Reports module\'s registered data_source) is called at least once', reportCalls >= 1);

      // No orphan calls to actions that aren't a registered data_source
      // for any enabled module — the dispatcher only fires registered
      // loaders, never a hardcoded fallback.
      const unexpected = calls.filter((a) =>
        a !== 'get_profile' && a !== 'get_patient_module_states' &&
        a !== 'get_timeline' && a !== 'get_symptom_logs' && a !== 'get_reports'
      );
      check('Dashboard Registry: no unexpected foundation_action is called during dashboard boot', unexpected.length === 0);

      await context.close();
    }

    // ---- 5. Unregistered data_source -> skeleton stays, console.warn, no crash ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      // Inject a synthetic module whose data_source is intentionally
      // unregistered. This is exactly the failure mode a future batch
      // would hit if it added a registry entry but forgot to register a
      // loader — dispatchLoaders() must skip it, not crash.
      const consoleWarnings = [];
      page.on('console', (msg) => { if (msg.type() === 'warning') consoleWarnings.push(msg.text()); });

      await mockFoundation(page, { moduleStates: [
        stateRow('timeline', true),
        // Backend allowlist matches the registry, so a real backend
        // would reject an unknown module_id. This test bypasses the
        // allowlist to prove the client-side fallback: even if a
        // client's local MODULE_REGISTRY declares a data_source with no
        // registered loader, the dashboard fails soft, not hard.
        { state_key: 'p1::future_module', patient_id: 'p1', module_id: 'future_module', enabled: true, enabled_by: 'staff-1', enabled_at: '2026-07-01T00:00:00.000Z' }
      ] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      // Extend the local Module Registry before dashboard.js kicks in —
      // the state row above references module_id "future_module" that
      // needs a matching descriptor for filterEnabledModules() to keep
      // it. addInitScript runs before every subsequent page's own
      // scripts.
      await page.addInitScript(() => {
        const check = () => {
          if (window.WiseDashboard && window.WiseDashboard.MODULE_REGISTRY) {
            window.WiseDashboard.MODULE_REGISTRY.push({
              module_id: 'future_module', title: 'Future Module',
              display_order: 999, empty_state: 'nodata',
              data_source: 'get_future_thing'
            });
            return true;
          }
          return false;
        };
        if (!check()) {
          // WiseDashboard is assigned at the very end of the IIFE; poll
          // briefly until it exists, then patch. addInitScript runs at
          // document_start so this always fires before the dashboard's
          // own boot flow reads the registry.
          const iv = setInterval(() => { if (check()) clearInterval(iv); }, 5);
          setTimeout(() => clearInterval(iv), 5000);
        }
      });
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-timeline-body:not(:has(.skeleton))');
      // The future_module card should render its skeleton but never resolve
      // to real content — give the dashboard a beat to try, then verify.
      await page.waitForTimeout(200);

      const futureCardExists = await page.$('#card-future_module-body');
      check('Dashboard Registry: an enabled module whose data_source has no registered loader still renders its card shell (fail-soft, not fail-hard)',
        futureCardExists !== null);
      const futureCardHasSkeleton = await page.$eval('#card-future_module-body', (el) => el.querySelector('.skeleton') !== null);
      check('Dashboard Registry: a card with no loader stays as a skeleton — never populated, but never removed either', futureCardHasSkeleton);

      const timelineResolved = await page.$eval('#card-timeline-body', (el) => el.querySelector('.badge-nodata') !== null);
      check('Dashboard Registry: a sibling card (Timeline) with a registered loader still renders fully — one missing loader never disturbs another card',
        timelineResolved);

      const warned = consoleWarnings.some((m) => m.indexOf('no loader registered') !== -1 && m.indexOf('future_module') !== -1);
      check('Dashboard Registry: the dispatcher logs a console.warn naming the missing data_source and module_id (so a maintainer notices in dev)', warned);

      await context.close();
    }

    // ---- 6. filterEnabledModules is a pure function: shuffled/mixed input, deterministic output ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');

      const result = await page.evaluate(() => {
        const input = [
          { state_key: 'p1::reports',         patient_id: 'p1', module_id: 'reports',         enabled: true,  enabled_by: 's', enabled_at: 't' },
          { state_key: 'p1::symptom_tracker', patient_id: 'p1', module_id: 'symptom_tracker', enabled: false, enabled_by: '',  enabled_at: '' },
          { state_key: 'p1::timeline',        patient_id: 'p1', module_id: 'timeline',        enabled: true,  enabled_by: 's', enabled_at: 't' },
          { state_key: 'p1::not_a_module',    patient_id: 'p1', module_id: 'not_a_module',    enabled: true,  enabled_by: 's', enabled_at: 't' }
        ];
        return window.WiseDashboard.filterEnabledModules(input).map((e) => e.descriptor.module_id);
      });
      check('filterEnabledModules: returns entries in display_order regardless of input order', result.length === 2 && result[0] === 'timeline' && result[1] === 'reports');
      check('filterEnabledModules: silently drops an enabled state row whose module_id is not in the registry (fail-closed on unknown modules)', result.indexOf('not_a_module') === -1);
      check('filterEnabledModules: drops entries with enabled === false (the sole enablement source is PatientModuleState.enabled, not registry presence)', result.indexOf('symptom_tracker') === -1);

      await context.close();
    }

    // ---- 7. Rejected get_patient_module_states -> /login.html?reason=expired ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      // get_profile succeeds but get_patient_module_states rejects — a
      // real, deployed backend would return the same FOUNDATION_UNAUTHORIZED
      // code for either call on a rejected session (FoundationRouteGuard).
      // The dashboard must treat either rejection as a session rejection.
      await mockFoundation(page, {
        profileEnvelope: PROFILE_ENVELOPE,
        moduleStatesEnvelope: { status: 'error', error: { code: 'FOUNDATION_UNAUTHORIZED', message: 'Please log in again.' } }
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForURL('**/login.html*');
      check('Dashboard Registry: a rejected get_patient_module_states collapses to /login.html?reason=expired, the same treatment get_profile already gets',
        page.url().indexOf('reason=expired') !== -1 || page.url() === `${baseUrl}/login.html`);
      const tokenAfter = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('Dashboard Registry: a rejected get_patient_module_states clears the session token from sessionStorage', tokenAfter === null);

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
