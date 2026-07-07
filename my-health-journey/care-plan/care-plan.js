(function () {
  var greeting = document.getElementById('greeting');
  var content = document.getElementById('cpContent');

  WiseSessionGuard.wireSignOut('signOutBtn');

  function escapeHtmlForDisplay(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // enum value -> a human-readable label, generically (no per-value
  // hardcoding beyond the word-boundary/underscore rule) — mirrors
  // checkins.js's own humanizeFieldKey().
  function humanizeEnumValue(value) {
    return String(value).replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // The "No data yet" Empty State (docs/38 §4) — matches checkins.js's own
  // badge markup/copy so every history page presents identically.
  function noCarePlanHtml() {
    return '<div class="card" style="max-width:720px">' +
      '<p class="empty-badge badge-nodata" style="display:inline-block;font-size:11.5px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:10px;background:var(--color-surface);color:var(--color-text-secondary);border:1px solid var(--color-line)">No entries yet</p>' +
      '<p style="font-size:14px;color:var(--color-text-secondary);line-height:1.55;margin:0">Your doctor hasn\'t created a care plan for you yet. Check back after your next visit.</p>' +
      '</div>';
  }

  // The current plan's own summary — goals, version, next review date,
  // status. Read-only, doctor-authored (docs/44 §4.3).
  function carePlanSummaryHtml(carePlan) {
    var reviewDateHtml = carePlan.next_review_date
      ? '<span>Next review: ' + escapeHtmlForDisplay(carePlan.next_review_date) + '</span>'
      : '';
    return '<div class="cp-summary">' +
      '<h3 class="serif">Current Goals</h3>' +
      '<p class="cp-goals">' + escapeHtmlForDisplay(carePlan.goals) + '</p>' +
      '<div class="cp-meta">' +
      '<span>Version ' + escapeHtmlForDisplay(carePlan.version) + '</span>' +
      reviewDateHtml +
      '</div>' +
      '</div>';
  }

  // One DoctorInstruction entry — mirrors checkins.js's own entryHtml()
  // shape (a dated .tl-item), with instruction_type/status as .sx-tag
  // badges instead of a condition_slug tag.
  function instructionHtml(instruction) {
    return '<li class="tl-item">' +
      '<span class="tl-dot" aria-hidden="true"></span>' +
      '<div class="tl-body">' +
      '<span class="tl-date">' + escapeHtmlForDisplay(instruction.effective_date) + '</span>' +
      '<p class="tl-summary">' + escapeHtmlForDisplay(instruction.content) + '</p>' +
      '<span class="sx-tag">' + escapeHtmlForDisplay(humanizeEnumValue(instruction.instruction_type)) + '</span>' +
      '<span class="sx-tag">' + escapeHtmlForDisplay(humanizeEnumValue(instruction.status)) + '</span>' +
      '</div>' +
      '</li>';
  }

  function instructionsListHtml(instructions) {
    if (!instructions.length) {
      return '<p style="font-size:14px;color:var(--color-text-secondary)">No instructions have been added to your plan yet.</p>';
    }
    return '<ol class="tl-track" aria-label="Doctor instructions">' +
      instructions.map(instructionHtml).join('') +
      '</ol>';
  }

  function carePlanPageHtml(carePlan, instructions) {
    if (!carePlan) {
      return noCarePlanHtml();
    }
    return carePlanSummaryHtml(carePlan) + instructionsListHtml(instructions);
  }

  function renderError() {
    content.innerHTML = '<div class="card" style="max-width:720px"><p style="font-size:14px;color:var(--color-text-secondary);margin:0">Could not load your care plan. Check your connection and reload the page.</p></div>';
  }

  WiseSessionGuard.requireSession({
    onReady: function (profile) {
      greeting.textContent = 'Hi, ' + profile.full_name;
      Promise.all([
        WiseSessionGuard.callFoundation('get_care_plan'),
        WiseSessionGuard.callFoundation('get_doctor_instructions')
      ])
        .then(function (results) {
          content.setAttribute('aria-busy', 'false');
          var carePlanEnv = results[0];
          var instructionsEnv = results[1];
          if (carePlanEnv.status !== 'ok' || instructionsEnv.status !== 'ok' || !Array.isArray(instructionsEnv.data)) {
            renderError();
            return;
          }
          content.innerHTML = carePlanPageHtml(carePlanEnv.data, instructionsEnv.data);
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

  // Explicit, minimal test-support surface — mirrors checkins.js's own
  // window.WiseCheckIns convention, so browser tests exercise the real
  // formatting functions rather than reimplementing them.
  window.WiseCarePlan = {
    carePlanSummaryHtml: carePlanSummaryHtml,
    instructionHtml: instructionHtml,
    instructionsListHtml: instructionsListHtml,
    carePlanPageHtml: carePlanPageHtml,
    noCarePlanHtml: noCarePlanHtml,
    humanizeEnumValue: humanizeEnumValue
  };
})();
