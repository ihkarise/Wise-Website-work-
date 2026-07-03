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
    window.location.href = '/login.html' + (reason ? '?reason=' + reason : '');
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
  //  - phase2a: named, sequenced later in this same phase (5D/5E/5F).
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

  // Batch PA-4: the Symptom Tracker card is the second to leave the
  // "Coming later in Phase 2A" placeholder behind (Timeline was the
  // first, PA-3). Summarizes a submitted entry's scale values the same
  // way FoundationTimeline.gs's foundationBuildSymptomLogTimelineSummary_()
  // does server-side for the merged Timeline — this is a read-time,
  // dashboard-local re-formatting of the same raw fields (get_symptom_logs
  // returns raw rows, not the Timeline's pre-synthesized summary_text),
  // never a second source of truth for what those fields mean.
  function symptomLogSummaryText(row) {
    var parts = [];
    if (row.severity !== '') parts.push('Severity ' + row.severity);
    if (row.sleep !== '') parts.push('Sleep ' + row.sleep);
    if (row.energy !== '') parts.push('Energy ' + row.energy);
    if (row.stress !== '') parts.push('Stress ' + row.stress);
    return parts.length > 0 ? parts.join(' · ') : 'Entry logged';
  }

  function symptomPreviewHtml(history) {
    if (history.draft) {
      return '<p style="font-size:14px;color:var(--color-text-secondary);margin-bottom:14px">You have a draft in progress — private to you until you submit it.</p>' +
        '<a class="secondary" href="/my-health-journey/symptom-tracker/">Continue draft</a>';
    }
    if (history.submitted.length === 0) {
      return emptyStateHtml('nodata', 'Log how you\'re feeling and see your own history here.') +
        '<a class="secondary" href="/my-health-journey/symptom-tracker/">Log your first entry</a>';
    }
    var latest = history.submitted[0];
    return '<p style="margin-bottom:8px;font-size:14px;color:var(--color-text-secondary)">' +
      '<strong style="color:var(--color-brand-strong)">' + escapeHtmlForDisplay(symptomLogSummaryText(latest)) + '</strong>' +
      '</p>' +
      '<p style="margin-bottom:14px;font-size:12.5px;color:var(--color-text-faint)">Last logged ' + escapeHtmlForDisplay(latest.submitted_at) + '</p>' +
      '<a class="secondary" href="/my-health-journey/symptom-tracker/">Log a new entry</a>';
  }

  // Independent of renderDashboard()'s own get_profile call and of
  // loadTimelinePreview() (docs/38 §5's own "per-card loading becomes real
  // once a card has its own separately-timed data call" note, now
  // exercised a second time). A failure here never disturbs the rest of
  // the dashboard.
  function loadSymptomPreview(sessionToken) {
    var symptomsBody = document.getElementById('card-symptoms-body');
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_symptom_logs', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status === 'ok' && data.data) {
          symptomsBody.innerHTML = symptomPreviewHtml(data.data);
        } else {
          symptomsBody.innerHTML = '<p class="empty-text">Could not load your symptom history. Check your connection and reload the page.</p>';
        }
      })
      .catch(function () {
        symptomsBody.innerHTML = '<p class="empty-text">Could not load your symptom history. Check your connection and reload the page.</p>';
      });
  }

  function renderDashboard(profile) {
    greeting.textContent = 'Hi, ' + profile.full_name;
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML =
      cardHtml('timeline', 'Timeline', '<div class="skeleton"></div><div class="skeleton"></div>') +
      cardHtml('symptoms', 'Symptom Tracker', '<div class="skeleton"></div><div class="skeleton"></div>') +
      cardHtml('reports', 'Reports', emptyStateHtml('phase2a',
        'Upload and view your reports here once this feature ships.')) +
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
    EMPTY_STATE_BADGES: EMPTY_STATE_BADGES
  };
})();
