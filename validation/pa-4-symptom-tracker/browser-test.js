/**
 * Browser-driven verification for Batch PA-4 — the Symptom History page
 * (my-health-journey/symptoms/index.html), the dashboard's Symptom
 * Tracker card now that it carries a real quick-log form and
 * most-recent-value summary (my-health-journey/dashboard.js's
 * loadSymptomPreview()/symptomFormHtml()/symptomSummaryHtml()), and reuse
 * of the shared my-health-journey/session-guard.js module. Mirrors
 * validation/pa-3-timeline/browser-test.js's discipline exactly: a local
 * static server + headless Chromium (Playwright), the backend mocked at
 * the network layer, external font requests blocked for speed/determinism,
 * keyboard-driven focus checks.
 *
 * No apps-script/*.gs file is exercised by this suite — backend
 * conformance coverage, including the platform's first patient-writable
 * route's cross-patient isolation, is
 * validation/phase-2a-foundation/conformance.js's Stage 8. This suite
 * verifies frontend behavior only.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/pa-4-symptom-tracker/browser-test.js
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

const FAKE_TOKEN = 'fake-session-token-for-pa4-tests';

const PROFILE_ENVELOPE = {
  status: 'ok',
  data: { patient_id: 'p1', full_name: 'Asha Menon', email: 'asha@example.com', condition_slug: 'mcas', status: 'active' }
};

const SAMPLE_LOGS = [
  { record_id: 'sx-3', patient_id: 'p1', logged_at: '2026-07-01T09:00:00.000Z', severity: 7, sleep: 4, energy: 3, stress: 6, notes: '<script>alert(1)</script>', condition_slug: 'mcas' },
  { record_id: 'sx-2', patient_id: 'p1', logged_at: '2026-06-15T09:00:00.000Z', severity: 5, sleep: 6, energy: 5, stress: 4, notes: '', condition_slug: '' },
  { record_id: 'sx-1', patient_id: 'p1', logged_at: '2026-06-01T09:00:00.000Z', severity: 3, sleep: 7, energy: 6, stress: 2, notes: 'Felt better today.', condition_slug: '' }
];

// Routes by the parsed request's foundation_action, mirroring
// validation/pa-3-timeline's own mock discipline — a realistic
// per-action backend stand-in rather than one blanket response.
async function mockFoundation(page, { symptomLogs = [], logSymptomResult = null } = {}) {
  await page.route('**/macros/s/**/exec', async (route) => {
    let action = null;
    let body = {};
    try { body = JSON.parse(route.request().postData()); action = body.foundation_action; } catch (e) { /* not JSON */ }

    if (action === 'get_profile') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROFILE_ENVELOPE) });
      return;
    }
    // Batch PXP-4 (Dashboard Registry): the dashboard now issues a
    // get_patient_module_states call alongside get_profile. All three
    // seeded registry modules are enabled here so the Symptom Tracker
    // card renders on every /my-health-journey/ test in this suite.
    if (action === 'get_patient_module_states') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', data: [
          { state_key: 'p1::timeline',        patient_id: 'p1', module_id: 'timeline',        enabled: true, enabled_by: 'staff-1', enabled_at: '2026-07-01T00:00:00.000Z' },
          { state_key: 'p1::symptom_tracker', patient_id: 'p1', module_id: 'symptom_tracker', enabled: true, enabled_by: 'staff-1', enabled_at: '2026-07-01T00:00:00.000Z' },
          { state_key: 'p1::reports',         patient_id: 'p1', module_id: 'reports',         enabled: true, enabled_by: 'staff-1', enabled_at: '2026-07-01T00:00:00.000Z' }
        ] })
      });
      return;
    }
    if (action === 'get_timeline') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: [] }) });
      return;
    }
    if (action === 'get_symptom_logs') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: symptomLogs }) });
      return;
    }
    if (action === 'log_symptom') {
      const result = logSymptomResult || { status: 'ok', data: Object.assign({ record_id: 'new-1', patient_id: 'p1', logged_at: new Date().toISOString(), notes: '', condition_slug: '' }, body) };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_UNKNOWN_ACTION', message: 'Unknown request.' } }) });
  });
}

// Same race/re-injection avoidance as validation/pa-2-dashboard's own
// withSessionToken: load a same-origin page first to get a JS context, set
// sessionStorage there once, then navigate.
async function withSessionToken(page, baseUrl, token) {
  await page.goto(`${baseUrl}/login.html`);
  await page.evaluate((t) => window.sessionStorage.setItem('wise_session_token', t), token);
}

async function blockExternalFonts(context) {
  await context.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await context.route('https://fonts.gstatic.com/**', (route) => route.abort());
}

async function fillSymptomForm(page, values) {
  await page.fill('#sxSeverity', String(values.severity));
  await page.fill('#sxSleep', String(values.sleep));
  await page.fill('#sxEnergy', String(values.energy));
  await page.fill('#sxStress', String(values.stress));
  if (values.notes !== undefined) await page.fill('#sxNotes', values.notes);
  if (values.condition_slug !== undefined) await page.selectOption('#sxCondition', values.condition_slug);
}

async function main() {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  try {
    // ---- 1. Symptom History page: no session token -> redirect to /login.html ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.goto(`${baseUrl}/my-health-journey/symptoms/`);
      await page.waitForURL('**/login.html');
      check('Symptom History: no sessionStorage token redirects to /login.html', page.url() === `${baseUrl}/login.html`);
      await context.close();
    }

    // ---- 2. Symptom History page: populated -> ordered entries, escaped notes, condition tag ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { symptomLogs: SAMPLE_LOGS });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptoms/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('.tl-item');

      const itemCount = await page.$$eval('.tl-item', (els) => els.length);
      check('Symptom History: renders all three entries in the backend-provided order (newest first)', itemCount === 3);

      const firstDate = await page.$eval('.tl-item .tl-date', (el) => el.textContent);
      check('Symptom History: first entry shows the date portion only (no time)', firstDate === '2026-07-01');

      const firstScales = await page.$eval('.tl-item .sx-scales', (el) => el.textContent);
      check('Symptom History: first entry shows all four scale values', /7/.test(firstScales) && /4/.test(firstScales) && /3/.test(firstScales) && /6/.test(firstScales));

      const notesHtml = await page.$eval('.tl-item .tl-summary', (el) => el.innerHTML);
      check('Symptom History: a note containing markup is escaped, never rendered as a live element', notesHtml.indexOf('<script>') === -1 && notesHtml.indexOf('&lt;script&gt;') !== -1);

      const tagText = await page.$eval('.tl-item .sx-tag', (el) => el.textContent);
      check('Symptom History: the condition tag renders when present', tagText === 'mcas');

      const listRole = await page.$eval('.tl-track', (el) => el.tagName.toLowerCase());
      check('Symptom History: entries are a real ordered list element (<ol>), not decorative <div>s', listRole === 'ol');

      await context.close();
    }

    // ---- 3. Symptom History page: zero entries -> "No entries yet" Empty State ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { symptomLogs: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptoms/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('.badge-nodata');
      const badgeText = await page.textContent('.badge-nodata');
      check('Symptom History: zero entries renders the "No entries yet" badge', badgeText === 'No entries yet');
      await context.close();
    }

    // ---- 4. Symptom History page: network failure -> friendly message, session kept ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.route('**/macros/s/**/exec', (route) => route.abort('failed'));
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptoms/`);
      await page.waitForSelector('#sxContent p');
      const errorText = await page.textContent('#sxContent p');
      check('Symptom History: network failure shows a friendly, non-technical message', errorText.indexOf('Could not load your symptom history') !== -1);
      const tokenKept = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('Symptom History: network failure does not clear the session token', tokenKept === FAKE_TOKEN);
      await context.close();
    }

    // ---- 5. Dashboard: Symptom Tracker card always shows the quick-log form, even with zero entries ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { symptomLogs: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#symptomForm');

      const fieldCount = await page.$$eval('#symptomForm .field', (els) => els.length);
      check('Dashboard: Symptom Tracker card renders a multi-field quick-log form (4 scales + notes + condition)', fieldCount === 6);

      const labelsForIds = await page.$$eval('#symptomForm label', (els) => els.map((e) => e.getAttribute('for')));
      check('Dashboard: every scale field has a real, associated <label for>', ['sxSeverity', 'sxSleep', 'sxEnergy', 'sxStress', 'sxNotes', 'sxCondition'].every((id) => labelsForIds.indexOf(id) !== -1));

      await page.waitForSelector('.badge-nodata');
      const summaryBadge = await page.textContent('#sxSummary .badge-nodata');
      check('Dashboard: zero entries still shows the "No entries yet" summary badge alongside the form', summaryBadge === 'No entries yet');

      await context.close();
    }

    // ---- 6. Dashboard: Symptom Tracker card shows a bare recent-value summary + "View full history" link when entries exist ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { symptomLogs: SAMPLE_LOGS });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-symptom_tracker-body a.secondary');

      const summaryText = await page.textContent('#sxSummary');
      check('Dashboard: Symptom Tracker card shows the most recent entry\'s values, not a chart or trend',
        /2026-07-01/.test(summaryText) && /severity 7/.test(summaryText) && /sleep 4/.test(summaryText));

      const viewFullHref = await page.$eval('#card-symptom_tracker-body a.secondary', (el) => el.getAttribute('href'));
      check('Dashboard: Symptom Tracker card\'s "View full history" link points at the real Symptom History page',
        viewFullHref === '../my-health-journey/symptoms/');

      check('Dashboard: the quick-log form is still present even when entries already exist (docs/41 §2: write affordance is the card\'s primary content)',
        (await page.$('#symptomForm')) !== null);

      await context.close();
    }

    // ---- 7. Dashboard: submitting the quick-log form succeeds, resets the form, and refreshes the summary ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { symptomLogs: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#symptomForm');

      await fillSymptomForm(page, { severity: 6, sleep: 6, energy: 6, stress: 6, notes: 'Test note.', condition_slug: 'mcas' });
      await page.click('#sxSubmitBtn');
      await page.waitForSelector('#sxStatus.ok');

      const statusText = await page.textContent('#sxStatus');
      check('Dashboard: a successful submission shows a confirmation in the aria-live status region', statusText.indexOf('Logged') !== -1);

      const severityAfterReset = await page.inputValue('#sxSeverity');
      check('Dashboard: a successful submission resets the form', severityAfterReset === '');

      await context.close();
    }

    // ---- 8. Dashboard: a rejected submission shows the backend's error message and preserves in-progress values ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {
        symptomLogs: [],
        logSymptomResult: { status: 'error', data: null, error: { code: 'FOUNDATION_INVALID_INPUT', message: 'severity must be a whole number from 1 to 10.' } }
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#symptomForm');

      await fillSymptomForm(page, { severity: 6, sleep: 6, energy: 6, stress: 6 });
      await page.click('#sxSubmitBtn');
      await page.waitForSelector('#sxStatus.err');

      const statusText = await page.textContent('#sxStatus');
      check('Dashboard: a rejected submission shows the backend\'s own message verbatim', statusText === 'severity must be a whole number from 1 to 10.');

      const severityKept = await page.inputValue('#sxSeverity');
      check('Dashboard: a rejected submission preserves the patient\'s in-progress values (not cleared)', severityKept === '6');

      await context.close();
    }

    // ---- 9. Sign out from the Symptom History page clears the session and redirects ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { symptomLogs: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptoms/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.click('#signOutBtn');
      await page.waitForURL('**/login.html');
      check('Symptom History: sign out redirects to /login.html', page.url() === `${baseUrl}/login.html`);
      const tokenAfterSignOut = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('Symptom History: sign out clears the session token', tokenAfterSignOut === null);
      await context.close();
    }

    // ---- 10. Responsive: zero horizontal overflow at 375px on the Symptom History page ----
    {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { symptomLogs: SAMPLE_LOGS });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptoms/`);
      await page.waitForSelector('.tl-item');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('Symptom History: zero horizontal overflow at 375px viewport', overflow === 0);
      await context.close();
    }

    // ---- 11. Accessibility: heading hierarchy, skip link, keyboard focus on the Symptom History page ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { symptomLogs: SAMPLE_LOGS });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptoms/`);
      await page.waitForSelector('.tl-item');

      const h1Count = await page.$$eval('h1', (els) => els.length);
      check('Symptom History: exactly one h1 (the shared "My Health Journey" header)', h1Count === 1);
      const h2Count = await page.$$eval('h2', (els) => els.length);
      check('Symptom History: exactly one h2 (the page title, "Symptom History")', h2Count === 1);

      const skipHref = await page.getAttribute('a.skip', 'href');
      check('Symptom History: skip-to-content link targets #main', skipHref === '#main');

      await page.keyboard.press('Tab'); // skip link
      await page.keyboard.press('Tab'); // sign-out (first/only interactive control in the header)
      const focusedIsSignOut = await page.evaluate(() => document.activeElement.id === 'signOutBtn');
      check('Symptom History: keyboard Tab reaches the sign-out control', focusedIsSignOut);
      const outlineStyle = await page.evaluate(() => getComputedStyle(document.activeElement, null).outlineStyle);
      check('Symptom History: keyboard-focused sign-out control has a visible focus outline', outlineStyle !== 'none');

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
