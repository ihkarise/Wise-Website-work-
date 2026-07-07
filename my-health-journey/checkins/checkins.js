(function () {
  var greeting = document.getElementById('greeting');
  var content = document.getElementById('ciContent');

  WiseSessionGuard.wireSignOut('signOutBtn');

  function escapeHtmlForDisplay(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // field_key -> a human-readable label, generically (no per-question
  // hardcoding) — a past response's answers may belong to an earlier
  // template version than the one currently active, so this page never
  // assumes it can re-fetch the exact question label that produced a
  // given answer (docs/44 §11.4: cross-version interpretation is a
  // consumer-side concern this page deliberately keeps simple).
  function humanizeFieldKey(key) {
    return String(key).replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function answerDisplayValue(value) {
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return escapeHtmlForDisplay(value);
  }

  // The "No data yet" Empty State (docs/38 §4) — matches symptoms.js's own
  // badge markup/copy so every history page presents identically.
  function emptyStateHtml() {
    return '<div class="card" style="max-width:720px">' +
      '<p class="empty-badge badge-nodata" style="display:inline-block;font-size:11.5px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:10px;background:var(--color-surface);color:var(--color-text-secondary);border:1px solid var(--color-line)">No entries yet</p>' +
      '<p style="font-size:14px;color:var(--color-text-secondary);line-height:1.55;margin:0">Your check-ins will appear here once you submit your first one from the dashboard.</p>' +
      '</div>';
  }

  // No per-entry detail level exists for Check-In Response (mirrors
  // symptoms.js's own scope boundary) — this is the one and only
  // rendering of an entry.
  function entryHtml(entry) {
    var dateOnly = String(entry.logged_at).slice(0, 10);
    var answerItems = Object.keys(entry.answers).map(function (key) {
      return '<li><strong>' + escapeHtmlForDisplay(humanizeFieldKey(key)) + '</strong> ' + answerDisplayValue(entry.answers[key]) + '</li>';
    }).join('');
    var tagHtml = entry.condition_slug
      ? '<span class="sx-tag">' + escapeHtmlForDisplay(entry.condition_slug) + '</span>'
      : '';
    return '<li class="tl-item">' +
      '<span class="tl-dot" aria-hidden="true"></span>' +
      '<div class="tl-body">' +
      '<span class="tl-date">' + escapeHtmlForDisplay(dateOnly) + '</span>' +
      '<ul class="sx-scales">' + answerItems + '</ul>' +
      tagHtml +
      '</div>' +
      '</li>';
  }

  function checkInListHtml(entries) {
    if (!entries.length) {
      return emptyStateHtml();
    }
    return '<ol class="tl-track" aria-label="Check-in history">' +
      entries.map(entryHtml).join('') +
      '</ol>';
  }

  function renderError() {
    content.innerHTML = '<div class="card" style="max-width:720px"><p style="font-size:14px;color:var(--color-text-secondary);margin:0">Could not load your check-in history. Check your connection and reload the page.</p></div>';
  }

  WiseSessionGuard.requireSession({
    onReady: function (profile) {
      greeting.textContent = 'Hi, ' + profile.full_name;
      WiseSessionGuard.callFoundation('get_checkin_responses')
        .then(function (data) {
          content.setAttribute('aria-busy', 'false');
          if (data.status === 'ok' && Array.isArray(data.data)) {
            content.innerHTML = checkInListHtml(data.data);
          } else {
            renderError();
          }
        })
        .catch(function () {
          content.setAttribute('aria-busy', 'false');
          renderError();
        });
    },
    onNetworkError: function () {
      content.setAttribute('aria-busy', 'false');
      renderError();
    }
  });

  // Explicit, minimal test-support surface — mirrors symptoms.js's own
  // window.WiseSymptoms convention, so browser tests exercise the real
  // formatting functions rather than reimplementing them.
  window.WiseCheckIns = {
    entryHtml: entryHtml,
    checkInListHtml: checkInListHtml,
    humanizeFieldKey: humanizeFieldKey
  };
})();
