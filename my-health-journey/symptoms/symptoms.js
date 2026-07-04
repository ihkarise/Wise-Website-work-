(function () {
  var greeting = document.getElementById('greeting');
  var content = document.getElementById('sxContent');

  WiseSessionGuard.wireSignOut('signOutBtn');

  function escapeHtmlForDisplay(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // The "No data yet" Empty State (docs/38 §4), this feature's own first
  // real consumer of it on this page — matches dashboard.js's and
  // timeline.js's own badge markup/copy so every page presents identically.
  function emptyStateHtml() {
    return '<div class="card" style="max-width:720px">' +
      '<p class="empty-badge badge-nodata" style="display:inline-block;font-size:11.5px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:10px;background:var(--color-surface);color:var(--color-text-secondary);border:1px solid var(--color-line)">No entries yet</p>' +
      '<p style="font-size:14px;color:var(--color-text-secondary);line-height:1.55;margin:0">Your logged symptoms will appear here once you log your first entry from the dashboard.</p>' +
      '</div>';
  }

  // No per-entry detail level exists for Symptom Log (docs/41 §2) — this
  // is the one and only rendering of an entry, not a truncated preview of
  // a separate detail page the way timeline.js's entryHtml() is.
  function entryHtml(entry) {
    var dateOnly = String(entry.logged_at).slice(0, 10);
    var notesHtml = entry.notes
      ? '<p class="tl-summary">' + escapeHtmlForDisplay(entry.notes) + '</p>'
      : '';
    var tagHtml = entry.condition_slug
      ? '<span class="sx-tag">' + escapeHtmlForDisplay(entry.condition_slug) + '</span>'
      : '';
    return '<li class="tl-item">' +
      '<span class="tl-dot" aria-hidden="true"></span>' +
      '<div class="tl-body">' +
      '<span class="tl-date">' + escapeHtmlForDisplay(dateOnly) + '</span>' +
      '<ul class="sx-scales">' +
      '<li><strong>Severity</strong> ' + escapeHtmlForDisplay(entry.severity) + '</li>' +
      '<li><strong>Sleep</strong> ' + escapeHtmlForDisplay(entry.sleep) + '</li>' +
      '<li><strong>Energy</strong> ' + escapeHtmlForDisplay(entry.energy) + '</li>' +
      '<li><strong>Stress</strong> ' + escapeHtmlForDisplay(entry.stress) + '</li>' +
      '</ul>' +
      notesHtml +
      tagHtml +
      '</div>' +
      '</li>';
  }

  function symptomListHtml(entries) {
    if (!entries.length) {
      return emptyStateHtml();
    }
    return '<ol class="tl-track" aria-label="Symptom history">' +
      entries.map(entryHtml).join('') +
      '</ol>';
  }

  function renderError() {
    content.innerHTML = '<div class="card" style="max-width:720px"><p style="font-size:14px;color:var(--color-text-secondary);margin:0">Could not load your symptom history. Check your connection and reload the page.</p></div>';
  }

  WiseSessionGuard.requireSession({
    onReady: function (profile) {
      greeting.textContent = 'Hi, ' + profile.full_name;
      WiseSessionGuard.callFoundation('get_symptom_logs')
        .then(function (data) {
          content.setAttribute('aria-busy', 'false');
          if (data.status === 'ok' && Array.isArray(data.data)) {
            content.innerHTML = symptomListHtml(data.data);
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

  // Explicit, minimal test-support surface — mirrors timeline.js's own
  // window.WiseTimeline convention, so browser tests exercise the real
  // formatting functions rather than reimplementing them.
  window.WiseSymptoms = {
    entryHtml: entryHtml,
    symptomListHtml: symptomListHtml
  };
})();
