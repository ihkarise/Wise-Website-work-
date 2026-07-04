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

  // Three distinct empty-state types (docs/37 §5, approved design decision):
  //  - nodata:  a real, wired feature with zero rows for this patient. No
  //             card in this batch has a live data source yet, so this
  //             variant has no consumer here — the same "built, verified,
  //             consumer arrives in a later batch" pattern the backend's own
  //             static-analysis findings already use (docs/29 §14 F4/F5).
  //             Exercised directly (not reimplemented) by
  //             validation/pa-2-dashboard/browser-test.js via window.WiseDashboard.
  //  - phase2a: named, sequenced later in this same phase (5D/5E/5F). Batch
  //             PA-5 (5F, Reports) was this badge's last live consumer —
  //             no card renders it anymore, but it is kept, unremoved, for
  //             the same "built, verified, no current consumer" reason
  //             'nodata' above was kept through PA-2/PA-3: still exercised
  //             by validation/pa-2-dashboard/browser-test.js via
  //             window.WiseDashboard, and available again the moment a
  //             future card needs a "coming later" state of its own.
  //  - future:  no architecture exists yet for this feature at all (docs/29 §2.2).
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
      '<a class="secondary" href="/my-health-journey/timeline/">View full timeline</a>';
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
      '<a class="secondary" href="/my-health-journey/reports/">View full history</a>';
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

  function loadReportsPreview(sessionToken) {
    var reportsBody = document.getElementById('card-reports-body');
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
      '<a class="secondary" href="/my-health-journey/symptoms/">View full history</a>';
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

  function loadSymptomPreview(sessionToken) {
    var symptomsBody = document.getElementById('card-symptoms-body');
    symptomsBody.innerHTML = symptomFormHtml();
    wireSymptomForm(sessionToken);
    refreshSymptomSummary(sessionToken);
  }

  // Independent of renderDashboard()'s own get_profile call (docs/38 §5's
  // own forward note: per-card loading becomes real once a card has its
  // own separately-timed data call — this is the first one). A failure
  // here never disturbs the rest of the dashboard.
  function loadTimelinePreview(sessionToken) {
    var timelineBody = document.getElementById('card-timeline-body');
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

  function renderDashboard(profile) {
    greeting.textContent = 'Hi, ' + profile.full_name;
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML =
      cardHtml('timeline', 'Timeline', '<div class="skeleton"></div><div class="skeleton"></div>') +
      cardHtml('symptoms', 'Symptom Tracker', '<div class="skeleton"></div><div class="skeleton"></div>') +
      cardHtml('reports', 'Reports', '<div class="skeleton"></div><div class="skeleton"></div>') +
      cardHtml('careplan', 'Care Plan', emptyStateHtml('future',
        'A personalised care plan is planned for a future version of Wise Homeopathy.')) +
      cardHtml('messages', 'Messages', emptyStateHtml('future',
        'Secure messaging with the clinic is planned for a future version.')) +
      cardHtml('digitaltwin', 'Digital Twin', emptyStateHtml('future',
        'Your Wise Digital Twin and AI health summaries are planned for a future version.'));
  }

  var token = window.sessionStorage.getItem(SESSION_KEY);
  if (!token) {
    goToLogin();
    return;
  }

  fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ foundation_action: 'get_profile', session_token: token })
  })
    .then(function (response) { return response.json(); })
    .then(function (data) {
      // Every rejection reason (expired, tampered, unknown) collapses to the
      // same FOUNDATION_UNAUTHORIZED code server-side (FoundationRouteGuard.gs)
      // — the client mirrors that by showing one generic message regardless
      // of which occurred, rather than guessing a more specific one.
      if (data.status === 'ok') {
        renderDashboard(data.data);
        loadTimelinePreview(token);
        loadSymptomPreview(token);
        loadReportsPreview(token);
      } else {
        goToLogin('expired');
      }
    })
    .catch(function () {
      // A network failure is not a session failure — keep the token and let
      // the patient retry, rather than forcing a re-login on a connectivity
      // blip (docs/04 Error State: friendly, actionable, never technical).
      grid.setAttribute('aria-busy', 'false');
      grid.innerHTML = '<div class="card dash-card" style="grid-column:1/-1"><p class="sub" style="text-align:left;margin-bottom:0">Could not reach the server. Check your connection and reload the page.</p></div>';
    });

  // Explicit, minimal test-support surface — exposes the pure formatting
  // functions so validation/pa-2-dashboard/browser-test.js can exercise the
  // real code (including the 'nodata' variant, which has no page consumer
  // yet) directly, rather than re-implementing this logic in the test.
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
    REPORT_ALLOWED_MIME_TYPES: REPORT_ALLOWED_MIME_TYPES
  };
})();
