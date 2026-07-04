(function () {
  var greeting = document.getElementById('greeting');
  var content = document.getElementById('tlContent');

  WiseSessionGuard.wireSignOut('signOutBtn');

  function escapeHtmlForDisplay(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).replace(/\s+\S*$/, '') + '…';
  }

  // The "No data yet" Empty State (docs/38 §4) — a real, wired feature
  // (Timeline) with zero rows for this patient. Matches dashboard.js's own
  // badge markup/copy so the two pages present identically.
  function emptyStateHtml() {
    return '<div class="card" style="max-width:720px">' +
      '<p class="empty-badge badge-nodata" style="display:inline-block;font-size:11.5px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:10px;background:var(--color-surface);color:var(--color-text-secondary);border:1px solid var(--color-line)">No entries yet</p>' +
      '<p style="font-size:14px;color:var(--color-text-secondary);line-height:1.55;margin:0">Your consultation history will appear here after your next visit.</p>' +
      '</div>';
  }

  function entryHtml(entry) {
    return '<li class="tl-item">' +
      '<span class="tl-dot" aria-hidden="true"></span>' +
      '<div class="tl-body">' +
      '<span class="tl-date">' + escapeHtmlForDisplay(entry.entry_date) + '</span>' +
      '<h3>' + escapeHtmlForDisplay(entry.title) + '</h3>' +
      '<p class="tl-summary">' + escapeHtmlForDisplay(truncate(entry.summary_text, 140)) + '</p>' +
      '<a href="entry.html?id=' + encodeURIComponent(entry.record_id) + '">View details</a>' +
      '</div>' +
      '</li>';
  }

  function timelineListHtml(entries) {
    if (!entries.length) {
      return emptyStateHtml();
    }
    return '<ol class="tl-track" aria-label="Consultation timeline">' +
      entries.map(entryHtml).join('') +
      '</ol>';
  }

  function renderError() {
    content.innerHTML = '<div class="card" style="max-width:720px"><p style="font-size:14px;color:var(--color-text-secondary);margin:0">Could not load your timeline. Check your connection and reload the page.</p></div>';
  }

  WiseSessionGuard.requireSession({
    onReady: function (profile) {
      greeting.textContent = 'Hi, ' + profile.full_name;
      WiseSessionGuard.callFoundation('get_timeline')
        .then(function (data) {
          content.setAttribute('aria-busy', 'false');
          if (data.status === 'ok' && Array.isArray(data.data)) {
            content.innerHTML = timelineListHtml(data.data);
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

  // Explicit, minimal test-support surface — mirrors dashboard.js's own
  // window.WiseDashboard convention, so browser tests exercise the real
  // formatting functions rather than reimplementing them.
  window.WiseTimeline = {
    entryHtml: entryHtml,
    timelineListHtml: timelineListHtml,
    truncate: truncate
  };
})();
