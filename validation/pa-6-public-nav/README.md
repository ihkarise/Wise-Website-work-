# Patient Access Batch PA-6 Browser Testing

Browser-driven verification for the only Phase 2A batch with a real public-visibility
change (docs/29 §13 Batch 5G): "Patient Login" added to the primary nav on every public
page, the temporary `noindex` protection removed from the real patient-facing pages, and
a `sitemap.xml` entry added for the login entry point. Mirrors every prior Patient
Access batch's testing discipline — a local static server + headless Chromium
(Playwright), external font requests blocked for speed/determinism.

## What this proves, and how

`browser-test.js` starts a plain Node `http` static file server over this repository's
real, unmodified files and launches headless Chromium via Playwright. No backend mock is
needed — this batch touches no `apps-script/*.gs` or `shared/*` file, so there is nothing
to intercept at the network layer.

Covers:
- The "Patient Login" nav link exists, with the correct `href`, on both of this site's
  two pre-existing nav markup shapes (sampled via `index.html` and `contact.html` — see
  the file's own header comment for why sampling one of each is sufficient), in both the
  desktop `.nav-links` list and the mobile menu.
- The link is a plain nav link, not styled as the accent Book Now CTA — docs/08's/
  docs/20's "a separate action" requirement, checked structurally.
- A real click on the nav link navigates to `/login.html` and the login page renders.
- The `noindex` meta tag is genuinely gone from the *rendered DOM* (not just grep'd out
  of the source) on all six real patient pages, and each now carries a `<link
  rel="canonical">`.
- The one deliberate exception — `my-health-journey/timeline/entry.html` keeps its
  `noindex` tag, since it has no stable canonical URL (a `?record_id=`-keyed detail
  view) — is checked directly against the file on disk, not via a browser `goto()`,
  since that page is session-guarded and an unauthenticated navigation would just
  redirect to `/login.html` before any DOM assertion could run. The same read also
  confirms the page's `<title>`/description survived (see "self-caught mistake" below).
- `sitemap.xml` gained exactly the one new, intended entry (`/login.html`) and lists no
  authenticated `/my-health-journey/` page.

## Running it

Requires Playwright (see `validation/pa-2-dashboard/README.md`'s note on `NODE_PATH` if
it's only installed globally in this environment):

```
NODE_PATH=$(npm root -g) node validation/pa-6-public-nav/browser-test.js
```

## What this does not prove

This suite does not re-verify session-guard redirect behavior (unauthenticated visit to
`/my-health-journey/` redirecting to `/login.html`; an authenticated visit rendering the
dashboard) — that is already covered by `validation/pa-2-dashboard/browser-test.js` and
was re-run unchanged for this batch, since `dashboard.js`/`session-guard.js` are not
touched here. It also does not exercise anything only visible against a live Netlify
deployment or a real search engine crawl (e.g., actual indexing behavior) — it verifies
the markup and routing this repository controls, not third-party crawler behavior.

## A self-caught mistake, fixed before it shipped

An early edit to `my-health-journey/timeline/entry.html` accidentally deleted its
`<title>` and `<meta name="description">` tags along with adding the noindex-removal
comment. This suite's own title/description assertion caught it immediately — fixed
before this batch was considered done, and the regression check stayed in the suite so
the same mistake would be caught automatically if repeated.

## Result (last run)

22/22 checks passed.
