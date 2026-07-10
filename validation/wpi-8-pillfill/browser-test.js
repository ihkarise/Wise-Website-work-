/**
 * Browser-driven verification for Batch WPI-8 — the PillFill Orders
 * capability (doctor-dashboard/dashboard.js's new registry-driven PillFill
 * Orders card, backed by this batch's new get_pillfill_orders route).
 * Mirrors validation/wpi-7-inventory/browser-test.js's discipline exactly: a
 * local static server + headless Chromium (Playwright), the backend mocked
 * at the network layer, external font requests blocked for speed/
 * determinism.
 *
 * Covers only this batch's own new surface (the PillFill Orders card's own
 * render/empty states, status display, and that it participates correctly
 * in loader dispatch alongside patient_roster/appointments/inventory). The
 * pre-existing Doctor Dashboard mechanism (per-doctor enablement, empty
 * dashboard, fail-closed session handling, sign-out) is still fully covered
 * by validation/wpi-4-doctor-dashboard/, unchanged by this batch — mirroring
 * the wpi-4/wpi-5/wpi-7 split precedent exactly.
 *
 * No apps-script/*.gs file is exercised by this suite — the backend's own
 * get_pillfill_orders route (specialty scoping via the referenced
 * InventoryItem, cross-identity-type rejection, PillFillOrder.gs's own
 * create/fulfill/status-update lifecycle, and its reuse of
 * InventoryTransaction.gs's LockService mitigation) is
 * validation/phase-2a-foundation/conformance.js's Stage 24, added in this
 * same batch, not duplicated here.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/wpi-8-pillfill/browser-test.js
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

const FAKE_TOKEN = 'fake-doctor-session-token-for-wpi8-tests';

const PROFILE_ENVELOPE = {
  status: 'ok',
  data: { doctor_id: 'd1', full_name: 'Dr. Asha Rao', role: 'physician', email: 'asha@example.com', specialty_slug: 'homeopathy', status: 'active' }
};

function stateRow(capabilityKey, enabled) {
  return {
    state_key: 'd1::' + capabilityKey,
    doctor_id: 'd1',
    capability_key: capabilityKey,
    enabled: enabled,
    enabled_by: enabled ? 'staff-1' : '',
    enabled_at: enabled ? '2026-07-16T00:00:00.000Z' : ''
  };
}

// Fixture rows shaped exactly like get_pillfill_orders's own return shape
// (PillFillOrder.gs's foundationGetPillFillOrdersForDoctor_()).
function pillFillOrderEntry(overrides) {
  return Object.assign({
    order_id: 'o1',
    patient_id: 'p1',
    patient_full_name: 'Alice Patient',
    doctor_instruction_id: 'di1',
    inventory_item_id: 'i1',
    inventory_item_name: 'Arnica 30C',
    inventory_item_sku: 'SKU-ARNICA-30C',
    quantity: 10,
    status: 'requested',
    created_at: '2026-07-16T00:00:00.000Z',
    fulfilled_at: ''
  }, overrides || {});
}

async function mockFoundation(page, opts) {
  const options = Object.assign({
    profileEnvelope: PROFILE_ENVELOPE,
    moduleStatesEnvelope: null,
    moduleStates: [],
    pillFillOrdersEnvelope: null,
    pillFillOrders: []
  }, opts || {});
  const calls = [];
  await page.route('**/macros/s/**/exec', async (route) => {
    let action = null;
    try { action = JSON.parse(route.request().postData()).foundation_action; } catch (e) { /* not JSON */ }
    calls.push(action);
    if (action === 'get_doctor_profile') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.profileEnvelope) });
      return;
    }
    if (action === 'get_doctor_module_states') {
      const envelope = options.moduleStatesEnvelope
        || { status: 'ok', data: options.moduleStates };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelope) });
      return;
    }
    if (action === 'get_pillfill_orders') {
      const envelope = options.pillFillOrdersEnvelope
        || { status: 'ok', data: options.pillFillOrders };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelope) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', data: null, error: { code: 'FOUNDATION_UNKNOWN_ACTION', message: 'Unknown request.' } }) });
  });
  return calls;
}

async function withSessionToken(page, baseUrl, token) {
  await page.goto(`${baseUrl}/doctor-login.html`);
  await page.evaluate((t) => window.sessionStorage.setItem('wise_doctor_session_token', t), token);
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
    // ---- 1. pillfill_orders enabled, zero entries -> the card's own "nodata" empty state ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('pillfill_orders', true)], pillFillOrders: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-pillfill_orders-body .badge-nodata');

      const emptyText = await page.textContent('#card-pillfill_orders-body');
      check('Doctor Dashboard: an empty PillFill Orders view shows the card\'s own "no orders" empty state, not an error',
        emptyText.indexOf('No PillFill orders exist') !== -1);

      await context.close();
    }

    // ---- 2. pillfill_orders enabled, with real entries -> the card renders them, status labeled ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {
        moduleStates: [stateRow('pillfill_orders', true)],
        pillFillOrders: [
          pillFillOrderEntry({ order_id: 'o1', patient_full_name: 'Alice Patient', inventory_item_name: 'Arnica 30C', inventory_item_sku: 'SKU-ARNICA-30C', quantity: 10, status: 'requested' }),
          pillFillOrderEntry({ order_id: 'o2', patient_full_name: 'Bob Patient', inventory_item_name: 'Nux Vomica 6C', inventory_item_sku: 'SKU-NUX-6C', quantity: 3, status: 'fulfilled', fulfilled_at: '2026-07-16T01:00:00.000Z' })
        ]
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-pillfill_orders-body:not(:has(.skeleton))');

      const cardTitles = await page.$$eval('.dash-card h2', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: the enabled PillFill Orders capability renders exactly one card', cardTitles.length === 1 && cardTitles[0] === 'PillFill Orders');

      const names = await page.$$eval('#card-pillfill_orders-body .roster-name', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: an order shows its linked patient\'s name', names[0].indexOf('Alice Patient') !== -1);

      const details = await page.$$eval('#card-pillfill_orders-body .roster-conditions', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: a requested order shows its item, sku, quantity, and status label',
        details[0].indexOf('Arnica 30C') !== -1 && details[0].indexOf('SKU-ARNICA-30C') !== -1 && details[0].indexOf('qty 10') !== -1 && details[0].indexOf('Requested') !== -1);
      check('Doctor Dashboard: a fulfilled order shows its own "Fulfilled" status label',
        details[1].indexOf('Fulfilled') !== -1);

      await context.close();
    }

    // ---- 3. All four capabilities enabled -> all four cards render, all four loaders fire exactly once ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, {
        moduleStates: [stateRow('patient_roster', true), stateRow('appointments', true), stateRow('inventory', true), stateRow('pillfill_orders', true)],
        pillFillOrders: []
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-pillfill_orders-body .badge-nodata');

      const cardTitles = await page.$$eval('.dash-card h2', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: all four enabled capabilities render, in display_order (Patient Roster, Appointments, Inventory, then PillFill Orders)',
        cardTitles.length === 4 && cardTitles[0] === 'Patient Roster' && cardTitles[1] === 'Appointments' && cardTitles[2] === 'Inventory' && cardTitles[3] === 'PillFill Orders');

      const pillfillCalls = calls.filter((a) => a === 'get_pillfill_orders').length;
      const inventoryCalls = calls.filter((a) => a === 'get_inventory_items').length;
      const appointmentsCalls = calls.filter((a) => a === 'get_doctor_appointments').length;
      const rosterCalls = calls.filter((a) => a === 'get_doctor_patient_roster').length;
      check('Doctor Dashboard: get_pillfill_orders (the PillFill Orders capability\'s registered data_source) is called exactly once', pillfillCalls === 1);
      check('Doctor Dashboard: get_inventory_items still fires exactly once alongside it — no interference between capabilities\' own loaders', inventoryCalls === 1);
      check('Doctor Dashboard: get_doctor_appointments still fires exactly once alongside it too', appointmentsCalls === 1);
      check('Doctor Dashboard: get_doctor_patient_roster still fires exactly once alongside it too', rosterCalls === 1);

      await context.close();
    }

    // ---- 4. pillfill_orders disabled -> no PillFill Orders card at all (registry-driven, fail-closed discipline unchanged) ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { moduleStates: [stateRow('pillfill_orders', false)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dashEmptyState');

      const card = await page.$('#card-pillfill_orders-body');
      check('Doctor Dashboard: a doctor with the PillFill Orders capability disabled sees no PillFill Orders card at all', card === null);

      const pillfillCalls = calls.filter((a) => a === 'get_pillfill_orders').length;
      check('Doctor Dashboard: get_pillfill_orders is never called when the capability is disabled', pillfillCalls === 0);

      await context.close();
    }

    // ---- 5. Pure-function unit check: pillFillOrdersHtml() against window.WiseDoctorDashboard ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('pillfill_orders', false)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dashEmptyState');

      const registryLength = await page.evaluate(() => window.WiseDoctorDashboard.DOCTOR_MODULE_REGISTRY.length);
      check('Doctor Dashboard: the hand-ported DOCTOR_MODULE_REGISTRY now carries five entries (patient_roster, appointments, inventory, pillfill_orders, analytics)', registryLength === 5);

      const html = await page.evaluate(() => window.WiseDoctorDashboard.pillFillOrdersHtml([]));
      check('Doctor Dashboard: pillFillOrdersHtml([]) returns the "nodata" empty state directly, matching the live rendering above',
        html.indexOf('No PillFill orders exist') !== -1);

      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n${passCount + failCount} checks run, ${failCount} failed.`);
  process.exit(failCount === 0 ? 0 : 1);
}

main();
