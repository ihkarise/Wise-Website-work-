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
  // Hand-ported from shared/constants/module-registry.json (version 1.1.0
  // as of Batch PXP-10) — the same "port a shared/ definition into a
  // consuming file" convention REPORT_MAX_UPLOAD_BYTES (below) and
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
  // Batch PXP-5 (docs/44 §10/§11/§22) adds the 'daily_checkin' entry below —
  // the same growth this file's own header comment already anticipated
  // ("Adding a new module later means (i) add a registry entry ..."). The
  // three PXP-4 rows above are untouched. Batch PXP-7 (docs/44 §12/§22)
  // adds 'care_plan' the same way — every earlier row is untouched. Batch
  // PXP-10 (docs/44 §10.1/§22, docs/47) removes the 'symptom_tracker' row —
  // Symptom Tracker's dashboard entry is retired now that Daily Check-in is
  // proven in production; SymptomLogs rows are retained permanently and the
  // standalone Symptom History page (my-health-journey/symptoms/) remains
  // reachable directly, only its dashboard entry point is gone (see
  // shared/constants/module-registry.md's "Batch PXP-10 removal" section).
  // Batch WPI-11 (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md §18.1) adds the
  // 'holoscan' row below — every earlier row is untouched.
  var MODULE_REGISTRY = [
    { module_id: 'timeline',        title: 'Timeline',        display_order: 10, empty_state: 'nodata', data_source: 'get_timeline' },
    { module_id: 'daily_checkin',   title: 'Daily Check-in',  display_order: 15, empty_state: 'nodata', data_source: 'get_checkin_responses' },
    { module_id: 'holoscan',        title: 'Medication Photo Scan', display_order: 20, empty_state: 'nodata', data_source: 'get_holoscan_recognitions' },
    { module_id: 'reports',         title: 'Reports',         display_order: 30, empty_state: 'nodata', data_source: 'get_reports' },
    { module_id: 'care_plan',       title: 'Care Plan',       display_order: 40, empty_state: 'nodata', data_source: 'get_care_plan' },
    { module_id: 'health_milestones', title: 'Health Milestones', display_order: 45, empty_state: 'nodata', data_source: 'get_health_milestones' },
    { module_id: 'health_story',      title: 'Health Story',      display_order: 50, empty_state: 'nodata', data_source: 'get_health_story' }
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

  // Batch WPI-11 (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md §19.1) — the
  // Holoscan card's write affordance: a multi-photo upload form, mirroring the
  // Reports card's own upload-form precedent exactly (docs/44 §17's pattern
  // reused, not reinvented), extended to `multiple` file selection since one
  // recognition may cover several photographed packages.
  var HOLOSCAN_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
  var HOLOSCAN_MAX_UPLOAD_BYTES = 5242880;
  var HOLOSCAN_ACCEPT_ATTR = '.jpg,.jpeg,.png,image/jpeg,image/png';

  function holoscanFormHtml() {
    return '<form id="holoscanForm">' +
      '<div class="field"><label for="holoscanFiles">Choose one or more photos (JPG or PNG — up to 5 MB each)</label>' +
      '<input id="holoscanFiles" type="file" accept="' + HOLOSCAN_ACCEPT_ATTR + '" multiple required></div>' +
      '<button class="submit" type="submit" id="holoscanSubmitBtn">Scan medicine</button>' +
      '<div class="status" id="holoscanStatus" role="status" aria-live="polite"></div>' +
      '</form>' +
      '<div id="holoscanList" style="margin-top:14px"></div>';
  }

  var HOLOSCAN_STATUS_LABELS = { uploaded: 'Uploaded', processing: 'Processing', completed: 'Reviewed by pipeline', failed: 'Could not be processed' };
  var HOLOSCAN_DECISION_LABELS = { pending: 'Awaiting doctor review', approved: 'Approved by doctor', corrected_and_approved: 'Approved (with corrections) by doctor', rejected: 'Rejected by doctor' };

  // A recognition-history list (docs/56 §19.1) — each past submission's own status,
  // and, once reviewed, each item's own decision. Never shows a raw, un-reviewed
  // candidate as if it were already part of the patient's medication record — only
  // its review status.
  function holoscanListHtml(entries) {
    if (!entries.length) {
      return emptyStateHtml('nodata', 'Your photographed medicines will appear here once you submit your first scan.');
    }
    var items = entries.slice(0, 3).map(function (r) {
      var itemLines = (r.items || []).map(function (item) {
        return escapeHtmlForDisplay(item.extracted_name || 'Unreadable candidate') + ' — ' +
          escapeHtmlForDisplay(HOLOSCAN_DECISION_LABELS[item.doctor_decision] || item.doctor_decision);
      }).join('<br>');
      return '<li style="margin-bottom:8px;font-size:14px;color:var(--color-text-secondary)">' +
        '<strong style="color:var(--color-brand-strong)">' + escapeHtmlForDisplay(String(r.submitted_at).slice(0, 10)) + '</strong> — ' +
        escapeHtmlForDisplay(HOLOSCAN_STATUS_LABELS[r.status] || r.status) +
        (itemLines ? '<br>' + itemLines : '') + '</li>';
    }).join('');
    return '<ul style="list-style:none;padding:0;margin:0 0 14px">' + items + '</ul>' +
      '<a class="secondary" href="../my-health-journey/medications/">View medication history</a>';
  }

  function refreshHoloscanList(sessionToken) {
    var listEl = document.getElementById('holoscanList');
    if (!listEl) return;
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_holoscan_recognitions', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status === 'ok' && Array.isArray(data.data)) {
          listEl.innerHTML = holoscanListHtml(data.data);
        } else {
          listEl.innerHTML = '<p class="empty-text">Could not load your scans. Check your connection and reload the page.</p>';
        }
      })
      .catch(function () {
        listEl.innerHTML = '<p class="empty-text">Could not load your scans. Check your connection and reload the page.</p>';
      });
  }

  function wireHoloscanForm(sessionToken) {
    var form = document.getElementById('holoscanForm');
    var filesInput = document.getElementById('holoscanFiles');
    var submitBtn = document.getElementById('holoscanSubmitBtn');
    var statusBox = document.getElementById('holoscanStatus');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var files = Array.prototype.slice.call(filesInput.files || []);
      if (!files.length) return;

      // Client-side pre-checks are UX only (docs/29 §8) — the server performs the
      // real, content-based validation regardless.
      for (var i = 0; i < files.length; i++) {
        if (files[i].size > HOLOSCAN_MAX_UPLOAD_BYTES) {
          statusBox.className = 'status err';
          statusBox.textContent = 'Each photo must be smaller than ' + (HOLOSCAN_MAX_UPLOAD_BYTES / (1024 * 1024)) + ' MB.';
          return;
        }
        if (HOLOSCAN_ALLOWED_MIME_TYPES.indexOf(files[i].type) === -1) {
          statusBox.className = 'status err';
          statusBox.textContent = 'That file type is not supported. Please upload a JPG or PNG photo.';
          return;
        }
      }

      submitBtn.disabled = true;
      statusBox.className = 'status loading';
      statusBox.textContent = 'Scanning…';

      Promise.all(files.map(function (file) {
        return readFileAsBase64(file).then(function (base64) {
          return { file_name: file.name, mime_type: file.type, file_base64: base64 };
        });
      }))
        .then(function (images) {
          return fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ foundation_action: 'submit_holoscan_recognition', session_token: sessionToken, images: images })
          });
        })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          submitBtn.disabled = false;
          if (data.status === 'ok') {
            statusBox.className = 'status ok';
            statusBox.textContent = 'Submitted. Your doctor will review it.';
            form.reset();
            refreshHoloscanList(sessionToken);
          } else {
            statusBox.className = 'status err';
            statusBox.textContent = (data.error && data.error.message) || 'Something went wrong. Please try again.';
          }
        })
        .catch(function () {
          submitBtn.disabled = false;
          statusBox.className = 'status err';
          statusBox.textContent = 'Could not reach the server. Check your connection and try again.';
        });
    });
  }

  function loadHoloscanPreview(sessionToken, moduleId) {
    var body = document.getElementById('card-' + moduleId + '-body');
    body.innerHTML = holoscanFormHtml();
    wireHoloscanForm(sessionToken);
    refreshHoloscanList(sessionToken);
  }

  // Batch PXP-10 (docs/44 §10.1/§22, docs/47) removed the Symptom Tracker
  // card's write affordance (symptomFormHtml/symptomSummaryHtml/
  // refreshSymptomSummary/wireSymptomForm/loadSymptomPreview) and its
  // condition-slug options from this file — the module is no longer in
  // MODULE_REGISTRY above, so no loader is needed. SymptomLogs rows are
  // retained permanently and remain readable via the standalone
  // my-health-journey/symptoms/ page (my-health-journey/symptoms/
  // symptoms.js, untouched by this batch); see shared/constants/
  // module-registry.md's "Batch PXP-10 removal" section for the full,
  // disclosed reasoning.

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

  // Batch PXP-5 (docs/44 §10/§11/§22) — the Daily Check-in card's write
  // affordance. Unlike every earlier card's form, this one is
  // data-driven: rendered from the caller's own current CheckInTemplate
  // (get_checkin_template), not a fixed set of fields — the same
  // registry-driven discipline this whole file already applies at the
  // module level (docs/47 §3's "never hardcode a questionnaire"), applied
  // here one level deeper, to the form's own fields.
  function checkInQuestionFieldHtml(q) {
    var fieldId = 'ci_' + q.field_key;
    var requiredAttr = q.required ? ' required' : '';
    if (q.type === 'number') {
      var minAttr = q.min !== undefined ? ' min="' + q.min + '"' : '';
      var maxAttr = q.max !== undefined ? ' max="' + q.max + '"' : '';
      return '<div class="field"><label for="' + fieldId + '">' + escapeHtmlForDisplay(q.label) + '</label>' +
        '<input id="' + fieldId + '" type="number" step="1"' + minAttr + maxAttr + requiredAttr + '></div>';
    }
    if (q.type === 'boolean') {
      return '<div class="field"><label for="' + fieldId + '">' + escapeHtmlForDisplay(q.label) + '</label>' +
        '<select id="' + fieldId + '"' + requiredAttr + '>' +
        '<option value="">— Select —</option><option value="yes">Yes</option><option value="no">No</option>' +
        '</select></div>';
    }
    // 'string' (and any question type this client doesn't recognize,
    // treated defensively as free text — the server, not this client, is
    // the real authority on what a question's type requires, docs/29 §8).
    return '<div class="field"><label for="' + fieldId + '">' + escapeHtmlForDisplay(q.label) + '</label>' +
      '<textarea id="' + fieldId + '" rows="2"' + requiredAttr + '></textarea></div>';
  }

  function checkInFormHtml(template) {
    return '<form id="checkInForm">' +
      template.questions.map(checkInQuestionFieldHtml).join('') +
      '<button class="submit" type="submit" id="checkInSubmitBtn">Submit check-in</button>' +
      '<div class="status" id="checkInStatus" role="status" aria-live="polite"></div>' +
      '</form>' +
      '<div id="checkInSummary" style="margin-top:14px"></div>';
  }

  function checkInNotAssignedHtml() {
    return '<p class="empty-text">Your doctor hasn\'t assigned a daily check-in yet. Check back after your next visit.</p>';
  }

  // Reads the form back into an {field_key: value} object, coercing each
  // value per its own question's declared type — the server performs the
  // real, authoritative validation regardless (docs/29 §8).
  function readCheckInAnswers(template) {
    var answers = {};
    template.questions.forEach(function (q) {
      var el = document.getElementById('ci_' + q.field_key);
      if (!el || el.value === '') return;
      if (q.type === 'number') {
        answers[q.field_key] = Number(el.value);
      } else if (q.type === 'boolean') {
        if (el.value === 'yes') answers[q.field_key] = true;
        else if (el.value === 'no') answers[q.field_key] = false;
      } else {
        answers[q.field_key] = el.value;
      }
    });
    return answers;
  }

  // The card's "at most a bare recent-value list" (mirrors
  // symptomSummaryHtml()'s own scope), rendered generically from the
  // template's own question labels rather than any hardcoded field name.
  function checkInSummaryHtml(entries, template) {
    if (!entries.length) {
      return emptyStateHtml('nodata', 'Your check-ins will appear here once you submit your first one.');
    }
    var latest = entries[0];
    var parts = template.questions
      .filter(function (q) { return Object.prototype.hasOwnProperty.call(latest.answers, q.field_key); })
      .map(function (q) {
        var value = latest.answers[q.field_key];
        var display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : escapeHtmlForDisplay(value);
        return escapeHtmlForDisplay(q.label) + ': ' + display;
      }).join(', ');
    return '<p style="margin:0 0 8px;font-size:13.5px;color:var(--color-text-secondary)">' +
      '<strong style="color:var(--color-brand-strong)">Last checked in ' + escapeHtmlForDisplay(String(latest.logged_at).slice(0, 10)) + '</strong> — ' + parts +
      '</p>' +
      '<a class="secondary" href="../my-health-journey/checkins/">View full history</a>';
  }

  function refreshCheckInSummary(sessionToken, template) {
    var summaryEl = document.getElementById('checkInSummary');
    if (!summaryEl) return;
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_checkin_responses', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status === 'ok' && Array.isArray(data.data)) {
          summaryEl.innerHTML = checkInSummaryHtml(data.data, template);
        } else {
          summaryEl.innerHTML = '<p class="empty-text">Could not load your check-in history. Check your connection and reload the page.</p>';
        }
      })
      .catch(function () {
        summaryEl.innerHTML = '<p class="empty-text">Could not load your check-in history. Check your connection and reload the page.</p>';
      });
  }

  function wireCheckInForm(sessionToken, template) {
    var form = document.getElementById('checkInForm');
    var submitBtn = document.getElementById('checkInSubmitBtn');
    var statusBox = document.getElementById('checkInStatus');

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
          foundation_action: 'submit_checkin_response',
          session_token: sessionToken,
          template_id: template.template_id,
          template_version: template.version,
          answers: readCheckInAnswers(template)
        })
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          submitBtn.disabled = false;
          if (data.status === 'ok') {
            statusBox.className = 'status ok';
            statusBox.textContent = 'Logged. Thank you.';
            form.reset();
            refreshCheckInSummary(sessionToken, template);
          } else {
            statusBox.className = 'status err';
            statusBox.textContent = (data.error && data.error.message) || 'Something went wrong. Please try again.';
          }
        })
        .catch(function () {
          // A network failure keeps the patient's in-progress answers in
          // place (no form.reset()), the same discipline wireSymptomForm()
          // already applies to its own in-progress values.
          submitBtn.disabled = false;
          statusBox.className = 'status err';
          statusBox.textContent = 'Could not reach the server. Check your connection and try again.';
        });
    });
  }

  // Registry-driven signature (moduleId), mirrors loadSymptomPreview()'s
  // own shape. Fetches the caller's current template first (the form
  // cannot render before the questions are known), then wires the form
  // and loads the recent-history summary independently.
  function loadCheckInPreview(sessionToken, moduleId) {
    var body = document.getElementById('card-' + moduleId + '-body');
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_checkin_template', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status !== 'ok') {
          body.innerHTML = '<p class="empty-text">Could not load your daily check-in. Check your connection and reload the page.</p>';
          return;
        }
        if (!data.data) {
          // A real, expected outcome — the patient's doctor hasn't
          // assigned a template yet — not an error state.
          body.innerHTML = checkInNotAssignedHtml();
          return;
        }
        var template = data.data;
        body.innerHTML = checkInFormHtml(template);
        wireCheckInForm(sessionToken, template);
        refreshCheckInSummary(sessionToken, template);
      })
      .catch(function () {
        body.innerHTML = '<p class="empty-text">Could not load your daily check-in. Check your connection and reload the page.</p>';
      });
  }

  // Batch PXP-7 (docs/44 §12/§22) — the Care Plan card's read-only preview.
  // Doctor-authored only (docs/44 §4.3) — unlike every other card on this
  // dashboard, this one has no form and no write affordance at all.
  function carePlanNotAuthoredHtml() {
    return '<p class="empty-text">Your doctor hasn\'t created a care plan for you yet. Check back after your next visit.</p>';
  }

  // A short preview only (goals, truncated, plus the next review date if
  // set) — the same "bare summary, link to the full page" scope every
  // other history-backed card already applies (mirrors
  // checkInSummaryHtml()/symptomSummaryHtml()'s own brevity).
  function carePlanPreviewHtml(carePlan) {
    var goalsPreview = carePlan.goals.length > 140 ? carePlan.goals.slice(0, 140) + '…' : carePlan.goals;
    var reviewLine = carePlan.next_review_date
      ? '<p style="margin:0 0 8px;font-size:13.5px;color:var(--color-text-secondary)">' +
        '<strong style="color:var(--color-brand-strong)">Next review</strong> — ' + escapeHtmlForDisplay(carePlan.next_review_date) + '</p>'
      : '';
    return '<p style="margin:0 0 8px;font-size:14px;color:var(--color-text-secondary);line-height:1.5">' + escapeHtmlForDisplay(goalsPreview) + '</p>' +
      reviewLine +
      '<a class="secondary" href="../my-health-journey/care-plan/">View full care plan</a>';
  }

  function loadCarePlanPreview(sessionToken, moduleId) {
    var body = document.getElementById('card-' + moduleId + '-body');
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_care_plan', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status !== 'ok') {
          body.innerHTML = '<p class="empty-text">Could not load your care plan. Check your connection and reload the page.</p>';
          return;
        }
        if (!data.data) {
          // A real, expected outcome — the patient's doctor hasn't
          // authored a plan yet — not an error state.
          body.innerHTML = carePlanNotAuthoredHtml();
          return;
        }
        body.innerHTML = carePlanPreviewHtml(data.data);
      })
      .catch(function () {
        body.innerHTML = '<p class="empty-text">Could not load your care plan. Check your connection and reload the page.</p>';
      });
  }

  // Batch PXP-11 (docs/58-PHASE-2C-HEALTH-MILESTONES-ARCHITECTURE-FREEZE.md §19.1) —
  // the Health Milestones card's read-only, celebratory preview. Doctor-authored only
  // (docs/58 §10) — like the Care Plan card, this one has no form and no write
  // affordance at all: no anchor control, no authoring control, no publish control
  // (those are doctor-only). Non-AI (ADR-027) — nothing here is model-generated.
  var MILESTONE_LABELS = { '30_day': '30 Days', '90_day': '90 Days', '6_month': '6 Months', '1_year': '1 Year' };
  var MILESTONE_STATE_LABELS = { upcoming: 'Upcoming', due: 'Due', overdue: 'Due', completed: 'Celebrated' };

  function milestonesNotStartedHtml() {
    return '<p class="empty-text">Your milestone journey hasn\'t started yet. Once your treatment begins, your doctor will set your milestones — 30 days, 90 days, 6 months, and 1 year — and celebrate your progress here.</p>';
  }

  // A short preview only: how many milestones have been celebrated, the next one
  // still ahead, and a link to the full page — the same "bare summary, link to the
  // full page" scope every other history-backed card already applies. Only PUBLISHED
  // reviews are ever present in `reviews` (server-enforced, docs/58 §10.2) — the card
  // never shows a draft.
  function milestonesPreviewHtml(payload) {
    var schedule = (payload && payload.schedule) || [];
    if (!schedule.length) {
      return milestonesNotStartedHtml();
    }
    var completed = schedule.filter(function (p) { return p.state === 'completed'; }).length;
    var nextPoint = schedule.filter(function (p) { return p.state !== 'completed'; })[0];
    var celebratedLine = '<p style="margin:0 0 8px;font-size:14px;color:var(--color-text-secondary);line-height:1.5">' +
      '<strong style="color:var(--color-brand-strong)">' + completed + ' of ' + schedule.length + '</strong> milestones celebrated so far.</p>';
    var nextLine = nextPoint
      ? '<p style="margin:0 0 8px;font-size:13.5px;color:var(--color-text-secondary)">' +
        '<strong style="color:var(--color-brand-strong)">Next</strong> — ' +
        escapeHtmlForDisplay(MILESTONE_LABELS[nextPoint.milestone_type] || nextPoint.milestone_type) +
        ' (' + escapeHtmlForDisplay(MILESTONE_STATE_LABELS[nextPoint.state] || nextPoint.state) + ')</p>'
      : '<p style="margin:0 0 8px;font-size:13.5px;color:var(--color-brand-strong)">All milestones celebrated — wonderful progress.</p>';
    return celebratedLine + nextLine +
      '<a class="secondary" href="../my-health-journey/milestones/">View your milestones</a>';
  }

  function loadHealthMilestonesPreview(sessionToken, moduleId) {
    var body = document.getElementById('card-' + moduleId + '-body');
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_health_milestones', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status !== 'ok') {
          body.innerHTML = '<p class="empty-text">Could not load your milestones. Check your connection and reload the page.</p>';
          return;
        }
        body.innerHTML = milestonesPreviewHtml(data.data);
      })
      .catch(function () {
        body.innerHTML = '<p class="empty-text">Could not load your milestones. Check your connection and reload the page.</p>';
      });
  }

  // Loader-dispatcher registry — one entry per registry data_source. The
  // registry entry declares data_source; the dashboard resolves that string
  // to a loader function here. renderDashboard() never learns the mapping.
  // Adding a new module: (i) add its registry entry above; (ii) register
  // its loader here — nothing else changes.
  // Batch PXP-12 (Phase 2D, docs/59 §14.1) — the Health Story card's read-only, doctor-approved
  // preview. Doctor-generated + doctor-approved-before-visible only (ADR-028): like the Care Plan
  // and Health Milestones cards, this one has no form and no write affordance at all. The patient
  // only ever sees narratives their doctor has already approved (published_output); a pending or
  // rejected draft, and the raw model output, are never returned to the patient by any route.
  function healthStoryNotReadyHtml() {
    return '<p class="empty-text">Your health story is being prepared. Once your doctor reviews and approves a summary of your recorded journey, you\'ll be able to read it here.</p>';
  }

  // A short preview only: how many approved narratives exist, the most recent one's opening, and
  // a link to the full page — the same "bare summary, link to the full page" scope every other
  // history-backed card already applies. Only APPROVED narratives are ever present (server-enforced).
  function healthStoryPreviewHtml(payload) {
    var narratives = (payload && payload.narratives) || [];
    if (!narratives.length) {
      return healthStoryNotReadyHtml();
    }
    var latest = narratives[0];
    var opening = String(latest.published_output || '').slice(0, 160);
    if (String(latest.published_output || '').length > 160) opening += '…';
    var countLine = '<p style="margin:0 0 8px;font-size:14px;color:var(--color-text-secondary);line-height:1.5">' +
      '<strong style="color:var(--color-brand-strong)">' + narratives.length + '</strong> approved ' +
      (narratives.length === 1 ? 'summary' : 'summaries') + ' from your doctor.</p>';
    var previewLine = '<p style="margin:0 0 8px;font-size:13.5px;color:var(--color-text-secondary);line-height:1.5">' +
      escapeHtmlForDisplay(opening) + '</p>';
    return countLine + previewLine +
      '<a class="secondary" href="../my-health-journey/health-story/">Read your health story</a>';
  }

  function loadHealthStoryPreview(sessionToken, moduleId) {
    var body = document.getElementById('card-' + moduleId + '-body');
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_health_story', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status !== 'ok') {
          body.innerHTML = '<p class="empty-text">Could not load your health story. Check your connection and reload the page.</p>';
          return;
        }
        body.innerHTML = healthStoryPreviewHtml(data.data);
      })
      .catch(function () {
        body.innerHTML = '<p class="empty-text">Could not load your health story. Check your connection and reload the page.</p>';
      });
  }

  var MODULE_LOADERS = {
    'get_timeline':               loadTimelinePreview,
    'get_checkin_responses':      loadCheckInPreview,
    'get_holoscan_recognitions':  loadHoloscanPreview,
    'get_reports':                loadReportsPreview,
    'get_care_plan':              loadCarePlanPreview,
    'get_health_milestones':      loadHealthMilestonesPreview,
    'get_health_story':           loadHealthStoryPreview
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
    reportsFormHtml: reportsFormHtml,
    reportsListHtml: reportsListHtml,
    REPORT_MAX_UPLOAD_BYTES: REPORT_MAX_UPLOAD_BYTES,
    REPORT_ALLOWED_MIME_TYPES: REPORT_ALLOWED_MIME_TYPES,
    MODULE_REGISTRY: MODULE_REGISTRY,
    getModuleDescriptor: getModuleDescriptor,
    filterEnabledModules: filterEnabledModules,
    dashboardEmptyStateHtml: dashboardEmptyStateHtml,
    checkInFormHtml: checkInFormHtml,
    checkInQuestionFieldHtml: checkInQuestionFieldHtml,
    checkInSummaryHtml: checkInSummaryHtml,
    checkInNotAssignedHtml: checkInNotAssignedHtml,
    readCheckInAnswers: readCheckInAnswers,
    carePlanPreviewHtml: carePlanPreviewHtml,
    carePlanNotAuthoredHtml: carePlanNotAuthoredHtml,
    holoscanFormHtml: holoscanFormHtml,
    holoscanListHtml: holoscanListHtml,
    HOLOSCAN_ALLOWED_MIME_TYPES: HOLOSCAN_ALLOWED_MIME_TYPES,
    HOLOSCAN_MAX_UPLOAD_BYTES: HOLOSCAN_MAX_UPLOAD_BYTES,
    milestonesPreviewHtml: milestonesPreviewHtml,
    milestonesNotStartedHtml: milestonesNotStartedHtml
  };
})();
