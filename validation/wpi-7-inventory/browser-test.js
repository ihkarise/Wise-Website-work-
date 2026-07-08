/**
 * Browser-driven verification for Batch WPI-7 — the Inventory capability
 * (doctor-dashboard/dashboard.js's new registry-driven Inventory card,
 * backed by this batch's new get_inventory_items route). Mirrors
 * validation/wpi-5-appointment/browser-test.js's discipline exactly: a
 * local static server + headless Chromium (Playwright), the backend mocked
 * at the network layer, external font requests blocked for speed/
 * determinism.
 *
 * Covers only this batch's own new surface (the Inventory card's own
 * render/empty states, low-stock display, and that it participates
 * correctly in loader dispatch alongside patient_roster/appointments). The
 * pre-existing Doctor Dashboard mechanism (per-doctor enablement, empty
 * dashboard, fail-closed session handling, sign-out) is still fully covered
 * by validation/wpi-4-doctor-dashboard/, unchanged by this batch — mirroring
 * the wpi-4/wpi-5 split precedent exactly.
 *
 * No apps-script/*.gs file is exercised by this suite — the backend's own
 * get_inventory_items route (specialty scoping, low_stock computation,
 * cross-identity-type rejection, InventoryItem.gs's/InventoryTransaction.gs's
 * own create/retire/record-transaction lifecycle and LockService mitigation)
 * is validation/phase-2a-foundation/conformance.js's Stage 23, added in this
 * same batch, not duplicated here.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/wpi-7-inventory/browser-test.js
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

const FAKE_TOKEN = 'fake-doctor-session-token-for-wpi7-tests';

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

// Fixture rows shaped exactly like get_inventory_items's own return shape
// (InventoryItem.gs's foundationGetInventoryItemsForDoctor_()).
function inventoryEntry(overrides) {
  return Object.assign({
    inventory_item_id: 'i1',
    name: 'Arnica 30C',
    sku: 'SKU-ARNICA-30C',
    unit: 'tablets',
    quantity_on_hand: 50,
    reorder_threshold: 10,
    specialty_scope: '',
    status: 'active',
    low_stock: false
  }, overrides || {});
}

async function mockFoundation(page, opts) {
  const options = Object.assign({
    profileEnvelope: PROFILE_ENVELOPE,
    moduleStatesEnvelope: null,
    moduleStates: [],
    inventoryEnvelope: null,
    inventory: []
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
    if (action === 'get_inventory_items') {
      const envelope = options.inventoryEnvelope
        || { status: 'ok', data: options.inventory };
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
    // ---- 1. inventory enabled, zero entries -> the card's own "nodata" empty state ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('inventory', true)], inventory: [] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-inventory-body .badge-nodata');

      const emptyText = await page.textContent('#card-inventory-body');
      check('Doctor Dashboard: an empty Inventory view shows the card\'s own "no items" empty state, not an error',
        emptyText.indexOf('No inventory items are registered') !== -1);

      await context.close();
    }

    // ---- 2. inventory enabled, with real entries -> the card renders them, low stock flagged ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, {
        moduleStates: [stateRow('inventory', true)],
        inventory: [
          inventoryEntry({ inventory_item_id: 'i1', name: 'Arnica 30C', sku: 'SKU-ARNICA-30C', quantity_on_hand: 50, reorder_threshold: 10, low_stock: false }),
          inventoryEntry({ inventory_item_id: 'i2', name: 'Low Stock Remedy', sku: 'SKU-LOWSTOCK', quantity_on_hand: 4, reorder_threshold: 5, low_stock: true })
        ]
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-inventory-body:not(:has(.skeleton))');

      const cardTitles = await page.$$eval('.dash-card h2', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: the enabled Inventory capability renders exactly one card', cardTitles.length === 1 && cardTitles[0] === 'Inventory');

      const names = await page.$$eval('#card-inventory-body .roster-name', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: an item shows its name and sku', names[0].indexOf('Arnica 30C') !== -1 && names[0].indexOf('SKU-ARNICA-30C') !== -1);

      const details = await page.$$eval('#card-inventory-body .roster-conditions', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: a well-stocked item shows its quantity and unit, with no low-stock flag',
        details[0].indexOf('50 tablets on hand') !== -1 && details[0].indexOf('Low stock') === -1);
      check('Doctor Dashboard: a low-stock item is visibly flagged with its reorder threshold',
        details[1].indexOf('4 tablets on hand') !== -1 && details[1].indexOf('Low stock') !== -1 && details[1].indexOf('reorder at 5') !== -1);

      await context.close();
    }

    // ---- 3. All three capabilities enabled -> all three cards render, all three loaders fire exactly once ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, {
        moduleStates: [stateRow('patient_roster', true), stateRow('appointments', true), stateRow('inventory', true)],
        inventory: []
      });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#card-inventory-body .badge-nodata');

      const cardTitles = await page.$$eval('.dash-card h2', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: all three enabled capabilities render, in display_order (Patient Roster, Appointments, then Inventory)',
        cardTitles.length === 3 && cardTitles[0] === 'Patient Roster' && cardTitles[1] === 'Appointments' && cardTitles[2] === 'Inventory');

      const inventoryCalls = calls.filter((a) => a === 'get_inventory_items').length;
      const appointmentsCalls = calls.filter((a) => a === 'get_doctor_appointments').length;
      const rosterCalls = calls.filter((a) => a === 'get_doctor_patient_roster').length;
      check('Doctor Dashboard: get_inventory_items (the Inventory capability\'s registered data_source) is called exactly once', inventoryCalls === 1);
      check('Doctor Dashboard: get_doctor_appointments still fires exactly once alongside it — no interference between capabilities\' own loaders', appointmentsCalls === 1);
      check('Doctor Dashboard: get_doctor_patient_roster still fires exactly once alongside it too', rosterCalls === 1);

      await context.close();
    }

    // ---- 4. inventory disabled -> no Inventory card at all (registry-driven, fail-closed discipline unchanged) ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { moduleStates: [stateRow('inventory', false)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dashEmptyState');

      const card = await page.$('#card-inventory-body');
      check('Doctor Dashboard: a doctor with the Inventory capability disabled sees no Inventory card at all', card === null);

      const inventoryCalls = calls.filter((a) => a === 'get_inventory_items').length;
      check('Doctor Dashboard: get_inventory_items is never called when the capability is disabled', inventoryCalls === 0);

      await context.close();
    }

    // ---- 5. Pure-function unit check: inventoryHtml() against window.WiseDoctorDashboard ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('inventory', false)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dashEmptyState');

      const registryLength = await page.evaluate(() => window.WiseDoctorDashboard.DOCTOR_MODULE_REGISTRY.length);
      check('Doctor Dashboard: the hand-ported DOCTOR_MODULE_REGISTRY now carries three entries (patient_roster, appointments, inventory)', registryLength === 3);

      const html = await page.evaluate(() => window.WiseDoctorDashboard.inventoryHtml([]));
      check('Doctor Dashboard: inventoryHtml([]) returns the "nodata" empty state directly, matching the live rendering above',
        html.indexOf('No inventory items are registered') !== -1);

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
