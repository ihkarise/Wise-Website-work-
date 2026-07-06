/**
 * Browser-driven verification for Batch PXP-1 — the My Profile page
 * (my-health-journey/profile/index.html), its edit-in-place form
 * (my-health-journey/profile/profile.js's profileFormHtml()/
 * wireProfileForm()), the one disclosed link added to the dashboard shell
 * (my-health-journey/index.html's #profileLink), and reuse of the shared
 * my-health-journey/session-guard.js module. Mirrors
 * validation/pa-4-symptom-tracker/browser-test.js's discipline exactly: a
 * local static server + headless Chromium (Playwright), the backend mocked
 * at the network layer, external font requests blocked for speed/
 * determinism, keyboard-driven focus checks.
 *
 * No apps-script/*.gs file is exercised by this suite — backend
 * conformance coverage, including the platform's first upsert-style
 * entity's lazy-creation/cross-patient-isolation checks, is
 * validation/phase-2a-foundation/conformance.js's Stage 10. This suite
 * verifies frontend behavior only.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/pxp-1-patient-profile/browser-test.js
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

const FAKE_TOKEN = 'fake-session-token-for-pxp1-tests';

const PROFILE_ENVELOPE = {
  status: 'ok',
  data: { patient_id: 'p1', full_name: 'Asha Menon', email: 'asha@example.com', condition_slug: 'mcas', status: 'active' }
};

const DEFAULT_PATIENT_PROFILE = {
  patient_id: 'p1', phone: '', date_of_birth: '', preferred_contact_method: '', emergency_contact: '', updated_at: '', updated_by: ''
};

const SAVED_PATIENT_PROFILE = {
  patient_id: 'p1', phone: '+1 555 123 4567', date_of_birth: '1990-05-15',
  preferred_contact_method: 'email', emergency_contact: '<script>alert(1)</script>',
  updated_at: '2026-07-01T00:00:00.000Z', updated_by: 'p1'
};

// Routes by the parsed request's foundation_action, mirroring
// validation/pa-4-symptom-tracker's own mock discipline — a realistic
// per-action backend stand-in rather than one blanket response.
async function mockFoundation(page, { patientProfile = DEFAULT_PATIENT_PROFILE, saveResult = null } = {}) {
  await page.route('**/macros/s/**/exec', async (route) => {
    let action = null;
    let body = {};
    try { body = JSON.parse(route.request().postData()); action = body.foundation_action; } catch (e) { /* not JSON */ }

    if (action === 'get_profile') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROFILE_ENVELOPE) });
      return;
    }
    if (action === 'get_patient_profile') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: patientProfile }) });
      return;
    }
    if (action === 'save_patient_profile') {
      const result = saveResult || {
        status: 'ok',
        data: Object.assign({}, patientProfile, body, { updated_at: new Date().toISOString(), updated_by: 'p1' })
      };
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

async function main() {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  try {
    // ---- 1. My Profile page: no session token -> redirect to /login.html ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.goto(`${baseUrl}/my-health-journey/profile/`);
      await page.waitForURL('**/login.html');
      check('My Profile: no sessionStorage token redirects to /login.html', page.url() === `${baseUrl}/login.html`);
      await context.close();
    }

    // ---- 2. My Profile page: a patient's first visit (lazy-created default) pre-fills an empty, editable form ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { patientProfile: DEFAULT_PATIENT_PROFILE });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/profile/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#profileForm');

      const phoneValue = await page.inputValue('#pfPhone');
      check('My Profile: a first-time visit (lazy-created default) renders an empty, editable phone field, not an error state', phoneValue === '');

      const fieldCount = await page.$$eval('#profileForm .field', (els) => els.length);
      check('My Profile: the form renders all four editable fields (phone, DOB, contact method, emergency contact)', fieldCount === 4);

      const labelsForIds = await page.$$eval('#profileForm label', (els) => els.map((e) => e.getAttribute('for')));
      check('My Profile: every field has a real, associated <label for>', ['pfPhone', 'pfDob', 'pfContactMethod', 'pfEmergencyContact'].every((id) => labelsForIds.indexOf(id) !== -1));

      await context.close();
    }

    // ---- 3. My Profile page: an existing saved profile pre-fills the form with real, escaped values ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { patientProfile: SAVED_PATIENT_PROFILE });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/profile/`);
      await page.waitForSelector('#profileForm');

      const phoneValue = await page.inputValue('#pfPhone');
      check('My Profile: a saved profile pre-fills the phone field with its real value', phoneValue === '+1 555 123 4567');

      const dobValue = await page.inputValue('#pfDob');
      check('My Profile: a saved profile pre-fills the date of birth field', dobValue === '1990-05-15');

      const contactMethodValue = await page.inputValue('#pfContactMethod');
      check('My Profile: a saved profile pre-fills the preferred contact method select', contactMethodValue === 'email');

      const emergencyContactValue = await page.inputValue('#pfEmergencyContact');
      check('My Profile: a malicious emergency_contact value renders as inert input text, never executes as markup', emergencyContactValue === '<script>alert(1)</script>');
      const scriptTagCount = await page.$$eval('script', (els) => els.filter((e) => e.textContent.indexOf('alert(1)') !== -1).length);
      check('My Profile: no injected <script> element exists on the page from the emergency_contact value', scriptTagCount === 0);

      await context.close();
    }

    // ---- 4. My Profile page: a successful save shows a confirmation and does NOT clear the form (edit-in-place, not an append log) ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { patientProfile: DEFAULT_PATIENT_PROFILE });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/profile/`);
      await page.waitForSelector('#profileForm');

      await page.fill('#pfPhone', '+1 555 999 8888');
      await page.click('#pfSubmitBtn');
      await page.waitForSelector('#pfStatus.ok');

      const statusText = await page.textContent('#pfStatus');
      check('My Profile: a successful save shows a confirmation in the aria-live status region', statusText.indexOf('Saved') !== -1);

      const phoneAfterSave = await page.inputValue('#pfPhone');
      check('My Profile: a successful save does NOT reset the form — this is an edit-in-place record, not a log entry', phoneAfterSave === '+1 555 999 8888');

      await context.close();
    }

    // ---- 5. My Profile page: a rejected save shows the backend's own message and preserves in-progress values ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {
        patientProfile: DEFAULT_PATIENT_PROFILE,
        saveResult: { status: 'error', data: null, error: { code: 'FOUNDATION_INVALID_INPUT', message: 'phone must be 7-20 characters using only digits, spaces, and + - ( ) when provided.' } }
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/profile/`);
      await page.waitForSelector('#profileForm');

      await page.fill('#pfPhone', 'not-a-phone');
      await page.click('#pfSubmitBtn');
      await page.waitForSelector('#pfStatus.err');

      const statusText = await page.textContent('#pfStatus');
      check('My Profile: a rejected save shows the backend\'s own message verbatim', statusText === 'phone must be 7-20 characters using only digits, spaces, and + - ( ) when provided.');

      const phoneKept = await page.inputValue('#pfPhone');
      check('My Profile: a rejected save preserves the patient\'s in-progress value (not cleared)', phoneKept === 'not-a-phone');

      await context.close();
    }

    // ---- 6. My Profile page: network failure -> friendly message, session kept ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.route('**/macros/s/**/exec', (route) => route.abort('failed'));
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/profile/`);
      await page.waitForSelector('#pfContent p');
      const errorText = await page.textContent('#pfContent p');
      check('My Profile: network failure shows a friendly, non-technical message', errorText.indexOf('Could not load your profile') !== -1);
      const tokenKept = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('My Profile: network failure does not clear the session token', tokenKept === FAKE_TOKEN);
      await context.close();
    }

    // ---- 7. Dashboard: the disclosed "My Profile" link is present and points at the real page ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { patientProfile: DEFAULT_PATIENT_PROFILE });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');

      const profileLinkHref = await page.getAttribute('#profileLink', 'href');
      check('Dashboard: the "My Profile" link points at the real My Profile page', profileLinkHref === './profile/');

      await page.click('#profileLink');
      await page.waitForURL('**/my-health-journey/profile/');
      check('Dashboard: clicking "My Profile" navigates to the real My Profile page', page.url() === `${baseUrl}/my-health-journey/profile/`);

      await context.close();
    }

    // ---- 8. Sign out from the My Profile page clears the session and redirects ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { patientProfile: DEFAULT_PATIENT_PROFILE });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/profile/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.click('#signOutBtn');
      await page.waitForURL('**/login.html');
      check('My Profile: sign out redirects to /login.html', page.url() === `${baseUrl}/login.html`);
      const tokenAfterSignOut = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('My Profile: sign out clears the session token', tokenAfterSignOut === null);
      await context.close();
    }

    // ---- 9. Responsive: zero horizontal overflow at 375px on the My Profile page ----
    {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { patientProfile: SAVED_PATIENT_PROFILE });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/profile/`);
      await page.waitForSelector('#profileForm');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('My Profile: zero horizontal overflow at 375px viewport', overflow === 0);
      await context.close();
    }

    // ---- 10. Accessibility: heading hierarchy, skip link, keyboard focus on the My Profile page ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { patientProfile: SAVED_PATIENT_PROFILE });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/profile/`);
      await page.waitForSelector('#profileForm');

      const h1Count = await page.$$eval('h1', (els) => els.length);
      check('My Profile: exactly one h1 (the shared "My Health Journey" header)', h1Count === 1);
      const h2Count = await page.$$eval('h2', (els) => els.length);
      check('My Profile: exactly one h2 (the page title, "My Profile")', h2Count === 1);

      const skipHref = await page.getAttribute('a.skip', 'href');
      check('My Profile: skip-to-content link targets #main', skipHref === '#main');

      // The My Profile page's own header has no #profileLink (that link
      // exists only on the dashboard shell, my-health-journey/index.html)
      // — its first/only interactive header control is sign-out, the same
      // as symptoms/index.html and reports/index.html.
      await page.keyboard.press('Tab'); // skip link
      await page.keyboard.press('Tab'); // sign-out button (first/only interactive control after skip link)
      const focusedIsSignOut = await page.evaluate(() => document.activeElement.id === 'signOutBtn');
      check('My Profile: keyboard Tab reaches the sign-out control', focusedIsSignOut);
      const outlineStyle = await page.evaluate(() => getComputedStyle(document.activeElement, null).outlineStyle);
      check('My Profile: keyboard-focused sign-out control has a visible focus outline', outlineStyle !== 'none');

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
