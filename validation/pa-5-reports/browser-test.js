/**
 * Browser-driven verification for Batch PA-5 — the Reports full history
 * page (my-health-journey/reports/index.html), the dashboard's Reports
 * card now that it carries a real upload form and recent-uploads list
 * (my-health-journey/dashboard.js's loadReportsPreview()/reportsFormHtml()/
 * reportsListHtml()), and reuse of the shared
 * my-health-journey/session-guard.js module. Mirrors
 * validation/pa-4-symptom-tracker/browser-test.js's discipline exactly: a
 * local static server + headless Chromium (Playwright), the backend
 * mocked at the network layer, external font requests blocked for
 * speed/determinism, keyboard-driven focus checks.
 *
 * No apps-script/*.gs file is exercised by this suite — backend
 * conformance coverage, including the platform's highest-risk feature's
 * content-based MIME-spoofing rejection and cross-patient isolation on
 * list/download, is validation/phase-2a-foundation/conformance.js's
 * Stage 9. This suite verifies frontend behavior only.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/pa-5-reports/browser-test.js
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

const FAKE_TOKEN = 'fake-session-token-for-pa5-tests';

const PROFILE_ENVELOPE = {
  status: 'ok',
  data: { patient_id: 'p1', full_name: 'Asha Menon', email: 'asha@example.com', condition_slug: 'mcas', status: 'active' }
};

const SAMPLE_REPORTS = [
  { record_id: 'rp-2', patient_id: 'p1', uploaded_at: '2026-07-01T09:00:00.000Z', file_name: 'Blood Test <script>.pdf', drive_file_id: 'drive-2', mime_type: 'application/pdf', size_bytes: 204800, uploaded_by: 'p1' },
  { record_id: 'rp-1', patient_id: 'p1', uploaded_at: '2026-06-01T09:00:00.000Z', file_name: 'old-scan.png', drive_file_id: 'drive-1', mime_type: 'image/png', size_bytes: 51200, uploaded_by: 'p1' }
];

// A tiny, real base64 payload — its content doesn't need to be a real PDF
// for this suite (that content-based check is Stage 9's own coverage);
// it only needs to decode into bytes the browser can build a download
// Blob from.
const FAKE_FILE_BASE64 = Buffer.from('%PDF-1.4 fake content for a browser-test download fixture', 'utf8').toString('base64');

// Routes by the parsed request's foundation_action, mirroring
// validation/pa-4-symptom-tracker's own mock discipline — a realistic
// per-action backend stand-in rather than one blanket response.
async function mockFoundation(page, { reports = [], uploadReportResult = null, downloadReportResult = null } = {}) {
  await page.route('**/macros/s/**/exec', async (route) => {
    let action = null;
    let body = {};
    try { body = JSON.parse(route.request().postData()); action = body.foundation_action; } catch (e) { /* not JSON */ }

    if (action === 'get_profile') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROFILE_ENVELOPE) });
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
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: reports }) });
      return;
    }
    if (action === 'upload_report') {
      const result = uploadReportResult || {
        status: 'ok',
        data: {
          record_id: 'new-1', patient_id: 'p1', uploaded_at: new Date().toISOString(),
          file_name: body.file_name, drive_file_id: 'drive-new-1', mime_type: body.mime_type,
          size_bytes: body.file_base64 ? Buffer.from(body.file_base64, 'base64').length : 0, uploaded_by: 'p1'
        }
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
      return;
    }
    if (action === 'download_report') {
      const result = downloadReportResult || {
        status: 'ok',
        data: { record_id: body.record_id, file_name: 'downloaded-file.pdf', mime_type: 'application/pdf', size_bytes: 42, file_base64: FAKE_FILE_BASE64 }
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
    // ---- 1. Reports page: no session token -> redirect to /login.html ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.goto(`${baseUrl}/my-health-journey/reports/`);
      await page.waitForURL('**/login.html');
      check('Reports: no sessionStorage token redirects to /login.html', page.url() === `${baseUrl}/login.html`);
      await context.close();
    }

    // ---- 2. Reports page: populated -> ordered entries, escaped filenames, mime/size ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { reports: SAMPLE_REPORTS });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/reports/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('.tl-item');

      const itemCount = await page.$$eval('.tl-item', (els) => els.length);
      check('Reports: renders both entries in the backend-provided order (newest first)', itemCount === 2);

      const firstDate = await page.$eval('.tl-item .tl-date', (el) => el.textContent);
      check('Reports: first entry shows the date portion only (no time)', firstDate === '2026-07-01');

      const nameHtml = await page.$eval('.tl-item h3', (el) => el.innerHTML);
      check('Reports: a filename containing markup is escaped, never rendered as a live element', nameHtml.indexOf('<script>') === -1 && nameHtml.indexOf('&lt;script&gt;') !== -1);

      const metaText = await page.$eval('.tl-item .rp-meta', (el) => el.textContent);
      check('Reports: first entry shows its mime type and a human-readable size', metaText.indexOf('application/pdf') !== -1 && metaText.indexOf('KB') !== -1);

      const listRole = await page.$eval('.tl-track', (el) => el.tagName.toLowerCase());
      check('Reports: entries are a real ordered list element (<ol>), not decorative <div>s', listRole === 'ol');

      const downloadBtnCount = await page.$$eval('[data-download]', (els) => els.length);
      check('Reports: every entry has its own Download action', downloadBtnCount === 2);

      await context.close();
    }

    // ---- 3. Reports page: zero entries -> "No reports yet" Empty State ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { reports: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/reports/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('.badge-nodata');
      const badgeText = await page.textContent('.badge-nodata');
      check('Reports: zero entries renders the "No reports yet" badge', badgeText === 'No reports yet');
      await context.close();
    }

    // ---- 4. Reports page: network failure -> friendly message, session kept ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.route('**/macros/s/**/exec', (route) => route.abort('failed'));
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/reports/`);
      await page.waitForSelector('#rpContent p');
      const errorText = await page.textContent('#rpContent p');
      check('Reports: network failure shows a friendly, non-technical message', errorText.indexOf('Could not load your reports') !== -1);
      const tokenKept = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('Reports: network failure does not clear the session token', tokenKept === FAKE_TOKEN);
      await context.close();
    }

    // ---- 5. Dashboard: Reports card always shows the upload form, even with zero entries ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { reports: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#reportForm');

      const labelFor = await page.getAttribute('#reportForm label', 'for');
      check('Dashboard: the Reports upload field has a real, associated <label for>', labelFor === 'reportFile');

      const fileInputAccept = await page.getAttribute('#reportFile', 'accept');
      check('Dashboard: the file input restricts selection to PDF/JPG/PNG', fileInputAccept.indexOf('.pdf') !== -1 && fileInputAccept.indexOf('.png') !== -1);

      await page.waitForSelector('#reportsList .badge-nodata');
      const listBadge = await page.textContent('#reportsList .badge-nodata');
      check('Dashboard: zero reports still shows the "No entries yet" list badge alongside the form', listBadge === 'No entries yet');

      await context.close();
    }

    // ---- 6. Dashboard: Reports card shows recent uploads + "View full history" link when entries exist ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { reports: SAMPLE_REPORTS });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-reports-body a.secondary');

      const listText = await page.textContent('#reportsList');
      check('Dashboard: Reports card shows the most recent uploads\' dates and filenames', /2026-07-01/.test(listText) && /old-scan\.png/.test(listText));

      const viewFullHref = await page.$eval('#card-reports-body a.secondary', (el) => el.getAttribute('href'));
      check('Dashboard: Reports card\'s "View full history" link points at the real Reports page', viewFullHref === '/my-health-journey/reports/');

      check('Dashboard: the upload form is still present even when reports already exist (write affordance is the card\'s primary content)',
        (await page.$('#reportForm')) !== null);

      await context.close();
    }

    // ---- 7. Dashboard: a client-side oversized file is rejected without ever calling the network ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      let uploadCalled = false;
      await mockFoundation(page, { reports: [] });
      await page.route('**/macros/s/**/exec', async (route, request) => {
        let action = null;
        try { action = JSON.parse(request.postData()).foundation_action; } catch (e) { /* ignore */ }
        if (action === 'upload_report') uploadCalled = true;
        route.fallback();
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#reportForm');

      const oversized = Buffer.alloc(5 * 1024 * 1024 + 1024, 0x41);
      await page.setInputFiles('#reportFile', { name: 'huge.pdf', mimeType: 'application/pdf', buffer: oversized });
      await page.click('#reportSubmitBtn');
      await page.waitForSelector('#reportStatus.err');

      const statusText = await page.textContent('#reportStatus');
      check('Dashboard: an oversized file shows the 5 MB limit message immediately', statusText.indexOf('5 MB limit') !== -1);
      check('Dashboard: the oversized file was never sent to the server (client-side pre-check runs before fetch)', uploadCalled === false);

      await context.close();
    }

    // ---- 8. Dashboard: a valid file upload succeeds, resets the form, and refreshes the list ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { reports: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#reportForm');

      await page.setInputFiles('#reportFile', { name: 'lab-result.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 a small real-ish fixture', 'utf8') });
      await page.click('#reportSubmitBtn');
      await page.waitForSelector('#reportStatus.ok');

      const statusText = await page.textContent('#reportStatus');
      check('Dashboard: a successful upload shows a confirmation in the aria-live status region', statusText.indexOf('Uploaded') !== -1);

      const fileInputAfterReset = await page.$eval('#reportFile', (el) => el.value);
      check('Dashboard: a successful upload resets the form (file input cleared)', fileInputAfterReset === '');

      await context.close();
    }

    // ---- 9. Dashboard: a rejected upload shows the backend's error message verbatim ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {
        reports: [],
        uploadReportResult: { status: 'error', data: null, error: { code: 'FOUNDATION_INVALID_INPUT', message: 'That file type is not supported. Please upload a PDF, JPG, or PNG.' } }
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#reportForm');

      await page.setInputFiles('#reportFile', { name: 'report.pdf', mimeType: 'application/pdf', buffer: Buffer.from('irrelevant for this mocked rejection', 'utf8') });
      await page.click('#reportSubmitBtn');
      await page.waitForSelector('#reportStatus.err');

      const statusText = await page.textContent('#reportStatus');
      check('Dashboard: a rejected upload shows the backend\'s own message verbatim', statusText === 'That file type is not supported. Please upload a PDF, JPG, or PNG.');

      await context.close();
    }

    // ---- 10. Reports page: clicking Download triggers a real file download ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {
        reports: SAMPLE_REPORTS,
        downloadReportResult: { status: 'ok', data: { record_id: 'rp-1', file_name: 'old-scan.png', mime_type: 'image/png', size_bytes: 51200, file_base64: FAKE_FILE_BASE64 } }
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/reports/`);
      await page.waitForSelector('.tl-item');

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-download="rp-1"]')
      ]);
      check('Reports: clicking Download triggers a real browser download with the report\'s own filename', download.suggestedFilename() === 'old-scan.png');

      await page.waitForSelector('[data-download="rp-1"] + [data-download-status], [data-download-status].status.ok', { timeout: 5000 }).catch(() => {});
      const statusEl = await page.$eval('[data-download="rp-1"]', (btn) => btn.parentElement.querySelector('[data-download-status]').textContent);
      check('Reports: a successful download shows a confirmation next to the button', statusEl === 'Downloaded.');

      await context.close();
    }

    // ---- 11. Reports page: a rejected download shows an inline error, no navigation ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {
        reports: SAMPLE_REPORTS,
        downloadReportResult: { status: 'error', data: null, error: { code: 'FOUNDATION_NOT_FOUND', message: 'We could not find that report.' } }
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/reports/`);
      await page.waitForSelector('.tl-item');

      await page.click('[data-download="rp-1"]');
      await page.waitForFunction(() => {
        const btn = document.querySelector('[data-download="rp-1"]');
        const status = btn && btn.parentElement.querySelector('[data-download-status]');
        return status && status.textContent === 'We could not find that report.';
      });
      const urlUnchanged = page.url() === `${baseUrl}/my-health-journey/reports/`;
      check('Reports: a rejected download shows the backend\'s own message verbatim without navigating away', urlUnchanged);

      await context.close();
    }

    // ---- 12. Sign out from the Reports page clears the session and redirects ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { reports: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/reports/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.click('#signOutBtn');
      await page.waitForURL('**/login.html');
      check('Reports: sign out redirects to /login.html', page.url() === `${baseUrl}/login.html`);
      const tokenAfterSignOut = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('Reports: sign out clears the session token', tokenAfterSignOut === null);
      await context.close();
    }

    // ---- 13. Responsive: zero horizontal overflow at 375px on the Reports page ----
    {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { reports: SAMPLE_REPORTS });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/reports/`);
      await page.waitForSelector('.tl-item');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('Reports: zero horizontal overflow at 375px viewport', overflow === 0);
      await context.close();
    }

    // ---- 14. Accessibility: heading hierarchy, skip link, keyboard focus on the Reports page ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { reports: SAMPLE_REPORTS });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/reports/`);
      await page.waitForSelector('.tl-item');

      const h1Count = await page.$$eval('h1', (els) => els.length);
      check('Reports: exactly one h1 (the shared "My Health Journey" header)', h1Count === 1);
      const h2Count = await page.$$eval('h2', (els) => els.length);
      check('Reports: exactly one h2 (the page title, "Reports")', h2Count === 1);

      const skipHref = await page.getAttribute('a.skip', 'href');
      check('Reports: skip-to-content link targets #main', skipHref === '#main');

      await page.keyboard.press('Tab'); // skip link
      await page.keyboard.press('Tab'); // sign-out (first/only interactive control in the header)
      const focusedIsSignOut = await page.evaluate(() => document.activeElement.id === 'signOutBtn');
      check('Reports: keyboard Tab reaches the sign-out control', focusedIsSignOut);
      const outlineStyle = await page.evaluate(() => getComputedStyle(document.activeElement, null).outlineStyle);
      check('Reports: keyboard-focused sign-out control has a visible focus outline', outlineStyle !== 'none');

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
