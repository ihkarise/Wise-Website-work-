/**
 * Browser-driven verification for Batch PA-4 — the Symptom Tracker page
 * (my-health-journey/symptom-tracker/index.html), and the dashboard's own
 * Symptom Tracker card now that it is wired to real data
 * (my-health-journey/dashboard.js's loadSymptomPreview()). Mirrors
 * validation/pa-3-timeline/browser-test.js's discipline exactly: a local
 * static server + headless Chromium (Playwright), the backend mocked at
 * the network layer, external font requests blocked for speed/determinism,
 * keyboard-driven focus checks.
 *
 * No apps-script/*.gs file is exercised by this suite — backend
 * conformance coverage is validation/phase-2a-foundation/conformance.js's
 * Stage 8. This suite verifies frontend behavior only, including the
 * platform's first patient-*writable* form (draft create/edit/submit) and
 * the approved offline-message behavior (docs/41-SYMPTOM-TRACKER-READINESS-REVIEW.md,
 * PA-4 decisions: no local persistence, no background sync — a network
 * failure shows a friendly message and leaves the form's typed values
 * exactly as they were).
 *
 * Run: node validation/pa-4-symptom-tracker/browser-test.js
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

const SAMPLE_DRAFT = {
  record_id: 'draft-1', patient_id: 'p1', status: 'draft',
  severity: '6', sleep: '', energy: '', stress: '',
  notes: 'Feeling better today.', condition_slug: 'mcas',
  created_at: '2026-07-03T10:00:00.000Z', updated_at: '2026-07-03T10:00:00.000Z', submitted_at: ''
};

const SAMPLE_SUBMITTED = [
  {
    record_id: 'sub-2', patient_id: 'p1', status: 'submitted',
    severity: '4', sleep: '7', energy: '6', stress: '3', notes: '',
    condition_slug: 'mcas', created_at: '2026-07-02T09:00:00.000Z', updated_at: '2026-07-02T09:05:00.000Z', submitted_at: '2026-07-02T09:05:00.000Z'
  },
  {
    record_id: 'sub-1', patient_id: 'p1', status: 'submitted',
    severity: '8', sleep: '5', energy: '3', stress: '7', notes: 'Rough day.',
    condition_slug: 'mcas', created_at: '2026-07-01T09:00:00.000Z', updated_at: '2026-07-01T09:05:00.000Z', submitted_at: '2026-07-01T09:05:00.000Z'
  }
];

// Routes by the parsed request's foundation_action — a realistic,
// stateful-enough mock (mutates its own in-memory `state.draft`) so
// save/submit round trips actually reflect back into the next call, the
// same "real per-action response" discipline pa-3-timeline's own mock
// established. `state` is passed in fresh per test case.
async function mockFoundation(page, state) {
  await page.route('**/macros/s/**/exec', async (route) => {
    let action = null;
    let body = {};
    try { body = JSON.parse(route.request().postData()); action = body.foundation_action; } catch (e) { /* not JSON */ }

    if (action === 'get_profile') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROFILE_ENVELOPE) });
      return;
    }
    if (action === 'get_symptom_logs') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: { draft: state.draft, submitted: state.submitted || [] } }) });
      return;
    }
    if (action === 'create_symptom_draft') {
      if (!state.draft) {
        state.draft = {
          record_id: 'draft-new', patient_id: 'p1', status: 'draft',
          severity: '', sleep: '', energy: '', stress: '', notes: '',
          condition_slug: 'mcas', created_at: '2026-07-03T12:00:00.000Z', updated_at: '2026-07-03T12:00:00.000Z', submitted_at: ''
        };
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: state.draft }) });
      return;
    }
    if (action === 'update_symptom_draft') {
      if (state.forceUpdateNetworkError) {
        await route.abort('failed');
        return;
      }
      if (state.forceUpdateValidationError) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_INVALID_INPUT', message: 'severity must be a whole number from 1 to 10, or left blank.' } }) });
        return;
      }
      if (state.draft && state.draft.record_id === body.record_id) {
        ['severity', 'sleep', 'energy', 'stress', 'notes'].forEach((f) => {
          if (body[f] !== undefined) state.draft[f] = body[f];
        });
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: state.draft }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_NOT_FOUND', message: 'We could not find that symptom log entry.' } }) });
      return;
    }
    if (action === 'submit_symptom_log') {
      if (state.forceSubmitValidationError) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_INVALID_INPUT', message: 'Add at least one value or a note before submitting.' } }) });
        return;
      }
      if (state.draft && state.draft.record_id === body.record_id) {
        state.draft.status = 'submitted';
        state.draft.submitted_at = '2026-07-03T12:10:00.000Z';
        const submitted = state.draft;
        state.submitted = [submitted].concat(state.submitted || []);
        state.draft = null;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: submitted }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_NOT_FOUND', message: 'We could not find that symptom log entry.' } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_UNKNOWN_ACTION', message: 'Unknown request.' } }) });
  });
}

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
    // ---- 1. No session token -> redirect to /login.html ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.goto(`${baseUrl}/my-health-journey/symptom-tracker/`);
      await page.waitForURL('**/login.html');
      check('Symptom Tracker: no sessionStorage token redirects to /login.html', page.url() === `${baseUrl}/login.html`);
      await context.close();
    }

    // ---- 2. No open draft -> "Log a new entry" button, no form ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { draft: null, submitted: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptom-tracker/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#startEntryBtn');
      check('Symptom Tracker: no open draft shows the "Log a new entry" button', await page.$('#startEntryBtn') !== null);
      check('Symptom Tracker: no form is rendered when there is no draft', await page.$('#symptomForm') === null);
      await context.close();
    }

    // ---- 3. Clicking "Log a new entry" creates a draft and reveals the form ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { draft: null, submitted: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptom-tracker/`);
      await page.waitForSelector('#startEntryBtn');
      await page.click('#startEntryBtn');
      await page.waitForSelector('#symptomForm');
      check('Symptom Tracker: starting a new entry reveals the scale-value inputs', await page.$('#fieldSeverity') !== null);
      await context.close();
    }

    // ---- 4. Existing open draft -> form pre-filled with its values ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { draft: Object.assign({}, SAMPLE_DRAFT), submitted: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptom-tracker/`);
      await page.waitForSelector('#symptomForm');
      const severityValue = await page.inputValue('#fieldSeverity');
      const notesValue = await page.inputValue('#fieldNotes');
      check('Symptom Tracker: an existing draft pre-fills severity', severityValue === '6');
      check('Symptom Tracker: an existing draft pre-fills notes', notesValue === 'Feeling better today.');
      const sleepValue = await page.inputValue('#fieldSleep');
      check('Symptom Tracker: an unset scale field pre-fills blank, not "0" or "null"', sleepValue === '');
      await context.close();
    }

    // ---- 5. Save draft -> "Draft saved" status, values retained ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { draft: Object.assign({}, SAMPLE_DRAFT), submitted: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptom-tracker/`);
      await page.waitForSelector('#symptomForm');
      await page.fill('#fieldSleep', '8');
      await page.click('#saveDraftBtn');
      await page.waitForSelector('.status.ok');
      const statusText = await page.textContent('#formStatus');
      check('Symptom Tracker: saving a draft shows a confirmation status', statusText.indexOf('Draft saved') !== -1);
      const sleepAfterSave = await page.inputValue('#fieldSleep');
      check('Symptom Tracker: the saved value remains in the field afterward', sleepAfterSave === '8');
      await context.close();
    }

    // ---- 6. Save draft: backend validation error is shown verbatim ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { draft: Object.assign({}, SAMPLE_DRAFT), submitted: [], forceUpdateValidationError: true });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptom-tracker/`);
      await page.waitForSelector('#symptomForm');
      await page.click('#saveDraftBtn');
      await page.waitForSelector('.status.err');
      const statusText = await page.textContent('#formStatus');
      check('Symptom Tracker: a validation error from the backend is shown verbatim',
        statusText === 'severity must be a whole number from 1 to 10, or left blank.');
      await context.close();
    }

    // ---- 7. Save draft: network failure shows the approved offline message, values untouched, no local persistence ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { draft: Object.assign({}, SAMPLE_DRAFT), submitted: [], forceUpdateNetworkError: true });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptom-tracker/`);
      await page.waitForSelector('#symptomForm');
      await page.fill('#fieldStress', '9');
      await page.click('#saveDraftBtn');
      await page.waitForSelector('.status.err');
      const statusText = await page.textContent('#formStatus');
      check('Symptom Tracker: a network failure shows a friendly offline message',
        statusText.indexOf('You appear to be offline') !== -1);
      const stressStillTyped = await page.inputValue('#fieldStress');
      check('Symptom Tracker: the offline message does not clear the in-progress value (no data loss)', stressStillTyped === '9');
      const localStorageUsed = await page.evaluate(() => window.localStorage.length);
      check('Symptom Tracker: no local persistence is used for offline handling (localStorage stays empty)', localStorageUsed === 0);
      await context.close();
    }

    // ---- 8. Submit: empty draft rejected, backend message shown verbatim, draft NOT replaced ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { draft: { record_id: 'draft-empty', patient_id: 'p1', status: 'draft', severity: '', sleep: '', energy: '', stress: '', notes: '', condition_slug: 'mcas', created_at: '2026-07-03T10:00:00.000Z', updated_at: '2026-07-03T10:00:00.000Z', submitted_at: '' }, submitted: [], forceSubmitValidationError: true });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptom-tracker/`);
      await page.waitForSelector('#symptomForm');
      await page.click('#submitBtn');
      await page.waitForSelector('.status.err');
      const statusText = await page.textContent('#formStatus');
      check('Symptom Tracker: submitting an empty entry shows the backend\'s own rejection message verbatim',
        statusText === 'Add at least one value or a note before submitting.');
      check('Symptom Tracker: the draft form remains after a rejected submit (not silently cleared)', await page.$('#symptomForm') !== null);
      await context.close();
    }

    // ---- 9. Submit success: confirmation, form replaced by "Log a new entry", history refreshed ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { draft: Object.assign({}, SAMPLE_DRAFT), submitted: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptom-tracker/`);
      await page.waitForSelector('#symptomForm');
      await page.click('#submitBtn');
      await page.waitForSelector('.status.ok');
      const statusText = await page.textContent('#formStatus');
      check('Symptom Tracker: a successful submit shows a confirmation message', statusText.indexOf('Entry submitted') !== -1);
      await page.waitForSelector('#startEntryBtn');
      check('Symptom Tracker: after submitting, the form is replaced by "Log a new entry"', await page.$('#symptomForm') === null);
      await page.waitForSelector('.tl-item');
      const historyCount = await page.$$eval('.tl-item', (els) => els.length);
      check('Symptom Tracker: the submitted entry now appears in the history list', historyCount === 1);
      await context.close();
    }

    // ---- 10. Submitted history renders as a real ordered list, newest first, with a synthesized summary ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { draft: null, submitted: SAMPLE_SUBMITTED });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptom-tracker/`);
      await page.waitForSelector('.tl-item');
      const listTag = await page.$eval('#historySection ol', (el) => el.tagName.toLowerCase());
      check('Symptom Tracker: history is a real ordered list element (<ol>), not decorative <div>s', listTag === 'ol');
      const summaries = await page.$$eval('.tl-summary', (els) => els.map((e) => e.textContent));
      check('Symptom Tracker: the newest submitted entry appears first', summaries[0].indexOf('Severity 4') !== -1 && summaries[0].indexOf('Sleep 7') !== -1);
      check('Symptom Tracker: a submitted entry with notes includes them in the summary', summaries[1].indexOf('Rough day.') !== -1);
      await context.close();
    }

    // ---- 11. Zero submitted entries -> "No entries yet" badge ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { draft: null, submitted: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptom-tracker/`);
      await page.waitForSelector('.badge-nodata');
      const badgeText = await page.textContent('.badge-nodata');
      check('Symptom Tracker: zero submitted entries renders the "No entries yet" badge', badgeText === 'No entries yet');
      await context.close();
    }

    // ---- 12. Initial load network failure -> friendly message on both sections ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.route('**/macros/s/**/exec', (route) => route.abort('failed'));
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptom-tracker/`);
      await page.waitForSelector('#draftSection p');
      const draftErrorText = await page.textContent('#draftSection p');
      check('Symptom Tracker: an initial-load network failure shows a friendly message', draftErrorText.indexOf('Could not reach the server') !== -1);
      const tokenKept = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('Symptom Tracker: an initial-load network failure does not clear the session token', tokenKept === FAKE_TOKEN);
      await context.close();
    }

    // ---- 13. Dashboard: Symptom Tracker card reflects draft-in-progress ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { draft: Object.assign({}, SAMPLE_DRAFT), submitted: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#card-symptoms-body:not(:has(.skeleton))');
      const cardText = await page.textContent('#card-symptoms-body');
      check('Dashboard: Symptom Tracker card shows a draft-in-progress message', cardText.indexOf('draft in progress') !== -1);
      const continueHref = await page.$eval('#card-symptoms-body a.secondary', (el) => el.getAttribute('href'));
      check('Dashboard: Symptom Tracker card\'s draft link points at the Symptom Tracker page', continueHref === '/my-health-journey/symptom-tracker/');
      await context.close();
    }

    // ---- 14. Dashboard: Symptom Tracker card reflects the most recent submitted entry ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { draft: null, submitted: SAMPLE_SUBMITTED });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#card-symptoms-body:not(:has(.skeleton))');
      const cardText = await page.textContent('#card-symptoms-body');
      check('Dashboard: Symptom Tracker card shows the most recent submitted entry\'s summary', cardText.indexOf('Severity 4') !== -1);
      check('Dashboard: Symptom Tracker card does not show a draft-in-progress message when there is no draft', cardText.indexOf('draft in progress') === -1);
      await context.close();
    }

    // ---- 15. Sign out from the Symptom Tracker page ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { draft: null, submitted: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptom-tracker/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.click('#signOutBtn');
      await page.waitForURL('**/login.html');
      check('Symptom Tracker: sign out redirects to /login.html', page.url() === `${baseUrl}/login.html`);
      const tokenAfterSignOut = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('Symptom Tracker: sign out clears the session token', tokenAfterSignOut === null);
      await context.close();
    }

    // ---- 16. Responsive: zero horizontal overflow at 375px ----
    {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { draft: Object.assign({}, SAMPLE_DRAFT), submitted: SAMPLE_SUBMITTED });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptom-tracker/`);
      await page.waitForSelector('#symptomForm');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('Symptom Tracker: zero horizontal overflow at 375px viewport', overflow === 0);
      await context.close();
    }

    // ---- 17. Accessibility: labels, heading hierarchy, skip link, keyboard focus ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { draft: Object.assign({}, SAMPLE_DRAFT), submitted: SAMPLE_SUBMITTED });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/symptom-tracker/`);
      await page.waitForSelector('#symptomForm');

      const h1Count = await page.$$eval('h1', (els) => els.length);
      check('Symptom Tracker: exactly one h1 (the shared "My Health Journey" header)', h1Count === 1);
      const h2Count = await page.$$eval('h2', (els) => els.length);
      check('Symptom Tracker: exactly one h2 (the page title, "Symptom Tracker")', h2Count === 1);

      const severityLabelFor = await page.$eval('label[for="fieldSeverity"]', (el) => el.getAttribute('for'));
      const severityInputId = await page.$eval('#fieldSeverity', (el) => el.id);
      check('Symptom Tracker: every scale input has a real, associated <label for>', severityLabelFor === severityInputId);

      const skipHref = await page.getAttribute('a.skip', 'href');
      check('Symptom Tracker: skip-to-content link targets #main', skipHref === '#main');

      const statusRole = await page.$eval('#formStatus', (el) => el.getAttribute('role'));
      const statusLive = await page.$eval('#formStatus', (el) => el.getAttribute('aria-live'));
      check('Symptom Tracker: the form status region is a live region (role=status, aria-live=polite)', statusRole === 'status' && statusLive === 'polite');

      await page.keyboard.press('Tab'); // skip link
      await page.keyboard.press('Tab'); // sign-out (first/only interactive control in the header)
      const focusedIsSignOut = await page.evaluate(() => document.activeElement.id === 'signOutBtn');
      check('Symptom Tracker: keyboard Tab reaches the sign-out control', focusedIsSignOut);
      const outlineStyle = await page.evaluate(() => getComputedStyle(document.activeElement, null).outlineStyle);
      check('Symptom Tracker: keyboard-focused sign-out control has a visible focus outline', outlineStyle !== 'none');

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
