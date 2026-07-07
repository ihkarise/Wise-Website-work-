/**
 * Browser-driven verification for Batch PA-2 — the "My Health Journey"
 * dashboard shell plus the small login.html/verify.html/assets/site.css
 * changes this batch also makes. Mirrors PA-1's own testing discipline
 * (docs/29 §16): a local static server + headless Chromium (Playwright),
 * the backend mocked at the network layer (route interception), keyboard-
 * driven focus checks (a real Tab keypress, not a simulated .focus() call).
 *
 * No apps-script/*.gs file is touched by this batch — this suite verifies
 * frontend behavior only. Backend regression coverage remains
 * validation/phase-1-5/validate.js and validation/phase-2a-foundation/
 * conformance.js, both re-run unchanged for this batch (docs/29 §16 note).
 *
 * Updated (not just re-run) in Batch PA-4, the same way Batch PA-3 already
 * updated this file for the Timeline card's own wiring: mockGetProfile()
 * now also routes get_symptom_logs (the Symptom Tracker card's new
 * loadSymptomPreview() call), phase2aCount drops from 2 to 1 (Reports is
 * now the only remaining "Coming later in Phase 2A" placeholder), and
 * nodataCount rises from 1 to 2 (Timeline and Symptom Tracker each render
 * their own real "No data yet" badge). The Symptom Tracker card's own
 * quick-log form behavior (submit/success/error) is
 * validation/pa-4-symptom-tracker/browser-test.js's own coverage, not
 * duplicated here.
 *
 * Updated again in Batch PA-5: mockGetProfile() now also routes
 * get_reports (the Reports card's new loadReportsPreview() call);
 * phase2aCount drops from 1 to 0 (Reports was the last remaining "Coming
 * later in Phase 2A" placeholder — every dashboard card now shows real
 * data or an explicit "planned for a future version" state); nodataCount
 * rises from 2 to 3 (Reports renders its own real "No data yet" badge
 * alongside its always-present upload form, the same "write affordance is
 * the card's primary content" pattern PA-4 already established for
 * Symptom Tracker). The Reports card's own upload-form/download behavior
 * is validation/pa-5-reports/browser-test.js's own coverage, not
 * duplicated here.
 *
 * Updated again in Batch PXP-4 (Dashboard Registry, docs/44 §7.3/§13,
 * ADR-012 (amended), docs/47 §3): the dashboard is now a registry-driven
 * consumer of PXP-3's PatientModuleState + Module Registry. Every card
 * now corresponds to a registry entry the patient is enabled for; there
 * are no hardcoded "future" cards. mockFoundation() therefore also
 * routes get_patient_module_states, seeded with all three seeded registry
 * modules enabled for the "renders all cards" test. Assertions updated
 * from "renders all six expected cards" (Timeline / Symptom Tracker /
 * Reports plus the three now-removed hardcoded placeholders Care Plan /
 * Messages / Digital Twin) to "renders exactly three registry-driven
 * cards"; futureCount drops from 3 to 0 (docs/47 §4: a not-yet-built
 * module is not pre-declared in the registry by an earlier batch guessing
 * its shape, so it does not render at all until its own batch adds it).
 * The Symptom Tracker card's DOM id fragment is now its registry
 * module_id ("symptom_tracker"), not the pre-PXP-4 literal "symptoms".
 * The dedicated PXP-4 suite validation/pxp-4-dashboard-registry/
 * browser-test.js covers the registry-driven surface directly (empty
 * dashboard, ordering, missing loader) — not duplicated here.
 *
 * Run: node validation/pa-2-dashboard/browser-test.js
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

// A minimal fake session token — its shape doesn't matter, since the backend
// is mocked at the network layer for every case in this suite.
const FAKE_TOKEN = 'fake-session-token-for-tests';

// Batch PA-3 wired the dashboard's Timeline card to a real, separate
// get_timeline call (dashboard.js's loadTimelinePreview()); Batch PA-4 adds
// the same kind of separate call for the Symptom Tracker card
// (loadSymptomPreview()/get_symptom_logs); Batch PA-5 adds one more for the
// Reports card (loadReportsPreview()/get_reports); Batch PXP-4 makes the
// whole dashboard registry-driven and adds one more call for the merged
// PatientModuleState rows (get_patient_module_states, PXP-3). This mock
// routes by the parsed request's foundation_action so each gets a
// realistic response rather than being silently mismatched against
// whatever envelope a given test passed in for get_profile.
// log_symptom/upload_report are not needed by this suite's own tests —
// the Symptom Tracker's and Reports' own write-affordance behavior is
// validation/pa-4-symptom-tracker/'s and validation/pa-5-reports/'s own
// coverage, respectively. The default moduleStates seeded here (all three
// seeded registry modules enabled) mirrors the pre-PXP-4 behavior every
// existing dashboard test relied on — a test that needs a different
// enablement mix can pass its own list.
const ALL_MODULES_ENABLED = [
  { state_key: 'p1::timeline',        patient_id: 'p1', module_id: 'timeline',        enabled: true, enabled_by: 'staff-1', enabled_at: '2026-07-01T00:00:00.000Z' },
  { state_key: 'p1::symptom_tracker', patient_id: 'p1', module_id: 'symptom_tracker', enabled: true, enabled_by: 'staff-1', enabled_at: '2026-07-01T00:00:00.000Z' },
  { state_key: 'p1::reports',         patient_id: 'p1', module_id: 'reports',         enabled: true, enabled_by: 'staff-1', enabled_at: '2026-07-01T00:00:00.000Z' }
];

async function mockGetProfile(page, envelope, moduleStates) {
  const states = moduleStates || ALL_MODULES_ENABLED;
  await page.route('**/macros/s/**/exec', async (route) => {
    let action = null;
    try { action = JSON.parse(route.request().postData()).foundation_action; } catch (e) { /* not JSON — fall through */ }
    if (action === 'get_patient_module_states') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: states }) });
      return;
    }
    if (action === 'get_timeline') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: [] }) });
      return;
    }
    if (action === 'get_symptom_logs') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: [] }) });
      return;
    }
    if (action === 'get_reports') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: [] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelope) });
  });
}

// dashboard.js checks sessionStorage synchronously on load and redirects
// immediately if it's empty — an evaluate() call issued after goto() always
// loses that race, and addInitScript re-injects the token on every
// subsequent navigation too (which would silently undo a real removal, e.g.
// sign-out or a rejected-session redirect). Instead: load any same-origin
// page first to get a JS context, set sessionStorage there once, then
// navigate — sessionStorage persists across same-origin navigations in the
// same tab without being re-injected.
async function withSessionToken(page, baseUrl, token) {
  await page.goto(`${baseUrl}/login.html`);
  await page.evaluate((t) => window.sessionStorage.setItem('wise_session_token', t), token);
}

// Every page under test preconnects to Google Fonts. This sandbox has no
// route to the public internet, so those requests would otherwise hang until
// Chromium's navigation timeout on every single page load in this suite —
// blocking them at the browser level keeps the suite fast and deterministic
// without touching any page's real markup.
async function blockExternalFonts(context) {
  await context.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await context.route('https://fonts.gstatic.com/**', (route) => route.abort());
}

async function main() {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  try {
    // ---- 1. No session token -> dashboard redirects to /login.html ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForURL('**/login.html');
      check('Dashboard: no sessionStorage token redirects to /login.html', page.url() === `${baseUrl}/login.html`);
      await context.close();
    }

    // ---- 2. Valid session -> dashboard renders greeting + three registry-driven cards ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockGetProfile(page, {
        status: 'ok',
        data: { patient_id: 'p1', full_name: 'Asha Menon', email: 'asha@example.com', condition_slug: 'mcas', status: 'active' }
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      // Batch PA-3: the Timeline card resolves via its own, separate
      // get_timeline call (dashboard.js's loadTimelinePreview()); Batch PA-4:
      // the Symptom Tracker card similarly resolves via get_symptom_logs
      // (loadSymptomPreview()). Batch PXP-4: the DOM id fragment for the
      // Symptom Tracker card is now its registry module_id
      // ("symptom_tracker"), not the pre-PXP-4 literal "symptoms".
      await page.waitForSelector('#card-timeline-body:not(:has(.skeleton))');
      await page.waitForSelector('#sxSummary .badge-nodata');
      await page.waitForSelector('#reportsList .badge-nodata');

      const greetingText = await page.textContent('#greeting');
      check('Dashboard: greeting shows the real patient name from get_profile', greetingText.indexOf('Asha Menon') !== -1);

      // Batch PXP-4: exactly three cards now — one per seeded registry
      // module, ordered by display_order (Timeline 10, Symptom Tracker 20,
      // Reports 30). Care Plan / Messages / Digital Twin are not in the
      // Module Registry (docs/47 §4: a not-yet-built module is not
      // pre-declared by an earlier batch) so they no longer render.
      const cardTitles = await page.$$eval('.dash-card h2', (els) => els.map((e) => e.textContent));
      check('Dashboard: renders exactly three registry-driven cards for a fully enabled patient (Timeline / Symptom Tracker / Reports)',
        cardTitles.length === 3 &&
        cardTitles[0] === 'Timeline' && cardTitles[1] === 'Symptom Tracker' && cardTitles[2] === 'Reports');

      const phase2aCount = await page.$$eval('.badge-phase2a', (els) => els.length);
      const futureCount = await page.$$eval('.badge-future', (els) => els.length);
      const nodataCount = await page.$$eval('.badge-nodata', (els) => els.length);
      check('Dashboard: zero "Coming later in Phase 2A" placeholders remain — Reports (PA-5) was the last one (Timeline PA-3, Symptom Tracker PA-4 were wired earlier)', phase2aCount === 0);
      check('Dashboard: zero "Planned for a future version" placeholders remain — PXP-4 removed the three hardcoded future cards (Care Plan/Messages/Digital Twin); a future module will re-appear via its own registry entry, not a hardcoded call in dashboard.js', futureCount === 0);
      check('Dashboard: Timeline, Symptom Tracker, and Reports cards each render their own real "No data yet" badge for a patient with zero rows (PA-3/PA-4/PA-5)',
        nodataCount === 3);
      const timelineBadgeParent = await page.$eval('#card-timeline-body', (el) => el.querySelector('.badge-nodata') !== null);
      check('Dashboard: the Timeline card carries its own "No data yet" badge', timelineBadgeParent);
      const symptomsBadgeParent = await page.$eval('#card-symptom_tracker-body', (el) => el.querySelector('.badge-nodata') !== null);
      check('Dashboard: the Symptom Tracker card (now keyed by registry module_id "symptom_tracker") carries its own "No data yet" badge (PA-4/PXP-4)', symptomsBadgeParent);
      const symptomFormPresent = await page.$eval('#card-symptom_tracker-body', (el) => el.querySelector('#symptomForm') !== null);
      check('Dashboard: the Symptom Tracker card still shows its quick-log form alongside the empty summary (docs/41 §2: write affordance is the card\'s primary content)', symptomFormPresent);
      const reportsBadgeParent = await page.$eval('#card-reports-body', (el) => el.querySelector('.badge-nodata') !== null);
      check('Dashboard: the Reports card carries its own "No data yet" badge (PA-5)', reportsBadgeParent);
      const reportFormPresent = await page.$eval('#card-reports-body', (el) => el.querySelector('#reportForm') !== null);
      check('Dashboard: the Reports card still shows its upload form alongside the empty list (docs/29 §5: write affordance is the card\'s primary content)', reportFormPresent);
      const reportFileLabelFor = await page.getAttribute('#card-reports-body label', 'for');
      check('Dashboard: the Reports upload field has a real, associated <label for>', reportFileLabelFor === 'reportFile');

      // Direct function check too (not just the real render above) — the
      // 'nodata' variant now has a real card consumer (Timeline, PA-3), but
      // this still confirms the underlying formatter is correct in
      // isolation, independent of which card happens to use it.
      const nodataHtml = await page.evaluate(() => window.WiseDashboard.emptyStateHtml('nodata', 'test message'));
      check('Dashboard: the "No data yet" empty-state formatter itself is correct',
        nodataHtml.indexOf('badge-nodata') !== -1 && nodataHtml.indexOf('No entries yet') !== -1 && nodataHtml.indexOf('test message') !== -1);
      // The pre-PXP-4 'future' variant remains built and verified as a
      // pure formatter (still exported on window.WiseDashboard) even
      // though PXP-4 removed the last live card consumer — the same
      // "built, verified, awaiting a future consumer" discipline
      // 'phase2a' has followed since Batch PA-5.
      const futureHtml = await page.evaluate(() => window.WiseDashboard.emptyStateHtml('future', 'planned copy'));
      check('Dashboard: the "future" empty-state formatter still renders the approved wording ("Planned for a future version") for a future consumer to reuse',
        futureHtml.indexOf('badge-future') !== -1 && futureHtml.indexOf('Planned for a future version') !== -1 && futureHtml.indexOf('planned copy') !== -1);

      const ariaBusy = await page.getAttribute('#dashGrid', 'aria-busy');
      check('Dashboard: grid aria-busy flips to false once loaded', ariaBusy === 'false');

      await context.close();
    }

    // ---- 3. Rejected session -> redirect to /login.html?reason=expired, message shown ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockGetProfile(page, { status: 'error', error: { code: 'FOUNDATION_UNAUTHORIZED', message: 'Please log in again.' } });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForURL('**/login.html*');

      check('Dashboard: rejected session redirects to /login.html with reason=expired',
        page.url().indexOf('reason=expired') !== -1 || page.url() === `${baseUrl}/login.html`);

      // login.html strips the query param and shows the approved copy.
      await page.waitForSelector('#statusBox.warn');
      const statusText = await page.textContent('#statusBox');
      check('Login: session-expiry message matches the approved copy exactly',
        statusText === 'For your privacy, your secure session has ended. Please sign in again.');
      const urlAfter = new URL(page.url());
      check('Login: the reason query param is stripped from the visible URL', urlAfter.search === '');

      const tokenAfterRejection = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('Dashboard: the rejected session token is cleared from sessionStorage', tokenAfterRejection === null);

      await context.close();
    }

    // ---- 4. Sign out clears session and redirects ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockGetProfile(page, {
        status: 'ok',
        data: { patient_id: 'p1', full_name: 'Asha Menon', email: 'asha@example.com', condition_slug: 'mcas', status: 'active' }
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.click('#signOutBtn');
      await page.waitForURL('**/login.html');
      check('Dashboard: sign out redirects to /login.html', page.url() === `${baseUrl}/login.html`);
      const tokenAfterSignOut = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('Dashboard: sign out clears the session token', tokenAfterSignOut === null);
      await context.close();
    }

    // ---- 5. Network failure keeps token and shows a friendly, non-technical error ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.route('**/macros/s/**/exec', (route) => route.abort('failed'));
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('.dash-grid p.sub');
      const errorText = await page.textContent('.dash-grid p.sub');
      check('Dashboard: network failure shows a friendly, non-technical message', errorText.indexOf('Could not reach the server') !== -1);
      const tokenKept = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('Dashboard: network failure does not clear the session token', tokenKept === FAKE_TOKEN);
      await context.close();
    }

    // ---- 6. Responsive: no horizontal overflow at 375px ----
    {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockGetProfile(page, {
        status: 'ok',
        data: { patient_id: 'p1', full_name: 'Asha Menon', email: 'asha@example.com', condition_slug: 'mcas', status: 'active' }
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-timeline-body:not(:has(.skeleton))');
      await page.waitForSelector('#sxSummary .badge-nodata');
      await page.waitForSelector('#reportsList .badge-nodata');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('Dashboard: zero horizontal overflow at 375px viewport', overflow === 0);
      await context.close();

      const loginContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await blockExternalFonts(loginContext);
      const loginPage = await loginContext.newPage();
      await loginPage.goto(`${baseUrl}/login.html`);
      const loginOverflow = await loginPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('Login: zero horizontal overflow at 375px viewport (after site.css extraction)', loginOverflow === 0);

      const verifyContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await blockExternalFonts(verifyContext);
      const verifyPage = await verifyContext.newPage();
      await verifyPage.goto(`${baseUrl}/verify.html?token=abc123`);
      const verifyOverflow = await verifyPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('Verify: zero horizontal overflow at 375px viewport (after site.css extraction)', verifyOverflow === 0);
    }

    // ---- 7. Accessibility: skip link, heading hierarchy, keyboard focus visibility ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockGetProfile(page, {
        status: 'ok',
        data: { patient_id: 'p1', full_name: 'Asha Menon', email: 'asha@example.com', condition_slug: 'mcas', status: 'active' }
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-timeline-body:not(:has(.skeleton))');
      await page.waitForSelector('#sxSummary .badge-nodata');
      await page.waitForSelector('#reportsList .badge-nodata');

      const h1Count = await page.$$eval('h1', (els) => els.length);
      check('Dashboard: exactly one h1 on the page', h1Count === 1);
      const h2Count = await page.$$eval('h2', (els) => els.length);
      check('Dashboard: exactly one h2 per card (three total — one per enabled registry module, per PXP-4)', h2Count === 3);

      const skipHref = await page.getAttribute('a.skip', 'href');
      check('Dashboard: skip-to-content link targets #main', skipHref === '#main');
      const mainId = await page.getAttribute('main', 'id');
      check('Dashboard: <main id="main"> exists as the skip-link target', mainId === 'main');

      // Real keyboard Tab navigation (not a simulated .focus() call), same
      // discipline PA-1 used to catch its own focus-visible regression.
      // Updated for Batch PXP-1's one disclosed addition to this header
      // (docs/44 §17, shared/schemas/patient-profile.md): the "My Profile"
      // link is now the first interactive control after the skip link,
      // ahead of the sign-out button. Updated again for Batch PXP-8's own
      // disclosed addition (shared/schemas/trusted-device.md's "No Module
      // Registry entry" section): the "Manage Devices" link now sits
      // between "My Profile" and the sign-out button — a mechanical,
      // disclosed consequence of this batch's one new nav link, the same
      // category of test-infrastructure update PXP-5's own Stage 12
      // module-count fix already established (docs/47 §4).
      await page.keyboard.press('Tab'); // skip link
      await page.keyboard.press('Tab'); // My Profile link (Batch PXP-1)
      await page.keyboard.press('Tab'); // Manage Devices link (Batch PXP-8)
      await page.keyboard.press('Tab'); // sign-out button
      const focusedIsSignOut = await page.evaluate(() => document.activeElement.id === 'signOutBtn');
      check('Dashboard: keyboard Tab reaches the sign-out control', focusedIsSignOut);
      const outlineStyle = await page.evaluate(() => getComputedStyle(document.activeElement, null).outlineStyle);
      check('Dashboard: keyboard-focused sign-out control has a visible focus outline', outlineStyle !== 'none');

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
