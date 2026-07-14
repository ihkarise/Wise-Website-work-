(function () {
  // Batch PXP-12 (Phase 2D, docs/59-PHASE-2D-DIGITAL-TWIN-ARCHITECTURE-FREEZE.md §14.1) — the
  // patient's own full Health Story page, reached only from the Health Story dashboard card's
  // own link (no separate registry entry gates it, mirroring Care Plan's/Health Milestones'
  // own full-history pages exactly). Read-only: no generate control, no approve/edit control
  // appears here — those remain doctor-only, exercised from the Doctor Dashboard's own Digital
  // Twin Review card. Only doctor-APPROVED narratives (published_output) are ever present in the
  // payload (server-enforced, ADR-028) — a pending or rejected draft, and the raw model output,
  // never reach this page. The Progress Analytics section is deterministic and non-AI (§6.3).
  var greeting = document.getElementById('greeting');
  var content = document.getElementById('hsContent');

  WiseSessionGuard.wireSignOut('signOutBtn');

  function escapeHtmlForDisplay(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var NARRATIVE_TYPE_LABELS = { health_story: 'Health Story', ai_summary: 'AI Summary' };

  function notReadyHtml() {
    return '<div class="card" style="max-width:720px">' +
      '<p class="empty-badge badge-nodata" style="display:inline-block;font-size:11.5px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:10px;background:var(--color-surface);color:var(--color-text-secondary);border:1px solid var(--color-line)">Being prepared</p>' +
      '<p style="font-size:14px;color:var(--color-text-secondary);line-height:1.55;margin:0">Your health story is being prepared. Once your doctor reviews and approves a summary of your recorded journey, you\'ll be able to read it here.</p>' +
      '</div>';
  }

  // One approved narrative — its published_output only (never the raw model output, ADR-028),
  // with an explicit "approved by your doctor" badge so the doctor-review gate is visible at the
  // point of reading, not just documented.
  function narrativeHtml(narrative) {
    var label = NARRATIVE_TYPE_LABELS[narrative.narrative_type] || narrative.narrative_type;
    var when = narrative.reviewed_at ? String(narrative.reviewed_at).slice(0, 10) : '';
    return '<article class="hs-story">' +
      '<h3>' + escapeHtmlForDisplay(label) + '</h3>' +
      '<p class="hs-approved">Reviewed &amp; approved by your doctor</p>' +
      '<p class="hs-text">' + escapeHtmlForDisplay(narrative.published_output) + '</p>' +
      (when ? '<p class="hs-meta">Approved ' + escapeHtmlForDisplay(when) + '</p>' : '') +
      '</article>';
  }

  // Progress Analytics — deterministic, non-AI (§6.3), always safe to show directly.
  function analyticsHtml(analytics) {
    if (!analytics) return '';
    var rows = [
      ['Check-ins recorded', analytics.check_in_engagement ? analytics.check_in_engagement.total_check_ins : 0],
      ['Symptom logs', analytics.symptom_trend ? analytics.symptom_trend.total_logs : 0],
      ['Average symptom severity', analytics.symptom_trend && analytics.symptom_trend.average_severity !== null ? analytics.symptom_trend.average_severity : '—'],
      ['Calculator results', analytics.calculator_engagement ? analytics.calculator_engagement.total_results : 0],
      ['Milestones celebrated', analytics.milestone_progress ? (analytics.milestone_progress.celebrated + ' of ' + analytics.milestone_progress.total) : '—']
    ];
    var dl = rows.map(function (pair) {
      return '<dt>' + escapeHtmlForDisplay(pair[0]) + '</dt><dd>' + escapeHtmlForDisplay(pair[1]) + '</dd>';
    }).join('');
    return '<section class="hs-analytics"><h3>Your progress at a glance</h3><dl>' + dl + '</dl></section>';
  }

  // storyPayload: { digital_twin, narratives }. analyticsPayload: the progress view.
  function pageHtml(storyPayload, analyticsPayload) {
    var narratives = (storyPayload && storyPayload.narratives) || [];
    var analyticsBlock = analyticsHtml(analyticsPayload);
    if (!narratives.length) {
      return analyticsBlock + notReadyHtml();
    }
    var stories = narratives.map(narrativeHtml).join('');
    return analyticsBlock + stories;
  }

  function renderError() {
    content.innerHTML = '<div class="card" style="max-width:720px"><p style="font-size:14px;color:var(--color-text-secondary);margin:0">Could not load your health story. Check your connection and reload the page.</p></div>';
  }

  WiseSessionGuard.requireSession({
    onReady: function (profile) {
      greeting.textContent = 'Hi, ' + profile.full_name;
      // Own record only — patient_id is always session-derived server-side; no patient_id is
      // ever sent from this page.
      Promise.all([
        WiseSessionGuard.callFoundation('get_health_story'),
        WiseSessionGuard.callFoundation('get_progress_analytics')
      ])
        .then(function (results) {
          content.setAttribute('aria-busy', 'false');
          var story = results[0];
          var analytics = results[1];
          if (story.status === 'ok' && story.data) {
            content.innerHTML = pageHtml(story.data, analytics.status === 'ok' ? analytics.data : null);
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

  // Explicit, minimal test-support surface — mirrors WiseMilestones' own convention.
  window.WiseHealthStory = {
    pageHtml: pageHtml,
    narrativeHtml: narrativeHtml,
    analyticsHtml: analyticsHtml,
    notReadyHtml: notReadyHtml
  };
})();
