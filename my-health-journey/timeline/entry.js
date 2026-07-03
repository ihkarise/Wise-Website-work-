(function () {
  var greeting = document.getElementById('greeting');
  var content = document.getElementById('entryContent');

  WiseSessionGuard.wireSignOut('signOutBtn');

  function escapeHtmlForDisplay(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function entryDetailHtml(entry) {
    return '<div class="card">' +
      '<span class="entry-date">' + escapeHtmlForDisplay(entry.entry_date) + '</span>' +
      '<h2 class="entry-title serif">' + escapeHtmlForDisplay(entry.title) + '</h2>' +
      '<p class="entry-summary">' + escapeHtmlForDisplay(entry.summary_text) + '</p>' +
      '</div>';
  }

  function errorHtml(message) {
    return '<div class="card"><p style="font-size:14px;color:var(--color-text-secondary);margin:0">' + escapeHtmlForDisplay(message) + '</p></div>';
  }

  function renderError(message) {
    content.setAttribute('aria-busy', 'false');
    content.innerHTML = errorHtml(message);
  }

  var recordId = new URLSearchParams(window.location.search).get('id');

  WiseSessionGuard.requireSession({
    onReady: function (profile) {
      greeting.textContent = 'Hi, ' + profile.full_name;

      if (!recordId) {
        renderError('No consultation entry was specified. Return to the Timeline and choose an entry to view.');
        return;
      }

      WiseSessionGuard.callFoundation('get_timeline_entry', { record_id: recordId })
        .then(function (data) {
          content.setAttribute('aria-busy', 'false');
          if (data.status === 'ok') {
            // The backend's own message is already friendly and
            // non-technical (FoundationContracts.gs's own contract) —
            // never re-worded here, the same discipline login.html/
            // verify.html already established.
            content.innerHTML = entryDetailHtml(data.data);
          } else {
            renderError((data.error && data.error.message) || 'We could not find that consultation entry.');
          }
        })
        .catch(function () {
          renderError('Could not reach the server. Check your connection and reload the page.');
        });
    },
    onNetworkError: function () {
      renderError('Could not reach the server. Check your connection and reload the page.');
    }
  });

  // Explicit, minimal test-support surface — same convention as
  // dashboard.js's window.WiseDashboard / timeline.js's window.WiseTimeline.
  window.WiseTimelineEntry = {
    entryDetailHtml: entryDetailHtml,
    errorHtml: errorHtml
  };
})();
