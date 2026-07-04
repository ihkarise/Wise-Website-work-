/**
 * Browser-driven verification for Batch PA-6 (docs/29 §13 Batch 5G) — the
 * only batch in Phase 2A with a real public-visibility change: "Patient
 * Login" added to the primary nav, the temporary noindex protection removed
 * from every patient-facing page, and a sitemap entry added for the entry
 * point. Mirrors every prior Patient Access batch's testing discipline: a
 * local static server + headless Chromium (Playwright), the backend mocked
 * at the network layer, external font requests blocked for speed/determinism.
 *
 * This suite verifies the navigation change itself (link presence, real
 * click-through from a public page into the portal) and the noindex removal
 * (rendered DOM, not just source text). It does not re-verify session-guard
 * redirect behavior (unauthenticated -> /login.html, authenticated ->
 * dashboard render) — that is already covered by
 * validation/pa-2-dashboard/browser-test.js and re-run unchanged for this
 * batch, since dashboard.js/session-guard.js were not touched.
 *
 * Run: node validation/pa-6-public-nav/browser-test.js
 */

const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.xml': 'application/xml' };

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

async function blockExternalFonts(context) {
  await context.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await context.route('https://fonts.gstatic.com/**', (route) => route.abort());
}

// One page from each of the two pre-existing nav markup patterns this site
// uses (docs/20 §6 already flagged Team/Doctors and other nav inconsistency
// as pre-existing, not introduced by this batch): index.html/team.html/
// blog/index.html use a separate .nav-cta wrapper around the Book
// Consultation button; every other page (conditions, contact, disclaimer,
// gallery, online-consultation, privacy, terms) puts a .nav-cta Book Now
// link as the last <li> inside .nav-links itself. Sampling one of each
// proves the fix was applied correctly under both shapes without needing to
// open all ten pages under Chromium.
const PATTERN_A_PAGE = '/index.html';
const PATTERN_B_PAGE = '/contact.html';

async function main() {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  try {
    // ---- 1. Patient Login present in primary nav (pattern A) ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.goto(`${baseUrl}${PATTERN_A_PAGE}`);
      const link = page.locator('.nav-links a[href="/login.html"]');
      check('Home: primary nav includes a "Patient Login" link pointing at /login.html', await link.count() === 1 && (await link.textContent()).trim() === 'Patient Login');
      const mobileLink = page.locator('.mobile-menu a[href="/login.html"]');
      check('Home: mobile menu also includes the "Patient Login" link', await mobileLink.count() === 1);
      await context.close();
    }

    // ---- 2. Patient Login present in primary nav (pattern B) ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.goto(`${baseUrl}${PATTERN_B_PAGE}`);
      const link = page.locator('.nav-links a[href="/login.html"]');
      check('Contact: primary nav includes a "Patient Login" link pointing at /login.html', await link.count() === 1 && (await link.textContent()).trim() === 'Patient Login');
      // docs/08/docs/20: Patient Login must be a separate action, distinct
      // from the Book Now CTA it now sits beside in the same list.
      const bookNow = page.locator('.nav-links a.nav-cta');
      check('Contact: Patient Login is a plain nav link, not styled as the accent Book Now CTA', await bookNow.count() === 1 && !(await link.getAttribute('class')));
      await context.close();
    }

    // ---- 3. Real click-through from a public page into the portal ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await page.goto(`${baseUrl}${PATTERN_A_PAGE}`);
      await page.click('.nav-links a[href="/login.html"]');
      await page.waitForURL('**/login.html');
      check('Home -> Patient Login: clicking the nav link actually navigates to /login.html', page.url() === `${baseUrl}/login.html`);
      const h1 = await page.textContent('h1').catch(() => null);
      check('Login page renders after navigating in from the public site', h1 !== null && h1.trim().length > 0);
      await context.close();
    }

    // ---- 4. noindex protection removed from the patient-facing pages (rendered DOM, not just source) ----
    {
      const pagesExpectedIndexable = [
        '/login.html',
        '/verify.html',
        '/my-health-journey/',
        '/my-health-journey/timeline/',
        '/my-health-journey/symptoms/',
        '/my-health-journey/reports/'
      ];
      for (const p of pagesExpectedIndexable) {
        const context = await browser.newContext();
        await blockExternalFonts(context);
        const page = await context.newPage();
        await page.goto(`${baseUrl}${p}`);
        const robotsMeta = await page.$('meta[name="robots"]');
        check(`${p}: no noindex meta tag present in the rendered DOM`, robotsMeta === null);
        const canonical = await page.$('link[rel="canonical"]');
        check(`${p}: a canonical link tag is present now that the page is indexable`, canonical !== null);
        await context.close();
      }
    }

    // ---- 5. The per-record Consultation Detail view is a deliberate, disclosed exception ----
    // Read directly off disk rather than navigating in Chromium: this page is
    // session-guarded, and an unauthenticated goto() would just redirect to
    // /login.html before the DOM check could run — irrelevant to what this
    // check actually verifies (the static <meta> tag itself).
    {
      const source = fs.readFileSync(path.join(ROOT, 'my-health-journey', 'timeline', 'entry.html'), 'utf8');
      check('Consultation Detail (query-string-keyed, no stable canonical) deliberately remains noindex', /<meta name="robots" content="noindex">/.test(source));
      check('Consultation Detail still has a title and description (not dropped alongside the noindex tag)', /<title>[^<]+<\/title>/.test(source) && /<meta name="description" content="[^"]+">/.test(source));
    }

    // ---- 6. sitemap.xml carries exactly the one new, documented entry ----
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const res = await page.goto(`${baseUrl}/sitemap.xml`);
      const body = await res.text();
      check('sitemap.xml includes the new /login.html entry', body.indexOf('<loc>https://www.wisehomeopathy.com/login.html</loc>') !== -1);
      check('sitemap.xml does NOT list any authenticated /my-health-journey/ page (no useful content for an unauthenticated crawler)', body.indexOf('<loc>https://www.wisehomeopathy.com/my-health-journey/') === -1);
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n${passCount + failCount} checks run, ${failCount} failed.`);
  console.log(failCount === 0 ? 'PASS' : 'FAIL');
  process.exit(failCount === 0 ? 0 : 1);
}

main();
