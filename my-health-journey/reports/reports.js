(function () {
  var greeting = document.getElementById('greeting');
  var content = document.getElementById('rpContent');

  WiseSessionGuard.wireSignOut('signOutBtn');

  function escapeHtmlForDisplay(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // The "No data yet" Empty State (docs/38 §4) — matches every other
  // page's badge markup/copy exactly.
  function emptyStateHtml() {
    return '<div class="card" style="max-width:720px">' +
      '<p class="empty-badge badge-nodata" style="display:inline-block;font-size:11.5px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:10px;background:var(--color-surface);color:var(--color-text-secondary);border:1px solid var(--color-line)">No reports yet</p>' +
      '<p style="font-size:14px;color:var(--color-text-secondary);line-height:1.55;margin:0">Your uploaded reports will appear here once you upload your first one from the dashboard.</p>' +
      '</div>';
  }

  function formatSize(sizeBytes) {
    var n = Number(sizeBytes) || 0;
    return n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B';
  }

  // No edit/delete affordance exists for Reports (metadata is immutable
  // after upload, per the approved architecture decision) — the only
  // per-entry action is Download, gated the same session-derived
  // ownership check every other Foundation route already uses.
  function entryHtml(entry) {
    var dateOnly = String(entry.uploaded_at).slice(0, 10);
    return '<li class="tl-item">' +
      '<span class="tl-dot" aria-hidden="true"></span>' +
      '<div class="tl-body">' +
      '<span class="tl-date">' + escapeHtmlForDisplay(dateOnly) + '</span>' +
      '<h3>' + escapeHtmlForDisplay(entry.file_name) + '</h3>' +
      '<p class="rp-meta">' + escapeHtmlForDisplay(entry.mime_type) + ' &middot; ' + escapeHtmlForDisplay(formatSize(entry.size_bytes)) + '</p>' +
      '<div class="rp-actions">' +
      '<button class="secondary" type="button" data-download="' + escapeHtmlForDisplay(entry.record_id) + '">Download</button>' +
      '<span class="status" role="status" aria-live="polite" data-download-status></span>' +
      '</div>' +
      '</div>' +
      '</li>';
  }

  function reportListHtml(entries) {
    if (!entries.length) {
      return emptyStateHtml();
    }
    return '<ol class="tl-track" aria-label="Reports">' +
      entries.map(entryHtml).join('') +
      '</ol>';
  }

  function renderError() {
    content.innerHTML = '<div class="card" style="max-width:720px"><p style="font-size:14px;color:var(--color-text-secondary);margin:0">Could not load your reports. Check your connection and reload the page.</p></div>';
  }

  // Decodes a base64 payload into a real file download — the client
  // never receives or follows a Drive URL (docs/29 §8, docs/42); the
  // server already authorized and fetched these exact bytes.
  function triggerFileDownload(base64, mimeType, fileName) {
    var byteChars = atob(base64);
    var byteNumbers = new Array(byteChars.length);
    for (var i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    var blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // A single delegated listener covers every "Download" button, present
  // and future (entries render after this is wired) — the same pattern
  // this repo already reaches for whenever markup is rebuilt from fetched
  // data rather than declared once in HTML.
  function wireDownloads() {
    content.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('[data-download]') : null;
      if (!btn) return;
      var recordId = btn.getAttribute('data-download');
      var statusEl = btn.parentElement.querySelector('[data-download-status]');
      btn.disabled = true;
      if (statusEl) {
        statusEl.className = 'status loading';
        statusEl.textContent = 'Preparing download…';
      }
      WiseSessionGuard.callFoundation('download_report', { record_id: recordId })
        .then(function (data) {
          btn.disabled = false;
          if (data.status === 'ok' && data.data && data.data.file_base64) {
            triggerFileDownload(data.data.file_base64, data.data.mime_type, data.data.file_name);
            if (statusEl) {
              statusEl.className = 'status ok';
              statusEl.textContent = 'Downloaded.';
            }
          } else if (statusEl) {
            statusEl.className = 'status err';
            statusEl.textContent = (data.error && data.error.message) || 'Could not download that report.';
          }
        })
        .catch(function () {
          btn.disabled = false;
          if (statusEl) {
            statusEl.className = 'status err';
            statusEl.textContent = 'Could not reach the server. Check your connection and try again.';
          }
        });
    });
  }

  wireDownloads();

  WiseSessionGuard.requireSession({
    onReady: function (profile) {
      greeting.textContent = 'Hi, ' + profile.full_name;
      WiseSessionGuard.callFoundation('get_reports')
        .then(function (data) {
          content.setAttribute('aria-busy', 'false');
          if (data.status === 'ok' && Array.isArray(data.data)) {
            content.innerHTML = reportListHtml(data.data);
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
  window.WiseReports = {
    entryHtml: entryHtml,
    reportListHtml: reportListHtml
  };
})();
