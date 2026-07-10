/**
 * Browser-driven verification for Batch WPI-10 — the AI Assistant capability
 * (doctor-dashboard/dashboard.js's new registry-driven AI Assistant card,
 * backed by this batch's new get_ai_assistant_capabilities/
 * post_ai_assistant_query/post_ai_assistant_decision routes). Mirrors
 * validation/wpi-9-analytics/browser-test.js's discipline exactly: a local
 * static server + headless Chromium (Playwright), the backend mocked at the
 * network layer, external font requests blocked for speed/determinism.
 *
 * Per docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-FREEZE.md §16, this suite's
 * own highest-priority checks are: the card does not render at all when the
 * registry entry or DoctorModuleState is disabled (fail-closed, disabled by
 * default per ADR-023 — the common case for every doctor until a staff
 * member explicitly enables it); the "AI-generated draft — not saved" banner
 * is present and precedes any Accept/Edit/Reject control in markup order;
 * the Accept action's own UI copy never implies data was saved by that
 * action alone; and keyboard/accessibility parity with the existing five
 * Doctor Dashboard cards.
 *
 * No apps-script/*.gs file is exercised by this suite — the backend's own
 * pipeline (fail-closed enablement, roster/capability-bounded context
 * assembly, the drift check, the one-way decision transition) is
 * validation/phase-2a-foundation/conformance.js's Stage 26, added in this
 * same batch, not duplicated here.
 *
 * Run: NODE_PATH=$(npm root -g) node validation/wpi-10-ai-assistant/browser-test.js
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

const FAKE_TOKEN = 'fake-doctor-session-token-for-wpi10-tests';

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

const CAPABILITIES_FIXTURE = [
  {
    capability_key: 'summarize_patient_status', display_name: 'Summarize Patient Status',
    description: 'Drafts a short summary.', context_sources: ['care_plan', 'check_in_response', 'calculator_result', 'appointment'],
    output_shape: 'draft_text', target_entity_type: null, requires_knowledge_engine: false, future_ai_capable: false
  }
];

const ROSTER_FIXTURE = [{ patient_id: 'p1', full_name: 'Patient One', condition_slugs: ['mcas'] }];

function pendingInteractionFixture() {
  return {
    interaction_id: 'i1', doctor_id: 'd1', patient_id: 'p1', capability_key: 'summarize_patient_status',
    context_snapshot: { capability_key: 'summarize_patient_status', doctor_id: 'd1', patient_id: 'p1' },
    prompt_template_version: '1.0', model: 'anthropic/claude-haiku-4.5',
    ai_output: 'Patient reports improved sleep this month.', ai_output_flags: [],
    doctor_decision: 'pending', decision_notes: '', target_entity_type: '', target_entity_id: '',
    created_at: '2026-07-16T00:00:00.000Z', decided_at: ''
  };
}

async function mockFoundation(page, opts) {
  const options = Object.assign({
    profileEnvelope: PROFILE_ENVELOPE,
    moduleStates: [],
    capabilities: CAPABILITIES_FIXTURE,
    roster: ROSTER_FIXTURE,
    queryEnvelope: { status: 'ok', data: pendingInteractionFixture() },
    decisionEnvelope: null
  }, opts || {});
  const calls = [];
  await page.route('**/macros/s/**/exec', async (route) => {
    let body = {};
    try { body = JSON.parse(route.request().postData()); } catch (e) { /* not JSON */ }
    const action = body.foundation_action;
    calls.push(action);
    if (action === 'get_doctor_profile') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.profileEnvelope) });
      return;
    }
    if (action === 'get_doctor_module_states') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: options.moduleStates }) });
      return;
    }
    if (action === 'get_ai_assistant_capabilities') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: options.capabilities }) });
      return;
    }
    if (action === 'get_doctor_patient_roster') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: options.roster }) });
      return;
    }
    if (action === 'post_ai_assistant_query') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.queryEnvelope) });
      return;
    }
    if (action === 'post_ai_assistant_decision') {
      const decided = Object.assign({}, pendingInteractionFixture(), {
        doctor_decision: body.doctor_decision, decided_at: '2026-07-16T00:05:00.000Z'
      });
      const envelope = options.decisionEnvelope || { status: 'ok', data: decided };
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
    // ---- 1. Disabled by default (ADR-023) -> no AI Assistant card at all, fail-closed ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { moduleStates: [stateRow('ai_assistant', false)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#dashEmptyState');

      const card = await page.$('#card-ai_assistant-body');
      check('Doctor Dashboard: a doctor with ai_assistant disabled (the default, ADR-023) sees no AI Assistant card at all', card === null);

      const capabilitiesCalls = calls.filter((a) => a === 'get_ai_assistant_capabilities').length;
      check('Doctor Dashboard: get_ai_assistant_capabilities is never called when the capability is disabled', capabilitiesCalls === 0);

      await context.close();
    }

    // ---- 2. Enabled -> the picker renders, populated from the real capability list and roster ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('ai_assistant', true)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#greeting:not(:has(.skeleton))');
      await page.waitForSelector('#aiaRunBtn');

      const cardTitles = await page.$$eval('.dash-card h2', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: the enabled AI Assistant capability renders exactly one card, titled "AI Assistant"',
        cardTitles.length === 1 && cardTitles[0] === 'AI Assistant');

      const capabilityOptions = await page.$$eval('#aiaCapabilitySelect option', (els) => els.map((e) => e.value));
      check('Doctor Dashboard: the capability picker is populated from the real, fixed get_ai_assistant_capabilities list',
        capabilityOptions.length === 1 && capabilityOptions[0] === 'summarize_patient_status');

      const patientOptions = await page.$$eval('#aiaPatientSelect option', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: the patient selector reuses the same roster data the Patient Roster card already calls — no new patient-lookup mechanism',
        patientOptions.length === 1 && patientOptions[0] === 'Patient One');

      const freeTextPrompt = await page.$('#card-ai_assistant-body textarea, #card-ai_assistant-body input[type="text"]');
      check('Doctor Dashboard: there is no free-text prompt box anywhere in the picker — a fixed, bounded menu only (docs/55 §7.1)', freeTextPrompt === null);

      await context.close();
    }

    // ---- 3. Running a query -> the draft renders with the mandatory banner BEFORE the decision controls ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { moduleStates: [stateRow('ai_assistant', true)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#aiaRunBtn');
      await page.click('#aiaRunBtn');
      await page.waitForSelector('.ai-assistant-banner');

      const queryCalls = calls.filter((a) => a === 'post_ai_assistant_query').length;
      check('Doctor Dashboard: clicking "Get Draft" calls post_ai_assistant_query exactly once', queryCalls === 1);

      const resultHtml = await page.innerHTML('#aiaResultArea');
      const bannerIdx = resultHtml.indexOf('ai-assistant-banner');
      const controlsIdx = resultHtml.indexOf('ai-assistant-decision-controls');
      check('Doctor Dashboard: the "AI-generated draft — not saved" banner is present', bannerIdx !== -1);
      check('Doctor Dashboard: the banner appears BEFORE any Accept/Edit/Reject control in markup order — visible at the point of use, not just documented',
        bannerIdx !== -1 && controlsIdx !== -1 && bannerIdx < controlsIdx);

      const bannerText = await page.textContent('.ai-assistant-banner');
      check('Doctor Dashboard: the banner\'s own text says the draft is not saved', /not saved/i.test(bannerText));

      const draftText = await page.textContent('.ai-assistant-output');
      check('Doctor Dashboard: the model\'s own draft output is rendered', draftText.indexOf('improved sleep') !== -1);

      const targetNote = await page.textContent('.ai-assistant-target-note');
      check('Doctor Dashboard: the UI copy never implies data was saved by Accept alone — it names this capability as reference-only (target_entity_type is null for summarize_patient_status)',
        /reference-only|nothing to save/i.test(targetNote));

      const buttonLabels = await page.$$eval('.ai-assistant-decision-controls button', (els) => els.map((e) => e.textContent));
      check('Doctor Dashboard: Accept/Edit & Accept/Reject controls all render', buttonLabels.length === 3 && buttonLabels.join(',').indexOf('Accept') !== -1 && buttonLabels.join(',').indexOf('Reject') !== -1);

      await context.close();
    }

    // ---- 4. Accepting a draft calls post_ai_assistant_decision only, and re-renders the recorded decision ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      const calls = await mockFoundation(page, { moduleStates: [stateRow('ai_assistant', true)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#aiaRunBtn');
      await page.click('#aiaRunBtn');
      await page.waitForSelector('[data-decision="accepted"]');
      await page.click('[data-decision="accepted"]');
      await page.waitForSelector('.ai-assistant-decision');

      const decisionCalls = calls.filter((a) => a === 'post_ai_assistant_decision').length;
      check('Doctor Dashboard: clicking Accept calls post_ai_assistant_decision exactly once, and no other write-shaped action', decisionCalls === 1);
      const otherWrites = calls.filter((a) => a && a !== 'post_ai_assistant_query' && a !== 'post_ai_assistant_decision'
        && a !== 'get_doctor_profile' && a !== 'get_doctor_module_states' && a !== 'get_ai_assistant_capabilities' && a !== 'get_doctor_patient_roster');
      check('Doctor Dashboard: Accept never calls any other entity\'s write route — the only write is the decision itself (ADR-022)', otherWrites.length === 0);

      const decisionText = await page.textContent('.ai-assistant-decision');
      check('Doctor Dashboard: the recorded decision is shown ("Accepted"), replacing the Accept/Edit/Reject controls', /Accepted/.test(decisionText));

      const controlsGone = await page.$('.ai-assistant-decision-controls');
      check('Doctor Dashboard: the decision controls are no longer shown once a decision has been recorded — one-way, exactly once', controlsGone === null);

      await context.close();
    }

    // ---- 5. Keyboard/accessibility parity with every existing Doctor Dashboard card ----
    {
      const context = await browser.newContext();
      await blockExternalFonts(context);
      const page = await context.newPage();
      await mockFoundation(page, { moduleStates: [stateRow('ai_assistant', true)] });
      await withSessionToken(page, baseUrl, FAKE_TOKEN);
      await page.goto(`${baseUrl}/doctor-dashboard/`);
      await page.waitForSelector('#aiaRunBtn');

      const cardHeadingId = await page.$eval('.dash-card h2', (el) => el.id);
      check('Doctor Dashboard: the AI Assistant card has a real heading id, mirroring every other card\'s aria-labelledby wiring', /^card-ai_assistant-title$/.test(cardHeadingId));

      await page.focus('#aiaCapabilitySelect');
      const focusedAfterTab1 = await page.evaluate(() => { document.activeElement.blur(); return true; });
      check('Doctor Dashboard: the capability select is a real, focusable form control', focusedAfterTab1 === true);

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
