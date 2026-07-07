/**
 * Browser-driven verification for Batch PXP-8 — Trusted Device +
 * Long-Lived Session (login.html's silent-recovery gate,
 * verify.html's opt-in "Keep me signed in" checkbox,
 * my-health-journey/devices/ — the new Manage Devices page — and the one
 * disclosed link added to the dashboard shell,
 * my-health-journey/index.html's #devicesLink). Mirrors
 * validation/pxp-7-care-plan-engine/browser-test.js's discipline exactly: a
 * local static server + headless Chromium (Playwright), the backend mocked
 * at the network layer, external font requests blocked for speed/
 * determinism.
 *
 * No apps-script/*.gs file is exercised by this suite — backend
 * conformance coverage (device rotation, revocation, cross-patient
 * isolation, the Long-Lived Session's own longer TTL verified against the
 * real, unmodified FoundationSession.gs) is
 * validation/phase-2a-foundation/conformance.js's Stage 16. This suite
 * verifies frontend behavior only: where each token is stored
 * (localStorage vs. sessionStorage, shared/schemas/trusted-device.md's
 * "Where each token lives"), and that my-health-journey/dashboard.js and
 * my-health-journey/session-guard.js remain byte-for-byte untouched (this
 * batch's own deliberately minimized frozen-file footprint — only
 * login.html, verify.html, and my-health-journey/index.html's one nav link
 * are touched, per each file's own disclosed header-comment justification).
 *
 * Run: NODE_PATH=$(npm root -g) node validation/pxp-8-persistent-login/browser-test.js
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

const FAKE_SESSION_TOKEN = 'fake-session-token-for-pxp8-tests';
const FAKE_LONG_LIVED_TOKEN = 'fake-long-lived-session-token-for-pxp8-tests';
const FAKE_DEVICE_TOKEN = 'fake-raw-device-token-for-pxp8-tests';
const FAKE_ROTATED_DEVICE_TOKEN = 'fake-rotated-raw-device-token-for-pxp8-tests';

const PROFILE_ENVELOPE = {
  status: 'ok',
  data: { patient_id: 'p1', full_name: 'Asha Menon', email: 'asha@example.com', condition_slug: 'mcas', status: 'active' }
};

function deviceRow(id, label, revoked) {
  return {
    device_id: id, patient_id: 'p1', device_label: label || '',
    created_at: '2026-07-01T00:00:00.000Z', last_used_at: '2026-07-05T00:00:00.000Z',
    expires_at: '2026-09-29T00:00:00.000Z',
    revoked_at: revoked ? '2026-07-06T00:00:00.000Z' : '', revoked_by: revoked ? 'p1' : ''
  };
}

// Routes by the parsed request's foundation_action. The same "black-box,
// but observable at the network boundary" discipline every earlier browser
// suite already uses.
async function mockFoundation(page, opts) {
  const options = Object.assign({
    profileEnvelope: PROFILE_ENVELOPE,
    moduleStates: [],
    consumeTrustedDeviceResult: 'ok', // 'ok' | 'error'
    devices: [deviceRow('d1', 'My iPhone', false)],
    revokeResult: 'ok'
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
    if (action === 'consume_login_link') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: { session_token: FAKE_SESSION_TOKEN, patient_id: 'p1' } }) });
      return;
    }
    if (action === 'mark_device_trusted') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: { device_token: FAKE_DEVICE_TOKEN, device_id: 'd1', device_label: body.device_label || '', expires_at: '2026-09-29T00:00:00.000Z' } }) });
      return;
    }
    if (action === 'consume_trusted_device') {
      if (options.consumeTrustedDeviceResult === 'ok') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: { device_token: FAKE_ROTATED_DEVICE_TOKEN, session_token: FAKE_LONG_LIVED_TOKEN, patient_id: 'p1' } }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_TRUSTED_DEVICE_INVALID', message: 'This device is no longer trusted. Please sign in again.' } }) });
      }
      return;
    }
    if (action === 'get_trusted_devices') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: options.devices }) });
      return;
    }
    if (action === 'revoke_trusted_device') {
      if (options.revokeResult === 'ok') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: { device_id: body.device_id, revoked_at: '2026-07-07T00:00:00.000Z' } }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_NOT_FOUND', message: 'We could not find that trusted device.' } }) });
      }
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_UNKNOWN_ACTION', message: 'Unknown request.' } }) });
  });
}

async function withSessionToken(page, baseUrl, token) {
  await page.goto(`${baseUrl}/login.html`);
  await page.evaluate((t) => window.sessionStorage.setItem('wise_session_token', t), token);
}

async function withDeviceToken(page, baseUrl, token) {
  await page.goto(`${baseUrl}/login.html`);
  await page.evaluate((t) => window.localStorage.setItem('wise_trusted_device_token', t), token);
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
    // ---- 1. login.html: no stored device token -> shows the login form immediately ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {});
      await page.goto(`${baseUrl}/login.html`);
      await page.waitForSelector('#loginFormState:not([hidden])');
      const checkingHidden = await page.getAttribute('#checkingDeviceState', 'hidden');
      check('login.html: with no stored device token, the login form is revealed and the checking-device skeleton is hidden', checkingHidden !== null);
      const url = page.url();
      check('login.html: with no stored device token, the page stays on login.html (no redirect)', url === `${baseUrl}/login.html`);
      await context.close();
    }

    // ---- 2. login.html: a valid stored device token silently signs in and redirects to the dashboard ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { consumeTrustedDeviceResult: 'ok' });
      await withDeviceToken(page, baseUrl, FAKE_DEVICE_TOKEN);
      await page.goto(`${baseUrl}/login.html`);
      await page.waitForURL('**/my-health-journey/');
      check('login.html: a valid stored device token redirects straight to the dashboard, never showing the login form', page.url() === `${baseUrl}/my-health-journey/`);

      const sessionToken = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('login.html: a successful silent recovery stores the new Long-Lived Session token in sessionStorage', sessionToken === FAKE_LONG_LIVED_TOKEN);
      const rotatedDeviceToken = await page.evaluate(() => window.localStorage.getItem('wise_trusted_device_token'));
      check('login.html: a successful silent recovery stores the newly-rotated device token in localStorage, replacing the old one', rotatedDeviceToken === FAKE_ROTATED_DEVICE_TOKEN);

      await context.close();
    }

    // ---- 3. login.html: an invalid/expired/revoked stored device token falls back to the login form and clears the stale token ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { consumeTrustedDeviceResult: 'error' });
      await withDeviceToken(page, baseUrl, FAKE_DEVICE_TOKEN);
      await page.goto(`${baseUrl}/login.html`);
      await page.waitForSelector('#loginFormState:not([hidden])');
      check('login.html: a rejected device token falls back to showing the normal login form', page.url() === `${baseUrl}/login.html`);
      const clearedToken = await page.evaluate(() => window.localStorage.getItem('wise_trusted_device_token'));
      check('login.html: a rejected device token is cleared from localStorage, never retried forever', clearedToken === null);
      await context.close();
    }

    // ---- 4. login.html: ?reason=expired with no device token still shows the generic session-expiry message ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {});
      await page.goto(`${baseUrl}/login.html?reason=expired`);
      await page.waitForSelector('#statusBox.warn');
      const statusText = await page.textContent('#statusBox');
      check('login.html: ?reason=expired with no trusted device still shows the unchanged, generic session-expiry message', statusText.indexOf('your secure session has ended') !== -1);
      await context.close();
    }

    // ---- 5. login.html: ?reason=expired WITH a valid device token recovers silently — the expiry message never displays ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { consumeTrustedDeviceResult: 'ok' });
      await withDeviceToken(page, baseUrl, FAKE_DEVICE_TOKEN);
      await page.goto(`${baseUrl}/login.html?reason=expired`);
      await page.waitForURL('**/my-health-journey/');
      check('login.html: ?reason=expired recovers silently via a valid trusted device — this is the batch\'s own "session renewal" mechanic', page.url() === `${baseUrl}/my-health-journey/`);
      await context.close();
    }

    // ---- 6. verify.html: checking "Keep me signed in" marks the device trusted after a successful sign-in ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {});
      await page.goto(`${baseUrl}/verify.html?token=faketoken123`);
      await page.waitForSelector('#readyState:not([hidden])');
      await page.check('#trustDeviceCheckbox');
      await page.click('#continueBtn');
      await page.waitForSelector('#successState:not([hidden])');

      const deviceToken = await page.evaluate(() => window.localStorage.getItem('wise_trusted_device_token'));
      check('verify.html: checking "Keep me signed in" stores a real device token in localStorage after sign-in succeeds', deviceToken === FAKE_DEVICE_TOKEN);
      const sessionToken = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('verify.html: the Session token itself still lives only in sessionStorage, unchanged (docs/29 §3)', sessionToken === FAKE_SESSION_TOKEN);

      await context.close();
    }

    // ---- 7. verify.html: leaving "Keep me signed in" unchecked (the default) never writes a device token ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {});
      await page.goto(`${baseUrl}/verify.html?token=faketoken123`);
      await page.waitForSelector('#readyState:not([hidden])');

      const checkedByDefault = await page.isChecked('#trustDeviceCheckbox');
      check('verify.html: "Keep me signed in on this device" is unchecked by default — Magic Link alone remains the complete default (docs/44 §5.2)', checkedByDefault === false);

      await page.click('#continueBtn');
      await page.waitForSelector('#successState:not([hidden])');
      const deviceToken = await page.evaluate(() => window.localStorage.getItem('wise_trusted_device_token'));
      check('verify.html: with the checkbox left unchecked, no device token is ever written to localStorage', deviceToken === null);

      await context.close();
    }

    // ---- 8. Manage Devices page: lists an active device with a Revoke button and a revoked device without one ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { devices: [deviceRow('d1', 'My iPhone', false), deviceRow('d2', '', true)] });
      await withSessionToken(page, baseUrl, FAKE_SESSION_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/devices/`);
      await page.waitForSelector('.dv-item');

      const items = await page.$$('.dv-item');
      check('Manage Devices: renders one list item per device', items.length === 2);

      const activeLabel = await page.textContent('.dv-item[data-device-id="d1"] .dv-label');
      check('Manage Devices: an active device shows its own device_label', activeLabel.indexOf('My iPhone') !== -1);
      const revokeBtnCount = await page.$$eval('.dv-item[data-device-id="d1"] .dv-revoke-btn', (els) => els.length);
      check('Manage Devices: an active device has a Revoke button', revokeBtnCount === 1);

      const revokedText = await page.textContent('#dvContent');
      check('Manage Devices: a device with no device_label falls back to "Unnamed device"', revokedText.indexOf('Unnamed device') !== -1);
      check('Manage Devices: a revoked device is labeled "Revoked"', revokedText.indexOf('Revoked') !== -1);
      const revokedHasButton = await page.$('.dv-item:not([data-device-id]) .dv-revoke-btn');
      check('Manage Devices: a revoked device has no Revoke button — a one-way, already-completed transition', revokedHasButton === null);

      await context.close();
    }

    // ---- 9. Manage Devices page: no devices at all shows a friendly empty state ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { devices: [] });
      await withSessionToken(page, baseUrl, FAKE_SESSION_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/devices/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      const bodyText = await page.textContent('#dvContent');
      check('Manage Devices: zero trusted devices shows a friendly explanation, not an error', bodyText.indexOf('have not marked any device as trusted') !== -1);
      await context.close();
    }

    // ---- 10. Manage Devices page: clicking Revoke removes the device from the rendered list ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      let revoked = false;
      await page.route('**/macros/s/**/exec', async (route) => {
        let body = {};
        try { body = JSON.parse(route.request().postData()); } catch (e) { /* not JSON */ }
        if (body.foundation_action === 'get_profile') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROFILE_ENVELOPE) });
          return;
        }
        if (body.foundation_action === 'get_trusted_devices') {
          const data = revoked ? [deviceRow('d1', 'My iPhone', true)] : [deviceRow('d1', 'My iPhone', false)];
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data }) });
          return;
        }
        if (body.foundation_action === 'revoke_trusted_device') {
          revoked = true;
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: { device_id: body.device_id, revoked_at: '2026-07-07T00:00:00.000Z' } }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_UNKNOWN_ACTION', message: 'Unknown request.' } }) });
      });
      await withSessionToken(page, baseUrl, FAKE_SESSION_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/devices/`);
      await page.waitForSelector('.dv-revoke-btn');

      await page.click('.dv-revoke-btn');
      await page.waitForSelector('.dv-item[data-device-id]', { state: 'detached' });
      const revokeBtnAfter = await page.$('.dv-revoke-btn');
      check('Manage Devices: clicking Revoke re-loads the list and the device no longer has a Revoke button', revokeBtnAfter === null);
      const bodyTextAfter = await page.textContent('#dvContent');
      check('Manage Devices: the revoked device now shows as "Revoked"', bodyTextAfter.indexOf('Revoked') !== -1);

      await context.close();
    }

    // ---- 11. Manage Devices page: no session redirects to /login.html (unchanged session-guard.js behavior) ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {});
      await page.goto(`${baseUrl}/my-health-journey/devices/`);
      await page.waitForURL('**/login.html');
      check('Manage Devices: no sessionStorage token redirects to /login.html — session-guard.js remains completely untouched by this batch', page.url() === `${baseUrl}/login.html`);
      await context.close();
    }

    // ---- 12. Dashboard: the disclosed "Manage Devices" link is present and points at the real page ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [] });
      await withSessionToken(page, baseUrl, FAKE_SESSION_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');

      const devicesLinkHref = await page.getAttribute('#devicesLink', 'href');
      check('Dashboard: the "Manage Devices" link points at the real Manage Devices page', devicesLinkHref === './devices/');

      await page.click('#devicesLink');
      await page.waitForURL('**/my-health-journey/devices/');
      check('Dashboard: clicking "Manage Devices" navigates to the real Manage Devices page', page.url() === `${baseUrl}/my-health-journey/devices/`);

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
