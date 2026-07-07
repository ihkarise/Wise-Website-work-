(function () {
  // Same Apps Script Web App deployment login.html/verify.html use —
  // Foundation and Phase 1.5 share one project/one doPost (docs/29 §14
  // Decision 1).
  var WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwrAx9jPnji2U-ngBpYTtV2p_SJnnFrYa7fKYo589zeVfRrwuz3N5aIS0xeiQeuFvMhIQ/exec';
  var SESSION_KEY = 'wise_session_token';

  var grid = document.getElementById('dashGrid');
  var greeting = document.getElementById('greeting');
  var signOutBtn = document.getElementById('signOutBtn');

  function goToLogin(reason) {
    window.sessionStorage.removeItem(SESSION_KEY);
    window.location.href = '../login.html' + (reason ? '?reason=' + reason : '');
  }

  signOutBtn.addEventListener('click', function () {
    goToLogin();
  });

  // Batch PXP-4 (docs/44 §7.3/§13, docs/47 §3, ADR-012 (amended)) — the
  // dashboard is now a registry-driven consumer of PXP-3's Module Registry
  // plus PatientModuleState. Every card that renders here corresponds to a
  // registry entry the patient is enabled for; no card is hardcoded, no
  // card is disease-specific. Adding a new module later means (i) add a
  // registry entry (in shared/constants/module-registry.json,
  // apps-script/ModuleRegistry.gs, and this file's MODULE_REGISTRY below);
  // (ii) register a loader against its data_source in MODULE_LOADERS
  // below — renderDashboard() itself never learns any specific module_id.
  //
  // Hand-ported from shared/constants/module-registry.json version 1.0.0 —
  // the same "port a shared/ definition into a consuming file" convention
  // CONDITION_OPTIONS (below), REPORT_MAX_UPLOAD_BYTES (below), and
  // apps-script/ModuleRegistry.gs's FOUNDATION_MODULE_REGISTRY_ already use
  // (a browser has no ES-module/build-step to read the canonical JSON at
  // runtime — a static hand-port is the same discipline every other
  // shared/ constant already follows in this file). Only the fields the
  // dashboard actually consumes today (module_id, title, display_order,
  // empty_state, data_source) are duplicated here — the reserved/inert
  // supports_*/future_ai_capable/etc. fields stay in the canonical JSON
  // where a future consumer will pick them up (module-registry.md §
  // "Which fields does PXP-3 code actually consume?"). Update all three
  // ports by hand if the canonical list ever changes.
  var MODULE_REGISTRY = [
    { module_id: 'timeline',        title: 'Timeline',        display_order: 10, empty_state: 'nodata', data_source: 'get_timeline' },
    { module_id: 'symptom_tracker', title: 'Symptom Tracker', display_order: 20, empty_state: 'nodata', data_source: 'get_symptom_logs' },
    { module_id: 'reports',         title: 'Reports',         display_order: 30, empty_state: 'nodata', data_source: 'get_reports' }
  ];

  function getModuleDescriptor(moduleId) {
    for (var i = 0; i < MODULE_REGISTRY.length; i++) {
      if (MODULE_REGISTRY[i].module_id === moduleId) return MODULE_REGISTRY[i];
    }
    return null;
  }

  // Three distinct empty-state types (docs/37 §5, approved design decision):
  //  - nodata:  a real, wired feature with zero rows for this patient. Every
  //             registry-enabled card (Timeline, Symptom Tracker, Reports)
  //             renders this variant when its own get_* call returns [].
  //  - phase2a: named, sequenced later in the same phase. Kept here for the
  //             same "built, verified, no current consumer" reason it was
  //             kept through PA-5 — still exercised by
  //             validation/pa-2-dashboard/browser-test.js via
  //             window.WiseDashboard, and available the moment a future
  //             card needs a "coming later" state of its own.
  //  - future:  no architecture exists yet for this feature at all. PXP-4
  //             removes this variant from any live card — the three
  //             pre-PXP-4 "future" placeholders (Care Plan, Messages,
  //             Digital Twin) are not in the Module Registry (docs/47 §4:
  //             a not-yet-built module is not pre-declared here by an
  //             earlier batch guessing its shape) so they simply do not
  //             render on any patient's dashboard until a future batch
  //             adds them, at which point they will re-appear via the
  //             registry, not as a hardcoded emptyStateHtml('future', …)
  //             call in this file.
  var EMPTY_STATE_BADGES = {
    nodata: ['badge-nodata', 'No entries yet'],
    phase2a: ['badge-phase2a', 'Coming later in Phase 2A'],
    future: ['badge-future', 'Planned for a future version']
  };

  function emptyStateHtml(type, text) {
    var badge = EMPTY_STATE_BADGES[type];
    return '<p class="empty-badge ' + badge[0] + '">' + badge[1] + '</p>' +
      '<p class="empty-text">' + text + '</p>';
  }

  function cardHtml(id, title, bodyHtml) {
    return '<section class="card dash-card" aria-labelledby="card-' + id + '-title">' +
      '<h2 id="card-' + id + '-title">' + title + '</h2>' +
      '<div class="empty-state" id="card-' + id + '-body">' + bodyHtml + '</div>' +
      '</section>';
  }

  // Batch PA-3: the Timeline card is the first to leave the "Coming later
  // in Phase 2A" placeholder behind (docs/38 §9's own anticipated next
  // step: "wiring real data into the dashboard's existing Empty State
  // cards"). Real entry text is patient/staff-authored content read back
  // from the backend and inserted via innerHTML — escaped here, unlike
  // every other card's hardcoded copy, which never needed it.
  function escapeHtmlForDisplay(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function timelinePreviewHtml(entries) {
    if (!entries.length) {
      // 'nodata' gets its first real page consumer here — previously
      // built and verified (docs/38 §4) but never rendered from real data.
      return emptyStateHtml('nodata', 'Your consultation history will appear here after your next visit.');
    }
    // Inline styles only, referencing the existing shared tokens (never a
    // new CSS class) — keeps this addition confined to dashboard.js
    // without touching index.html's own <style> block at all.
    var items = entries.slice(0, 3).map(function (e) {
      return '<li style="margin-bottom:8px;font-size:14px;color:var(--color-text-secondary)">' +
        '<strong style="color:var(--color-brand-strong)">' + escapeHtmlForDisplay(e.entry_date) + '</strong> — ' +
        escapeHtmlForDisplay(e.title) + '</li>';
    }).join('');
    return '<ul style="list-style:none;padding:0;margin:0 0 14px">' + items + '</ul>' +
      '<a class="secondary" href="../my-health-journey/timeline/">View full timeline</a>';
  }

  // Batch PA-4: the Symptom Tracker card's canonical condition-slug
  // options, manually adapted from shared/constants/condition-slugs.json
  // version 1.0.0 (the same "port a shared/ definition into a consuming
  // file" convention apps-script/FoundationSymptomLog.gs's own
  // FOUNDATION_ALLOWED_CONDITION_SLUGS_ already uses) — update both
  // places by hand if the canonical list ever changes.
  var CONDITION_OPTIONS = [
    { slug: 'mcas', label: 'MCAS (Mast Cell Activation Syndrome)' },
    { slug: 'hashimotos-thyroiditis', label: "Hashimoto's Thyroiditis" },
    { slug: 'chronic-urticaria', label: 'Chronic Urticaria' },
    { slug: 'eczema', label: 'Eczema' },
    { slug: 'allergic-rhinitis', label: 'Allergic Rhinitis' },
    { slug: 'eosinophilic-esophagitis', label: 'Eosinophilic Esophagitis' },
    { slug: 'pots', label: 'POTS' },
    { slug: 'dermographism', label: 'Dermographism' }
  ];

  function conditionOptionsHtml() {
    return '<option value="">— None —</option>' + CONDITION_OPTIONS.map(function (c) {
      return '<option value="' + c.slug + '">' + escapeHtmlForDisplay(c.label) + '</option>';
    }).join('');
  }

  // Batch PA-5: manually adapted from shared/constants/upload-limits.json
  // version 1.0.0 — the same "port a shared/ definition into a consuming
  // file" convention CONDITION_OPTIONS already uses. A UX-only pre-check
  // (docs/29 §8: "client-side limits are UX only, never trusted") — the
  // server performs the real, content-based, authorization-grade
  // validation regardless (apps-script/FoundationReports.gs).
  var REPORT_MAX_UPLOAD_BYTES = 5242880;
  var REPORT_ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  var REPORT_ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

  // The Reports card's write affordance (docs/29 §5/§8) — a file picker
  // plus an upload button, the same .field/.submit/.status pattern the
  // Symptom Tracker card's form already established. Reuses .field input
  // unchanged for the file input itself — no new CSS rule needed.
  function reportsFormHtml() {
    return '<form id="reportForm">' +
      '<div class="field"><label for="reportFile">Choose a file (PDF, JPG, or PNG — up to 5 MB)</label>' +
      '<input id="reportFile" type="file" accept="' + REPORT_ACCEPT_ATTR + '" required></div>' +
      '<button class="submit" type="submit" id="reportSubmitBtn">Upload report</button>' +
      '<div class="status" id="reportStatus" role="status" aria-live="polite"></div>' +
      '</form>' +
      '<div id="reportsList" style="margin-top:14px"></div>';
  }

  // "Recent uploads" (docs/29 §5) — date + filename only, the same bare
  // preview style timelinePreviewHtml() already uses, capped to 3 with a
  // link to the full history page.
  function reportsListHtml(entries) {
    if (!entries.length) {
      return emptyStateHtml('nodata', 'Your uploaded reports will appear here once you upload your first one.');
    }
    var items = entries.slice(0, 3).map(function (r) {
      return '<li style="margin-bottom:8px;font-size:14px;color:var(--color-text-secondary)">' +
        '<strong style="color:var(--color-brand-strong)">' + escapeHtmlForDisplay(String(r.uploaded_at).slice(0, 10)) + '</strong> — ' +
        escapeHtmlForDisplay(r.file_name) + '</li>';
    }).join('');
    return '<ul style="list-style:none;padding:0;margin:0 0 14px">' + items + '</ul>' +
      '<a class="secondary" href="../my-health-journey/reports/">View full history</a>';
  }

  // Reads a File as a base64 string (no "data:...;base64," prefix) via
  // FileReader — the browser-side half of the upload payload
  // FoundationReports.gs's foundationCreateReport_() decodes server-side.
  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result);
        var commaIndex = result.indexOf(',');
        resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1));
      };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(file);
    });
  }

  // Independent of loadReportsPreview()'s own initial call, same
  // "per-card loading, one failure never disturbs another card"
  // discipline PA-3/PA-4 already established.
  function refreshReportsList(sessionToken) {
    var listEl = document.getElementById('reportsList');
    if (!listEl) return;
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_reports', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status === 'ok' && Array.isArray(data.data)) {
          listEl.innerHTML = reportsListHtml(data.data);
        } else {
          listEl.innerHTML = '<p class="empty-text">Could not load your reports. Check your connection and reload the page.</p>';
        }
      })
      .catch(function () {
        listEl.innerHTML = '<p class="empty-text">Could not load your reports. Check your connection and reload the page.</p>';
      });
  }

  // Submission feedback via the existing .status/role=status/aria-live
  // component (the same pattern wireSymptomForm() already uses).
  function wireReportForm(sessionToken) {
    var form = document.getElementById('reportForm');
    var fileInput = document.getElementById('reportFile');
    var submitBtn = document.getElementById('reportSubmitBtn');
    var statusBox = document.getElementById('reportStatus');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var file = fileInput.files[0];
      if (!file) return;

      // Client-side pre-checks are UX only (docs/29 §8) — an immediate,
      // friendly rejection before ever uploading a whole file; the server
      // performs the real, content-based validation regardless.
      if (file.size > REPORT_MAX_UPLOAD_BYTES) {
        statusBox.className = 'status err';
        statusBox.textContent = 'That file is larger than the ' + (REPORT_MAX_UPLOAD_BYTES / (1024 * 1024)) + ' MB limit.';
        return;
      }
      if (REPORT_ALLOWED_MIME_TYPES.indexOf(file.type) === -1) {
        statusBox.className = 'status err';
        statusBox.textContent = 'That file type is not supported. Please upload a PDF, JPG, or PNG.';
        return;
      }

      submitBtn.disabled = true;
      statusBox.className = 'status loading';
      statusBox.textContent = 'Uploading…';

      readFileAsBase64(file)
        .then(function (base64) {
          return fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              foundation_action: 'upload_report',
              session_token: sessionToken,
              file_name: file.name,
              mime_type: file.type,
              file_base64: base64
            })
          });
        })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          submitBtn.disabled = false;
          if (data.status === 'ok') {
            statusBox.className = 'status ok';
            statusBox.textContent = 'Uploaded. Thank you.';
            form.reset();
            refreshReportsList(sessionToken);
          } else {
            statusBox.className = 'status err';
            statusBox.textContent = (data.error && data.error.message) || 'Something went wrong. Please try again.';
          }
        })
        .catch(function () {
          // A network failure keeps the patient's chosen file selected
          // (no form.reset()) rather than making them re-pick it
          // (docs/04 Error State), the same discipline wireSymptomForm()
          // already applies to its own in-progress values.
          submitBtn.disabled = false;
          statusBox.className = 'status err';
          statusBox.textContent = 'Could not reach the server. Check your connection and try again.';
        });
    });
  }

  // Registry-driven signature (moduleId): the DOM id fragment is derived
  // from the registry descriptor's module_id, not a hardcoded literal —
  // renderDashboard() built '#card-' + moduleId + '-body' generically, so
  // the loader looks it up the same way.
  function loadReportsPreview(sessionToken, moduleId) {
    var reportsBody = document.getElementById('card-' + moduleId + '-body');
    reportsBody.innerHTML = reportsFormHtml();
    wireReportForm(sessionToken);
    refreshReportsList(sessionToken);
  }

  // The Symptom Tracker card's write affordance (docs/29 §9, docs/41 §2) —
  // the only dashboard card whose primary content is a form, not a read
  // preview. All four scale fields are plain number inputs (type="number",
  // min/max/step), not range sliders — sidesteps the "bare slider with no
  // visible value" accessibility gap docs/41 §13 warns about, while still
  // reusing assets/site.css's existing .field/label pattern unchanged.
  function symptomFormHtml() {
    return '<form id="symptomForm">' +
      '<div style="display:flex;gap:10px">' +
      '<div class="field" style="flex:1"><label for="sxSeverity">Severity (1–10)</label><input id="sxSeverity" type="number" min="1" max="10" step="1" required></div>' +
      '<div class="field" style="flex:1"><label for="sxSleep">Sleep (1–10)</label><input id="sxSleep" type="number" min="1" max="10" step="1" required></div>' +
      '</div>' +
      '<div style="display:flex;gap:10px">' +
      '<div class="field" style="flex:1"><label for="sxEnergy">Energy (1–10)</label><input id="sxEnergy" type="number" min="1" max="10" step="1" required></div>' +
      '<div class="field" style="flex:1"><label for="sxStress">Stress (1–10)</label><input id="sxStress" type="number" min="1" max="10" step="1" required></div>' +
      '</div>' +
      '<div class="field"><label for="sxNotes">Notes (optional)</label><textarea id="sxNotes" rows="2"></textarea></div>' +
      '<div class="field"><label for="sxCondition">Condition tag (optional)</label><select id="sxCondition">' + conditionOptionsHtml() + '</select></div>' +
      '<button class="submit" type="submit" id="sxSubmitBtn">Log symptoms</button>' +
      '<div class="status" id="sxStatus" role="status" aria-live="polite"></div>' +
      '</form>' +
      '<div id="sxSummary" style="margin-top:14px"></div>';
  }

  // The card's "at most a bare recent-value list" (docs/29 §9) — the
  // most recent entry's four values, one line, no chart, no trend.
  function symptomSummaryHtml(entries) {
    if (!entries.length) {
      return emptyStateHtml('nodata', 'Your logged symptoms will appear here once you log your first entry.');
    }
    var latest = entries[0];
    return '<p style="margin:0 0 8px;font-size:13.5px;color:var(--color-text-secondary)">' +
      '<strong style="color:var(--color-brand-strong)">Last logged ' + escapeHtmlForDisplay(latest.logged_at.slice(0, 10)) + '</strong> — ' +
      'severity ' + escapeHtmlForDisplay(latest.severity) + ', sleep ' + escapeHtmlForDisplay(latest.sleep) +
      ', energy ' + escapeHtmlForDisplay(latest.energy) + ', stress ' + escapeHtmlForDisplay(latest.stress) +
      '</p>' +
      '<a class="secondary" href="../my-health-journey/symptoms/">View full history</a>';
  }

  // Independent of loadTimelinePreview()'s own call, same "per-card
  // loading, one failure never disturbs another card" discipline PA-3
  // established.
  function refreshSymptomSummary(sessionToken) {
    var summaryEl = document.getElementById('sxSummary');
    if (!summaryEl) return;
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_symptom_logs', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status === 'ok' && Array.isArray(data.data)) {
          summaryEl.innerHTML = symptomSummaryHtml(data.data);
        } else {
          summaryEl.innerHTML = '<p class="empty-text">Could not load your symptom history. Check your connection and reload the page.</p>';
        }
      })
      .catch(function () {
        summaryEl.innerHTML = '<p class="empty-text">Could not load your symptom history. Check your connection and reload the page.</p>';
      });
  }

  // Submission feedback via the existing .status/role=status/aria-live
  // component (login.html's own pattern) — this phase's first form whose
  // patient stays on the same page after submitting, so an aria-live
  // region actually matters here for the first time (docs/41 §13).
  function wireSymptomForm(sessionToken) {
    var form = document.getElementById('symptomForm');
    var submitBtn = document.getElementById('sxSubmitBtn');
    var statusBox = document.getElementById('sxStatus');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      submitBtn.disabled = true;
      statusBox.className = 'status loading';
      statusBox.textContent = 'Saving…';

      fetch(WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          foundation_action: 'log_symptom',
          session_token: sessionToken,
          severity: Number(document.getElementById('sxSeverity').value),
          sleep: Number(document.getElementById('sxSleep').value),
          energy: Number(document.getElementById('sxEnergy').value),
          stress: Number(document.getElementById('sxStress').value),
          notes: document.getElementById('sxNotes').value,
          condition_slug: document.getElementById('sxCondition').value
        })
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          submitBtn.disabled = false;
          if (data.status === 'ok') {
            statusBox.className = 'status ok';
            statusBox.textContent = 'Logged. Thank you.';
            form.reset();
            refreshSymptomSummary(sessionToken);
          } else {
            statusBox.className = 'status err';
            statusBox.textContent = (data.error && data.error.message) || 'Something went wrong. Please try again.';
          }
        })
        .catch(function () {
          // A network failure keeps the patient's in-progress values in
          // place (no form.reset()) rather than asking them to re-type a
          // health entry (docs/41 §11, docs/04 Error State).
          submitBtn.disabled = false;
          statusBox.className = 'status err';
          statusBox.textContent = 'Could not reach the server. Check your connection and try again.';
        });
    });
  }

  function loadSymptomPreview(sessionToken, moduleId) {
    var symptomsBody = document.getElementById('card-' + moduleId + '-body');
    symptomsBody.innerHTML = symptomFormHtml();
    wireSymptomForm(sessionToken);
    refreshSymptomSummary(sessionToken);
  }

  // Independent of renderDashboard()'s own get_profile call (docs/38 §5's
  // own forward note: per-card loading becomes real once a card has its
  // own separately-timed data call — this is the first one). A failure
  // here never disturbs the rest of the dashboard.
  function loadTimelinePreview(sessionToken, moduleId) {
    var timelineBody = document.getElementById('card-' + moduleId + '-body');
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_timeline', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status === 'ok' && Array.isArray(data.data)) {
          timelineBody.innerHTML = timelinePreviewHtml(data.data);
        } else {
          timelineBody.innerHTML = '<p class="empty-text">Could not load your timeline. Check your connection and reload the page.</p>';
        }
      })
      .catch(function () {
        timelineBody.innerHTML = '<p class="empty-text">Could not load your timeline. Check your connection and reload the page.</p>';
      });
  }

  // Loader-dispatcher registry — one entry per registry data_source. The
  // registry entry declares data_source; the dashboard resolves that string
  // to a loader function here. renderDashboard() never learns the mapping.
  // Adding a new module: (i) add its registry entry above; (ii) register
  // its loader here — nothing else changes.
  var MODULE_LOADERS = {
    'get_timeline':     loadTimelinePreview,
    'get_symptom_logs': loadSymptomPreview,
    'get_reports':      loadReportsPreview
  };

  // Merges the per-patient state rows from get_patient_module_states with
  // the local registry: keeps only entries whose enabled === true and whose
  // module_id is in the registry (fail-closed on both sides — a state row
  // for a module the client doesn't know about is silently ignored, and a
  // registry entry with no state row does not render). Sorts by
  // display_order — the sole ordering signal, per docs/44 §7.1.
  function filterEnabledModules(stateEntries) {
    var enabled = [];
    for (var i = 0; i < stateEntries.length; i++) {
      var state = stateEntries[i];
      if (!state || state.enabled !== true) continue;
      var descriptor = getModuleDescriptor(state.module_id);
      if (!descriptor) continue;
      enabled.push({ descriptor: descriptor, state: state });
    }
    enabled.sort(function (a, b) { return a.descriptor.display_order - b.descriptor.display_order; });
    return enabled;
  }

  // Whole-dashboard empty state: the patient is authenticated but has no
  // enabled modules (docs/44 §13.3 / docs/47 §3 — the intentional
  // "registry-driven visibility" outcome, not an error). One friendly,
  // full-width card explaining what will change and when, using the same
  // .card/.dash-card/.empty-text tokens every other card uses.
  function dashboardEmptyStateHtml() {
    return '<div class="card dash-card" style="grid-column:1/-1" id="dashEmptyState">' +
      '<p class="empty-text">No dashboard modules are enabled for your account yet. Your doctor will enable modules relevant to your care — you\'ll see them here once they do.</p>' +
      '</div>';
  }

  // Zero-line-per-card: renderDashboard() no longer knows about any
  // specific module. Every card that appears is one whose registry entry
  // exists and whose PatientModuleState.enabled === true.
  function renderDashboard(profile, enabledModules) {
    greeting.textContent = 'Hi, ' + profile.full_name;
    grid.setAttribute('aria-busy', 'false');
    if (!enabledModules.length) {
      grid.innerHTML = dashboardEmptyStateHtml();
      return;
    }
    var html = '';
    for (var i = 0; i < enabledModules.length; i++) {
      var d = enabledModules[i].descriptor;
      html += cardHtml(d.module_id, d.title, '<div class="skeleton"></div><div class="skeleton"></div>');
    }
    grid.innerHTML = html;
  }

  function dispatchLoaders(sessionToken, enabledModules) {
    for (var i = 0; i < enabledModules.length; i++) {
      var d = enabledModules[i].descriptor;
      var loader = MODULE_LOADERS[d.data_source];
      if (!loader) {
        // Registry declares a data_source we have no loader for — leave
        // the card skeleton in place rather than crash. This is the only
        // path where a registered, enabled module fails to render fully;
        // logged so a maintainer notices in dev without disturbing the
        // rest of the dashboard.
        if (window.console && console.warn) {
          console.warn('WiseDashboard: no loader registered for data_source "' + d.data_source +
            '" (module_id "' + d.module_id + '") — card left as skeleton.');
        }
        continue;
      }
      loader(sessionToken, d.module_id);
    }
  }

  var token = window.sessionStorage.getItem(SESSION_KEY);
  if (!token) {
    goToLogin();
    return;
  }

  // Two calls in parallel: get_profile (the header greeting) and
  // get_patient_module_states (PXP-3, the per-patient enablement rows the
  // Dashboard Registry consumer needs). Either rejecting with a non-'ok'
  // envelope collapses to /login.html?reason=expired the same way
  // get_profile did before this batch — every rejection reason
  // (expired/tampered/unknown) becomes FOUNDATION_UNAUTHORIZED server-side
  // (FoundationRouteGuard.gs), which the client mirrors as one generic
  // message rather than guessing a more specific one.
  Promise.all([
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_profile', session_token: token })
    }).then(function (response) { return response.json(); }),
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_patient_module_states', session_token: token })
    }).then(function (response) { return response.json(); })
  ])
    .then(function (results) {
      var profileEnv = results[0];
      var statesEnv = results[1];
      if (profileEnv.status !== 'ok' || statesEnv.status !== 'ok') {
        goToLogin('expired');
        return;
      }
      var stateEntries = Array.isArray(statesEnv.data) ? statesEnv.data : [];
      var enabled = filterEnabledModules(stateEntries);
      renderDashboard(profileEnv.data, enabled);
      dispatchLoaders(token, enabled);
    })
    .catch(function () {
      // A network failure is not a session failure — keep the token and let
      // the patient retry, rather than forcing a re-login on a connectivity
      // blip (docs/04 Error State: friendly, actionable, never technical).
      grid.setAttribute('aria-busy', 'false');
      grid.innerHTML = '<div class="card dash-card" style="grid-column:1/-1"><p class="sub" style="text-align:left;margin-bottom:0">Could not reach the server. Check your connection and reload the page.</p></div>';
    });

  // Explicit, minimal test-support surface — exposes the pure formatting
  // functions plus the new registry-consumer helpers so
  // validation/pa-2-dashboard/browser-test.js and
  // validation/pxp-4-dashboard-registry/browser-test.js can exercise the
  // real code directly rather than re-implementing this logic in the test.
  window.WiseDashboard = {
    emptyStateHtml: emptyStateHtml,
    cardHtml: cardHtml,
    EMPTY_STATE_BADGES: EMPTY_STATE_BADGES,
    symptomFormHtml: symptomFormHtml,
    symptomSummaryHtml: symptomSummaryHtml,
    conditionOptionsHtml: conditionOptionsHtml,
    CONDITION_OPTIONS: CONDITION_OPTIONS,
    reportsFormHtml: reportsFormHtml,
    reportsListHtml: reportsListHtml,
    REPORT_MAX_UPLOAD_BYTES: REPORT_MAX_UPLOAD_BYTES,
    REPORT_ALLOWED_MIME_TYPES: REPORT_ALLOWED_MIME_TYPES,
    MODULE_REGISTRY: MODULE_REGISTRY,
    getModuleDescriptor: getModuleDescriptor,
    filterEnabledModules: filterEnabledModules,
    dashboardEmptyStateHtml: dashboardEmptyStateHtml
  };
})();
