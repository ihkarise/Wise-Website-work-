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

  function renderDashboard(profile) {
    greeting.textContent = 'Hi, ' + profile.full_name;
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML =
      cardHtml('timeline', 'Timeline', '<div class="skeleton"></div><div class="skeleton"></div>') +
      cardHtml('symptoms', 'Symptom Tracker', emptyStateHtml('phase2a',
        'Log your symptoms and see your own history here once this feature ships.')) +
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
