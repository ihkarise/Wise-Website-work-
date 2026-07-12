(function () {
  // Batch PXP-11 (docs/58-PHASE-2C-HEALTH-MILESTONES-ARCHITECTURE-FREEZE.md §19.1) — the
  // patient's own full Health Milestones page, reached only from the Health Milestones
  // dashboard card's own link (no separate registry entry gates it, mirroring Care Plan's/
  // Report's/Medication History's own full-history pages exactly). Read-only: no anchor
  // control, no authoring control, no publish control appears here — those remain
  // doctor-only, exercised from the Doctor Dashboard's own Milestone Review card. Non-AI
  // (ADR-027): nothing on this page is model-generated. Only PUBLISHED reviews are ever
  // present in the payload (server-enforced, docs/58 §10.2) — a draft never reaches here.
  var greeting = document.getElementById('greeting');
  var content = document.getElementById('msContent');

  WiseSessionGuard.wireSignOut('signOutBtn');

  function escapeHtmlForDisplay(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var MILESTONE_LABELS = { '30_day': '30 Days', '90_day': '90 Days', '6_month': '6 Months', '1_year': '1 Year' };
  var STATE_LABELS = { upcoming: 'Upcoming', due: 'Due', overdue: 'Due', completed: 'Celebrated' };
  var REVIEW_DIMENSIONS = [
    { key: 'progress_summary', label: 'Progress' },
    { key: 'improvements', label: 'Improvements' },
    { key: 'medicines_review', label: 'Medicines' },
    { key: 'investigations', label: 'Investigations' },
    { key: 'recommendations', label: 'Recommendations' },
    { key: 'next_goals', label: 'Next goals' }
  ];

  function notStartedHtml() {
    return '<div class="card" style="max-width:720px">' +
      '<p class="empty-badge badge-nodata" style="display:inline-block;font-size:11.5px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:10px;background:var(--color-surface);color:var(--color-text-secondary);border:1px solid var(--color-line)">Not started yet</p>' +
      '<p style="font-size:14px;color:var(--color-text-secondary);line-height:1.55;margin:0">Your milestone journey hasn\'t started yet. Once your treatment begins, your doctor will set your milestones and celebrate your progress here.</p>' +
      '</div>';
  }

  // Renders the doctor's published review for a milestone point, if one exists.
  // Every dimension is doctor-authored, patient-viewable read-only — no edit control.
  function reviewHtml(review) {
    if (!review) return '';
    var rows = REVIEW_DIMENSIONS.filter(function (dim) {
      return review[dim.key] && String(review[dim.key]).trim() !== '';
    }).map(function (dim) {
      return '<dt>' + escapeHtmlForDisplay(dim.label) + '</dt>' +
        '<dd>' + escapeHtmlForDisplay(review[dim.key]) + '</dd>';
    }).join('');
    return '<dl class="ms-review">' + rows + '</dl>';
  }

  function pointHtml(point, reviewsByType) {
    var isCompleted = point.state === 'completed';
    var review = reviewsByType[point.milestone_type];
    var targetLine = point.target_date
      ? '<p class="ms-meta">Target — ' + escapeHtmlForDisplay(String(point.target_date)) + '</p>'
      : '';
    return '<li class="tl-item' + (isCompleted ? ' is-completed' : '') + '">' +
      '<span class="tl-dot" aria-hidden="true"></span>' +
      '<div class="tl-body">' +
      '<h3>' + escapeHtmlForDisplay(MILESTONE_LABELS[point.milestone_type] || point.milestone_type) + '</h3>' +
      '<p class="ms-state' + (isCompleted ? ' is-completed' : '') + '">' + escapeHtmlForDisplay(STATE_LABELS[point.state] || point.state) + '</p>' +
      targetLine +
      reviewHtml(review) +
      '</div>' +
      '</li>';
  }

  // payload: { track, schedule, reviews }. When the schedule is empty (no track, or a
  // paused track), fall back to the not-started state — but still surface any already-
  // published reviews as history (docs/58 §11.1).
  function pageHtml(payload) {
    var schedule = (payload && payload.schedule) || [];
    var reviews = (payload && payload.reviews) || [];
    var reviewsByType = {};
    reviews.forEach(function (r) { reviewsByType[r.milestone_type] = r; });

    if (!schedule.length) {
      if (!reviews.length) {
        return notStartedHtml();
      }
      // Paused track with published history — render the reviewed points only.
      var historyPoints = reviews.map(function (r) {
        return { milestone_type: r.milestone_type, target_date: r.target_date, state: 'completed' };
      });
      return '<ol class="tl-track" aria-label="Health Milestones">' +
        historyPoints.map(function (p) { return pointHtml(p, reviewsByType); }).join('') +
        '</ol>';
    }
    return '<ol class="tl-track" aria-label="Health Milestones">' +
      schedule.map(function (p) { return pointHtml(p, reviewsByType); }).join('') +
      '</ol>';
  }

  function renderError() {
    content.innerHTML = '<div class="card" style="max-width:720px"><p style="font-size:14px;color:var(--color-text-secondary);margin:0">Could not load your milestones. Check your connection and reload the page.</p></div>';
  }

  WiseSessionGuard.requireSession({
    onReady: function (profile) {
      greeting.textContent = 'Hi, ' + profile.full_name;
      // Own record only — patient_id is always session-derived server-side
      // (MilestoneReview.gs's own foundationGetHealthMilestonesForPatient_); no
      // patient_id is ever sent from this page.
      WiseSessionGuard.callFoundation('get_health_milestones')
        .then(function (data) {
          content.setAttribute('aria-busy', 'false');
          if (data.status === 'ok' && data.data) {
            content.innerHTML = pageHtml(data.data);
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

  // Explicit, minimal test-support surface — mirrors WiseMedications' own convention.
  window.WiseMilestones = {
    pageHtml: pageHtml,
    pointHtml: pointHtml,
    reviewHtml: reviewHtml,
    notStartedHtml: notStartedHtml
  };
})();
