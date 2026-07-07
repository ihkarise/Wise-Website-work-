/**
 * Browser-driven verification for Batch PA-3 — the Timeline list page
 * (my-health-journey/timeline/index.html), the Consultation History detail
 * page (my-health-journey/timeline/entry.html), the shared
 * my-health-journey/session-guard.js module, and the dashboard's own
 * Timeline card now that it is wired to real data
 * (my-health-journey/dashboard.js's loadTimelinePreview()). Mirrors
 * validation/pa-2-dashboard/browser-test.js's discipline exactly: a local
 * static server + headless Chromium (Playwright), the backend mocked at
 * the network layer, external font requests blocked for speed/determinism,
 * keyboard-driven focus checks.
 *
 * No apps-script/*.gs file is exercised by this suite — backend
 * conformance coverage is validation/phase-2a-foundation/conformance.js's
 * Stage 7. This suite verifies frontend behavior only.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/pa-3-timeline/browser-test.js
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

const FAKE_TOKEN = 'fake-session-token-for-pa3-tests';

const PROFILE_ENVELOPE = {
  status: 'ok',
  data: { patient_id: 'p1', full_name: 'Asha Menon', email: 'asha@example.com', condition_slug: 'mcas', status: 'active' }
};

const SAMPLE_ENTRIES = [
  { record_id: 'rec-3', patient_id: 'p1', entry_date: '2026-06-15', entry_type: 'consultation', title: 'Newest visit', summary_text: 'Most recent visit — full detail text goes here, long enough to be meaningfully truncated on the list page but shown in full on the detail page.', source_ref: '', created_by: 'staff-1', created_at: '2026-06-15T10:00:00.000Z' },
  { record_id: 'rec-2', patient_id: 'p1', entry_date: '2026-06-01', entry_type: 'consultation', title: 'Middle visit', summary_text: 'Follow-up visit notes.', source_ref: 'phase15-record-123', created_by: 'staff-1', created_at: '2026-06-01T10:00:00.000Z' },
  { record_id: 'rec-1', patient_id: 'p1', entry_date: '2026-05-01', entry_type: 'consultation', title: 'Oldest visit', summary_text: 'First visit notes.', source_ref: '', created_by: 'staff-1', created_at: '2026-05-01T10:00:00.000Z' }
];

// Routes by the parsed request's foundation_action, mirroring
// validation/pa-2-dashboard's own updated mock — a realistic per-action
// backend stand-in rather than one blanket response for every call.
async function mockFoundation(page, { timeline = [], entryByRecordId = {} } = {}) {
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
    // seeded registry modules are enabled here — Test #8's dashboard
    // Timeline card would otherwise not render at all under the new
    // registry-driven rules.
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
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: timeline }) });
      return;
    }
    if (action === 'get_timeline_entry') {
      const entry = entryByRecordId[body.record_id];
      if (entry) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: entry }) });
      } else {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_NOT_FOUND', message: 'We could not find that consultation entry.' } })
        });
      }
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
    // ---- 1. Timeline list: no session token -> redirect to /login.html ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.goto(`${baseUrl}/my-health-journey/timeline/`);
      await page.waitForURL('**/login.html');
      check('Timeline list: no sessionStorage token redirects to /login.html', page.url() === `${baseUrl}/login.html`);
      await context.close();
    }

    // ---- 2. Timeline list: populated -> ordered entries, correct order, correct links ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { timeline: SAMPLE_ENTRIES });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/timeline/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('.tl-item');

      const greetingText = await page.textContent('#greeting');
      check('Timeline list: greeting shows the real patient name', greetingText.indexOf('Asha Menon') !== -1);

      const itemTitles = await page.$$eval('.tl-item h3', (els) => els.map((e) => e.textContent));
      check('Timeline list: renders all three entries in the backend-provided order (newest first)',
        itemTitles.length === 3 && itemTitles[0] === 'Newest visit' && itemTitles[1] === 'Middle visit' && itemTitles[2] === 'Oldest visit');

      const firstHref = await page.$eval('.tl-item a', (el) => el.getAttribute('href'));
      check('Timeline list: each entry links to entry.html with its own record_id', firstHref === 'entry.html?id=rec-3');

      const summaryText = await page.$eval('.tl-item .tl-summary', (el) => el.textContent);
      check('Timeline list: long summary text is truncated on the list view', summaryText.length < SAMPLE_ENTRIES[0].summary_text.length && /…$/.test(summaryText));

      await context.close();
    }

    // ---- 3. Timeline list: zero entries -> "No data yet" Empty State ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { timeline: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/timeline/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('.badge-nodata');
      const badgeText = await page.textContent('.badge-nodata');
      check('Timeline list: zero entries renders the "No entries yet" badge', badgeText === 'No entries yet');
      await context.close();
    }

    // ---- 4. Timeline list: network failure -> friendly message, distinct from a rejected session ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.route('**/macros/s/**/exec', (route) => route.abort('failed'));
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/timeline/`);
      await page.waitForSelector('#tlContent p');
      const errorText = await page.textContent('#tlContent p');
      check('Timeline list: network failure shows a friendly, non-technical message', errorText.indexOf('Could not load your timeline') !== -1);
      const tokenKept = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('Timeline list: network failure does not clear the session token', tokenKept === FAKE_TOKEN);
      await context.close();
    }

    // ---- 5. Detail page: no ?id= -> friendly "missing entry" message, no request sent ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      let entryRequestSent = false;
      await mockFoundation(page, { entryByRecordId: {} });
      // Registered after mockFoundation's own route, so it runs first
      // (Playwright: last-registered route runs first) and falls through
      // via route.fallback() — never route.continue(), which would send
      // the request to the real network instead of the mock below it.
      await page.route('**/macros/s/**/exec', async (route) => {
        try {
          const body = JSON.parse(route.request().postData());
          if (body.foundation_action === 'get_timeline_entry') entryRequestSent = true;
        } catch (e) { /* ignore */ }
        await route.fallback();
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/timeline/entry.html`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#entryContent p');
      const errorText = await page.textContent('#entryContent p');
      check('Detail page: missing ?id= shows a friendly explanatory message', errorText.indexOf('No consultation entry was specified') !== -1);
      check('Detail page: missing ?id= never issues a get_timeline_entry request at all', entryRequestSent === false);
      await context.close();
    }

    // ---- 6. Detail page: valid id -> full, untruncated detail ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const entryByRecordId = {};
      entryByRecordId[SAMPLE_ENTRIES[0].record_id] = SAMPLE_ENTRIES[0];
      await mockFoundation(page, { entryByRecordId });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/timeline/entry.html?id=rec-3`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('.entry-title');

      const title = await page.textContent('.entry-title');
      check('Detail page: renders the full entry title', title === 'Newest visit');
      const summary = await page.textContent('.entry-summary');
      check('Detail page: renders the FULL, untruncated summary text (unlike the list view)', summary === SAMPLE_ENTRIES[0].summary_text);
      const date = await page.textContent('.entry-date');
      check('Detail page: renders the entry date', date === '2026-06-15');

      const backHref = await page.getAttribute('a.tl-back', 'href');
      check('Detail page: has a "back to Timeline" link (docs/39 §6)', backHref === '../../my-health-journey/timeline/');

      await context.close();
    }

    // ---- 7. Detail page: rejected (unknown OR cross-patient) record_id -> generic backend message, verbatim ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { entryByRecordId: {} }); // simulates both "unknown" and "belongs to someone else" — same rejection either way (docs/40 Q3)
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/timeline/entry.html?id=someone-elses-record-id`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#entryContent p');
      const errorText = await page.textContent('#entryContent p');
      check('Detail page: a rejected record_id (unknown or cross-patient) shows the backend\'s own message verbatim, never a raw error',
        errorText === 'We could not find that consultation entry.');
      await context.close();
    }

    // ---- 8. Dashboard: Timeline card populated with real entries + "View full timeline" link ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { timeline: SAMPLE_ENTRIES });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-timeline-body a.secondary');

      const timelineCardText = await page.textContent('#card-timeline-body');
      check('Dashboard: Timeline card shows the newest entry\'s title when real entries exist',
        timelineCardText.indexOf('Newest visit') !== -1);
      check('Dashboard: Timeline card does not show a "No data yet"/placeholder badge when real entries exist',
        timelineCardText.indexOf('No entries yet') === -1 && timelineCardText.indexOf('Coming later') === -1);

      const viewFullHref = await page.$eval('#card-timeline-body a.secondary', (el) => el.getAttribute('href'));
      check('Dashboard: Timeline card\'s "View full timeline" link points at the real Timeline page',
        viewFullHref === '../my-health-journey/timeline/');

      await context.close();
    }

    // ---- 9. Sign out from a Timeline page clears the session and redirects ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { timeline: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/timeline/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.click('#signOutBtn');
      await page.waitForURL('**/login.html');
      check('Timeline list: sign out redirects to /login.html', page.url() === `${baseUrl}/login.html`);
      const tokenAfterSignOut = await page.evaluate(() => window.sessionStorage.getItem('wise_session_token'));
      check('Timeline list: sign out clears the session token', tokenAfterSignOut === null);
      await context.close();
    }

    // ---- 10. Responsive: zero horizontal overflow at 375px on both new pages ----
    {
      const listContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await blockExternalFonts(listContext);
      const listPage = await listContext.newPage();
      await mockFoundation(listPage, { timeline: SAMPLE_ENTRIES });
      await withSessionToken(listPage, baseUrl, FAKE_TOKEN);
      await listPage.goto(`${baseUrl}/my-health-journey/timeline/`);
      await listPage.waitForSelector('.tl-item');
      const listOverflow = await listPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('Timeline list: zero horizontal overflow at 375px viewport', listOverflow === 0);

      const entryContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await blockExternalFonts(entryContext);
      const entryPage = await entryContext.newPage();
      const entryByRecordId = {};
      entryByRecordId[SAMPLE_ENTRIES[0].record_id] = SAMPLE_ENTRIES[0];
      await mockFoundation(entryPage, { entryByRecordId });
      await withSessionToken(entryPage, baseUrl, FAKE_TOKEN);
      await entryPage.goto(`${baseUrl}/my-health-journey/timeline/entry.html?id=rec-3`);
      await entryPage.waitForSelector('.entry-title');
      const entryOverflow = await entryPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('Detail page: zero horizontal overflow at 375px viewport', entryOverflow === 0);
    }

    // ---- 11. Accessibility: heading hierarchy, skip link, keyboard focus ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { timeline: SAMPLE_ENTRIES });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/my-health-journey/timeline/`);
      await page.waitForSelector('.tl-item');

      const h1Count = await page.$$eval('h1', (els) => els.length);
      check('Timeline list: exactly one h1 (the shared "My Health Journey" header)', h1Count === 1);
      const h2Count = await page.$$eval('h2', (els) => els.length);
      check('Timeline list: exactly one h2 (the page title, "Timeline")', h2Count === 1);
      const h3Count = await page.$$eval('h3', (els) => els.length);
      check('Timeline list: exactly one h3 per entry (three total)', h3Count === 3);

      const skipHref = await page.getAttribute('a.skip', 'href');
      check('Timeline list: skip-to-content link targets #main', skipHref === '#main');

      const listRole = await page.$eval('.tl-track', (el) => el.tagName.toLowerCase());
      check('Timeline list: entries are a real ordered list element (<ol>), not decorative <div>s', listRole === 'ol');

      await page.keyboard.press('Tab'); // skip link
      await page.keyboard.press('Tab'); // sign-out (first/only interactive control in the header)
      const focusedIsSignOut = await page.evaluate(() => document.activeElement.id === 'signOutBtn');
      check('Timeline list: keyboard Tab reaches the sign-out control', focusedIsSignOut);
      const outlineStyle = await page.evaluate(() => getComputedStyle(document.activeElement, null).outlineStyle);
      check('Timeline list: keyboard-focused sign-out control has a visible focus outline', outlineStyle !== 'none');

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
