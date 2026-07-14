(function () {
  // Batch WPI-4 (docs/50-PHASE-3-TECHNICAL-PLAN.md §7.3/§7.4/§19, ADR-020,
  // docs/53-PHASE-3-IMPLEMENTATION-RULES.md) — the Doctor Dashboard,
  // structurally parallel to my-health-journey/dashboard.js's own
  // post-PXP-4 registry-driven rendering, for a separate identity type
  // (Doctor Identity, ADR-017) and a separate registry (Doctor Module
  // Registry, ADR-020) — never merged with the patient-facing dashboard or
  // its Module Registry. Every card that renders here corresponds to a
  // Doctor Module Registry entry the doctor is enabled for
  // (DoctorModuleState, staff/administrative-set, fail-closed by absence);
  // renderDashboard() itself never learns any specific capability_key.
  //
  // Same Apps Script Web App deployment doctor-login.html/doctor-verify.html
  // use — Foundation and Phase 1.5 share one project/one doPost (docs/29
  // §14 Decision 1).
  var WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwrAx9jPnji2U-ngBpYTtV2p_SJnnFrYa7fKYo589zeVfRrwuz3N5aIS0xeiQeuFvMhIQ/exec';
  // A distinct sessionStorage key from the patient dashboard's
  // wise_session_token — Doctor Session and Patient Session are never
  // interchangeable (ADR-017), including client-side storage.
  var SESSION_KEY = 'wise_doctor_session_token';

  var grid = document.getElementById('dashGrid');
  var greeting = document.getElementById('greeting');
  var signOutBtn = document.getElementById('signOutBtn');

  function goToLogin(reason) {
    window.sessionStorage.removeItem(SESSION_KEY);
    window.location.href = '../doctor-login.html' + (reason ? '?reason=' + reason : '');
  }

  signOutBtn.addEventListener('click', function () {
    goToLogin();
  });

  // Hand-ported from shared/constants/doctor-module-registry.json (version
  // 1.5.0 as of Batch WPI-9) — the same "port a shared/ definition into a
  // consuming file" convention my-health-journey/dashboard.js's own
  // MODULE_REGISTRY already uses (a browser has no ES-module/build-step to
  // read the canonical JSON at runtime). Only the fields this dashboard
  // actually consumes today (capability_key, display_name, display_order,
  // empty_state, data_source) are duplicated here — the reserved/inert
  // future_ai_capable/specialty_scope fields stay in the canonical JSON
  // where a future consumer will pick them up. Adding a new capability
  // later means (i) add its registry entry (in shared/constants/
  // doctor-module-registry.json, apps-script/DoctorModuleRegistry.gs, and
  // this file's DOCTOR_MODULE_REGISTRY below); (ii) register a loader
  // against its data_source in CAPABILITY_LOADERS below — nothing in
  // renderDashboard() itself changes. Update all three ports by hand if
  // the canonical list ever changes, per shared/README.md's rule.
  // Batch WPI-11 (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md §18.2) adds the
  // 'holoscan_review'/'medication_history' rows below — every earlier row is untouched.
  var DOCTOR_MODULE_REGISTRY = [
    { capability_key: 'patient_roster', display_name: 'Patient Roster', display_order: 10, empty_state: 'nodata', data_source: 'get_doctor_patient_roster' },
    { capability_key: 'appointments', display_name: 'Appointments', display_order: 20, empty_state: 'nodata', data_source: 'get_doctor_appointments' },
    { capability_key: 'inventory', display_name: 'Inventory', display_order: 30, empty_state: 'nodata', data_source: 'get_inventory_items' },
    { capability_key: 'pillfill_orders', display_name: 'PillFill Orders', display_order: 40, empty_state: 'nodata', data_source: 'get_pillfill_orders' },
    { capability_key: 'analytics', display_name: 'Analytics', display_order: 50, empty_state: 'nodata', data_source: 'get_doctor_analytics' },
    { capability_key: 'ai_assistant', display_name: 'AI Assistant', display_order: 60, empty_state: 'nodata', data_source: 'get_ai_assistant_capabilities' },
    { capability_key: 'holoscan_review', display_name: 'Holoscan Review', display_order: 70, empty_state: 'nodata', data_source: 'get_holoscan_review_queue' },
    { capability_key: 'medication_history', display_name: 'Medication History', display_order: 80, empty_state: 'nodata', data_source: 'get_medication_history' },
    { capability_key: 'milestone_review', display_name: 'Milestone Review', display_order: 90, empty_state: 'nodata', data_source: 'get_patient_milestones' },
    { capability_key: 'digital_twin_review', display_name: 'Digital Twin Review', display_order: 100, empty_state: 'nodata', data_source: 'get_patient_digital_twin' }
  ];

  function getCapabilityDescriptor(capabilityKey) {
    for (var i = 0; i < DOCTOR_MODULE_REGISTRY.length; i++) {
      if (DOCTOR_MODULE_REGISTRY[i].capability_key === capabilityKey) return DOCTOR_MODULE_REGISTRY[i];
    }
    return null;
  }

  // One empty-state type today (mirrors my-health-journey/dashboard.js's
  // own EMPTY_STATE_BADGES shape) — a real, wired capability with zero
  // roster entries for this doctor.
  var EMPTY_STATE_BADGES = {
    nodata: ['badge-nodata', 'No entries yet']
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

  function escapeHtmlForDisplay(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // The Patient Roster card's body (docs/50 §7.4) — a bare, read-only list
  // of patient name + matching condition_slug(s), no write affordance (the
  // roster is a derived view, docs/50 §7.4's own "no new entity"). Every
  // other card beyond this one and the Appointments card below is out of
  // scope for this dashboard so far (docs/50 §19's own WPI-6 onward).
  function patientRosterHtml(entries) {
    if (!entries.length) {
      return emptyStateHtml('nodata', 'No patients are currently assigned to your specialty.');
    }
    var items = entries.map(function (entry) {
      return '<li>' +
        '<div class="roster-name">' + escapeHtmlForDisplay(entry.full_name) + '</div>' +
        '<div class="roster-conditions">' + escapeHtmlForDisplay(entry.condition_slugs.join(', ')) + '</div>' +
        '</li>';
    }).join('');
    return '<ul class="roster-list">' + items + '</ul>';
  }

  function loadPatientRosterPreview(sessionToken, capabilityKey) {
    var body = document.getElementById('card-' + capabilityKey + '-body');
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_doctor_patient_roster', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status === 'ok' && Array.isArray(data.data)) {
          body.innerHTML = patientRosterHtml(data.data);
        } else {
          body.innerHTML = '<p class="empty-text">Could not load your patient roster. Check your connection and reload the page.</p>';
        }
      })
      .catch(function () {
        body.innerHTML = '<p class="empty-text">Could not load your patient roster. Check your connection and reload the page.</p>';
      });
  }

  // Human-readable labels for Appointment's own status enum (docs/50 §8) —
  // display only, never fed back into a write (this card has no write
  // affordance, docs/50 §8's own "no patient-facing Appointment UI" applies
  // equally to this batch's doctor-facing, read-only view).
  var APPOINTMENT_STATUS_LABELS_ = {
    requested: 'Requested',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };

  // The Appointments card's body (docs/50 §8) — a bare, read-only list of
  // each appointment's linked patient (or "Not yet linked" for a
  // first-time visitor with no Patient Identity yet), condition, status,
  // and scheduled time, no write affordance (docs/50 §8's own "no
  // patient-facing Appointment UI is designed here" — this batch's
  // doctor-facing view is read-only for the same reason).
  function appointmentsHtml(entries) {
    if (!entries.length) {
      return emptyStateHtml('nodata', 'No appointments have been requested for your specialty yet.');
    }
    var items = entries.map(function (entry) {
      var who = entry.patient_full_name ? escapeHtmlForDisplay(entry.patient_full_name) : 'Not yet linked to a patient record';
      var when = entry.scheduled_at ? escapeHtmlForDisplay(entry.scheduled_at) : 'Not yet scheduled';
      var statusLabel = APPOINTMENT_STATUS_LABELS_[entry.status] || escapeHtmlForDisplay(entry.status);
      return '<li>' +
        '<div class="roster-name">' + who + '</div>' +
        '<div class="roster-conditions">' + escapeHtmlForDisplay(entry.condition_slug) + ' &middot; ' + statusLabel + ' &middot; ' + when + '</div>' +
        '</li>';
    }).join('');
    return '<ul class="roster-list">' + items + '</ul>';
  }

  function loadAppointmentsPreview(sessionToken, capabilityKey) {
    var body = document.getElementById('card-' + capabilityKey + '-body');
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_doctor_appointments', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status === 'ok' && Array.isArray(data.data)) {
          body.innerHTML = appointmentsHtml(data.data);
        } else {
          body.innerHTML = '<p class="empty-text">Could not load your appointments. Check your connection and reload the page.</p>';
        }
      })
      .catch(function () {
        body.innerHTML = '<p class="empty-text">Could not load your appointments. Check your connection and reload the page.</p>';
      });
  }

  // The Inventory card's body (docs/50 §10) — a bare, read-only list of
  // each visible item's name, sku/unit, and quantity_on_hand vs.
  // reorder_threshold, flagging low-stock items — no write affordance,
  // mirroring the Patient Roster/Appointments cards' own "derived,
  // read-only view" discipline exactly (every InventoryItem/
  // InventoryTransaction write remains a manually-run Apps Script editor
  // function, InventoryItem.gs's/InventoryTransaction.gs's own header
  // comments).
  function inventoryHtml(entries) {
    if (!entries.length) {
      return emptyStateHtml('nodata', 'No inventory items are registered for your specialty yet.');
    }
    var items = entries.map(function (entry) {
      var stockLine = escapeHtmlForDisplay(entry.quantity_on_hand) + ' ' + escapeHtmlForDisplay(entry.unit) + ' on hand' +
        (entry.low_stock ? ' &middot; <strong>Low stock</strong> (reorder at ' + escapeHtmlForDisplay(entry.reorder_threshold) + ')' : '');
      return '<li>' +
        '<div class="roster-name">' + escapeHtmlForDisplay(entry.name) + ' (' + escapeHtmlForDisplay(entry.sku) + ')</div>' +
        '<div class="roster-conditions">' + stockLine + '</div>' +
        '</li>';
    }).join('');
    return '<ul class="roster-list">' + items + '</ul>';
  }

  function loadInventoryPreview(sessionToken, capabilityKey) {
    var body = document.getElementById('card-' + capabilityKey + '-body');
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_inventory_items', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status === 'ok' && Array.isArray(data.data)) {
          body.innerHTML = inventoryHtml(data.data);
        } else {
          body.innerHTML = '<p class="empty-text">Could not load your inventory. Check your connection and reload the page.</p>';
        }
      })
      .catch(function () {
        body.innerHTML = '<p class="empty-text">Could not load your inventory. Check your connection and reload the page.</p>';
      });
  }

  // Human-readable labels for PillFillOrder's own status enum (docs/50
  // §11) — display only, never fed back into a write (this card has no
  // write affordance, mirroring the Appointments/Inventory cards' own
  // "derived, read-only view" discipline exactly).
  var PILLFILL_ORDER_STATUS_LABELS_ = {
    requested: 'Requested',
    in_progress: 'In Progress',
    fulfilled: 'Fulfilled',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
  };

  // The PillFill Orders card's body (docs/50 §11) — a bare, read-only list
  // of each order's linked patient, inventory item, quantity, and status —
  // no write affordance, mirroring the Patient Roster/Appointments/
  // Inventory cards' own "derived, read-only view" discipline exactly
  // (every PillFillOrder write remains a manually-run Apps Script editor
  // function, PillFillOrder.gs's own header comment).
  function pillFillOrdersHtml(entries) {
    if (!entries.length) {
      return emptyStateHtml('nodata', 'No PillFill orders exist for your specialty yet.');
    }
    var items = entries.map(function (entry) {
      var who = entry.patient_full_name ? escapeHtmlForDisplay(entry.patient_full_name) : 'Not yet linked to a patient record';
      var statusLabel = PILLFILL_ORDER_STATUS_LABELS_[entry.status] || escapeHtmlForDisplay(entry.status);
      var itemLine = escapeHtmlForDisplay(entry.inventory_item_name) + ' (' + escapeHtmlForDisplay(entry.inventory_item_sku) + ') &middot; qty ' + escapeHtmlForDisplay(entry.quantity);
      return '<li>' +
        '<div class="roster-name">' + who + '</div>' +
        '<div class="roster-conditions">' + itemLine + ' &middot; ' + statusLabel + '</div>' +
        '</li>';
    }).join('');
    return '<ul class="roster-list">' + items + '</ul>';
  }

  function loadPillFillOrdersPreview(sessionToken, capabilityKey) {
    var body = document.getElementById('card-' + capabilityKey + '-body');
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_pillfill_orders', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status === 'ok' && Array.isArray(data.data)) {
          body.innerHTML = pillFillOrdersHtml(data.data);
        } else {
          body.innerHTML = '<p class="empty-text">Could not load your PillFill orders. Check your connection and reload the page.</p>';
        }
      })
      .catch(function () {
        body.innerHTML = '<p class="empty-text">Could not load your PillFill orders. Check your connection and reload the page.</p>';
      });
  }

  // The Analytics card's body (docs/50 §12) — a bare, read-only summary of
  // the report's own deterministic counts/rates, one line per report
  // section, no write affordance and no chart/graph rendering (this batch
  // adds registry-driven integration only, not a dashboard redesign). The
  // report object is always present (never an empty list to check against,
  // unlike every other card above) — a doctor with zero activity in the
  // window still gets a real report, just one whose counts are zero.
  function analyticsHtml(report) {
    if (!report) {
      return emptyStateHtml('nodata', 'No analytics data is available for your specialty yet.');
    }
    var rows = [
      ['Check-in completion (last 30 days)',
        report.check_in_completion.total_check_ins + ' check-in(s) from ' + report.check_in_completion.distinct_patients_checked_in +
        ' patient(s) &middot; ' + Math.round(report.check_in_completion.completion_rate * 100) + '% of roster'],
      ['Care plan activity',
        report.care_plan_activity.active_plan_versions + ' active, ' + report.care_plan_activity.superseded_plan_versions +
        ' superseded (' + report.care_plan_activity.total_plan_versions + ' version(s) total)'],
      ['Calculator engagement',
        report.calculator_engagement.total_results + ' result(s) from ' + report.calculator_engagement.distinct_patients_engaged + ' patient(s)'],
      ['Inventory turnover',
        report.inventory_turnover.dispensed_quantity + ' dispensed, ' + report.inventory_turnover.restocked_quantity +
        ' restocked (' + report.inventory_turnover.total_transactions + ' transaction(s))'],
      ['PillFill fulfillment',
        report.pillfill_fulfillment.fulfilled_or_later + ' of ' + report.pillfill_fulfillment.total_orders +
        ' order(s) fulfilled or later &middot; ' + Math.round(report.pillfill_fulfillment.fulfillment_rate * 100) + '%'],
      ['Appointment conversion',
        report.appointment_conversion.by_status.completed + ' of ' + report.appointment_conversion.total_appointments +
        ' completed &middot; ' + Math.round(report.appointment_conversion.completion_rate * 100) + '%']
    ];
    var items = rows.map(function (pair) {
      return '<li>' +
        '<div class="roster-name">' + escapeHtmlForDisplay(pair[0]) + '</div>' +
        '<div class="roster-conditions">' + pair[1] + '</div>' +
        '</li>';
    }).join('');
    return '<ul class="roster-list">' + items + '</ul>';
  }

  function loadAnalyticsPreview(sessionToken, capabilityKey) {
    var body = document.getElementById('card-' + capabilityKey + '-body');
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_doctor_analytics', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status === 'ok' && data.data) {
          body.innerHTML = analyticsHtml(data.data);
        } else {
          body.innerHTML = '<p class="empty-text">Could not load your analytics. Check your connection and reload the page.</p>';
        }
      })
      .catch(function () {
        body.innerHTML = '<p class="empty-text">Could not load your analytics. Check your connection and reload the page.</p>';
      });
  }

  // The AI Assistant card's body (docs/55-WPI-10-AI-ASSISTANT-ARCHITECTURE-FREEZE.md
  // §14) — the only Doctor Dashboard card that is interactive rather than a passive,
  // read-only list, since AI Assistant's own get_ai_assistant_capabilities/
  // post_ai_assistant_query/post_ai_assistant_decision routes are a picker + a query +
  // a decision, not a single GET. Disabled by default (ADR-023) — this card renders
  // for no doctor until a staff/administrative action explicitly enables it, so most
  // doctors never see any of the markup below at all (fail-closed rendering, the same
  // discipline every existing card already follows).
  //
  // A capability picker constrained to the fixed list get_ai_assistant_capabilities
  // returns — never a free-text prompt box (docs/55 §7.1). A roster-patient selector
  // reusing the same get_doctor_patient_roster route the Patient Roster card already
  // calls — no new patient-lookup mechanism (docs/55 §14). A draft output area that
  // always shows an explicit, un-dismissable "AI-generated draft — not saved" banner
  // above any Accept/Edit/Reject control, so the ADR-022 boundary is visible at the
  // point of use, not just documented. Accept/Edit/Reject call
  // post_ai_assistant_decision only; on acceptance, the UI explicitly directs the
  // doctor to the target entity's own existing authoring page — no auto-navigation-
  // with-silent-prefill in this v1 (docs/55 §14's own disclosed, deliberately simple
  // starting point).
  function aiAssistantPickerHtml(capabilities, rosterEntries) {
    if (!capabilities.length) {
      return emptyStateHtml('nodata', 'No AI Assistant capabilities are registered yet.');
    }
    var capabilityOptions = capabilities.map(function (c) {
      return '<option value="' + escapeHtmlForDisplay(c.capability_key) + '">' + escapeHtmlForDisplay(c.display_name) + '</option>';
    }).join('');
    var patientOptions = rosterEntries.map(function (p) {
      return '<option value="' + escapeHtmlForDisplay(p.patient_id) + '">' + escapeHtmlForDisplay(p.full_name) + '</option>';
    }).join('');
    return '<div class="ai-assistant-picker">' +
      '<label for="aiaCapabilitySelect">Capability</label>' +
      '<select id="aiaCapabilitySelect">' + capabilityOptions + '</select>' +
      '<label for="aiaPatientSelect">Patient</label>' +
      '<select id="aiaPatientSelect">' + (patientOptions || '<option value="">No roster patients</option>') + '</select>' +
      '<button type="button" id="aiaRunBtn">Get Draft</button>' +
      '</div>' +
      '<div id="aiaResultArea"></div>';
  }

  // Human-readable labels for AIAssistantInteraction's own doctor_decision enum —
  // display only.
  var AI_ASSISTANT_DECISION_LABELS_ = {
    accepted: 'Accepted',
    edited_and_accepted: 'Edited and accepted',
    rejected: 'Rejected',
    ignored: 'Ignored'
  };

  // Renders one AIAssistantInteraction's draft + the mandatory, un-dismissable
  // ADR-022 banner + Accept/Edit/Reject controls, or (once decided) the recorded
  // decision. The banner always renders above the controls in markup order — the
  // exact property validation/wpi-10-ai-assistant/browser-test.js checks for.
  function aiAssistantDraftHtml(interaction, capability) {
    var flagsHtml = interaction.ai_output_flags.length
      ? '<ul class="ai-assistant-flags">' + interaction.ai_output_flags.map(function (f) {
          return '<li>' + escapeHtmlForDisplay(f) + '</li>';
        }).join('') + '</ul>'
      : '';
    var banner = '<p class="ai-assistant-banner" role="note">AI-generated draft &mdash; not saved</p>';
    var draftText = '<p class="ai-assistant-output">' + escapeHtmlForDisplay(interaction.ai_output) + '</p>';

    if (interaction.doctor_decision !== 'pending') {
      var decisionLabel = AI_ASSISTANT_DECISION_LABELS_[interaction.doctor_decision] || escapeHtmlForDisplay(interaction.doctor_decision);
      return banner + draftText + flagsHtml +
        '<p class="ai-assistant-decision">Decision recorded: ' + decisionLabel + '.</p>';
    }

    var targetNote = capability && capability.target_entity_type
      ? '<p class="ai-assistant-target-note">To save this, open the ' + escapeHtmlForDisplay(capability.target_entity_type) + ' page and enter it there yourself &mdash; accepting here only records your decision, it does not save anything.</p>'
      : '<p class="ai-assistant-target-note">This capability is reference-only &mdash; there is nothing to save elsewhere.</p>';

    return banner + draftText + flagsHtml + targetNote +
      '<div class="ai-assistant-decision-controls">' +
      '<button type="button" data-decision="accepted">Accept</button>' +
      '<button type="button" data-decision="edited_and_accepted">Edit &amp; Accept</button>' +
      '<button type="button" data-decision="rejected">Reject</button>' +
      '</div>';
  }

  function loadAiAssistantCard(sessionToken, capabilityKey) {
    var body = document.getElementById('card-' + capabilityKey + '-body');
    Promise.all([
      fetch(WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ foundation_action: 'get_ai_assistant_capabilities', session_token: sessionToken })
      }).then(function (response) { return response.json(); }),
      // Reuses the same get_doctor_patient_roster route the Patient Roster card
      // already calls — no new patient-lookup mechanism (docs/55 §14).
      fetch(WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ foundation_action: 'get_doctor_patient_roster', session_token: sessionToken })
      }).then(function (response) { return response.json(); })
    ])
      .then(function (results) {
        var capabilitiesEnv = results[0];
        var rosterEnv = results[1];
        if (capabilitiesEnv.status !== 'ok' || rosterEnv.status !== 'ok') {
          body.innerHTML = '<p class="empty-text">Could not load AI Assistant. Check your connection and reload the page.</p>';
          return;
        }
        var capabilities = capabilitiesEnv.data;
        var roster = rosterEnv.data;
        body.innerHTML = aiAssistantPickerHtml(capabilities, roster);

        var runBtn = document.getElementById('aiaRunBtn');
        if (!runBtn) return; // no capabilities registered — nothing further to wire

        runBtn.addEventListener('click', function () {
          var capabilityKeySelected = document.getElementById('aiaCapabilitySelect').value;
          var patientIdSelected = document.getElementById('aiaPatientSelect').value;
          var resultArea = document.getElementById('aiaResultArea');
          runBtn.disabled = true;
          resultArea.innerHTML = '<div class="skeleton"></div>';
          fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              foundation_action: 'post_ai_assistant_query',
              session_token: sessionToken,
              capability_key: capabilityKeySelected,
              patient_id: patientIdSelected
            })
          })
            .then(function (response) { return response.json(); })
            .then(function (data) {
              runBtn.disabled = false;
              if (data.status !== 'ok') {
                resultArea.innerHTML = '<p class="empty-text">' + escapeHtmlForDisplay(data.error && data.error.message ? data.error.message : 'Could not generate a draft right now.') + '</p>';
                return;
              }
              var capability = capabilities.filter(function (c) { return c.capability_key === capabilityKeySelected; })[0];
              resultArea.innerHTML = aiAssistantDraftHtml(data.data, capability);
              wireAiAssistantDecisionButtons(sessionToken, resultArea, data.data, capability);
            })
            .catch(function () {
              runBtn.disabled = false;
              resultArea.innerHTML = '<p class="empty-text">Could not reach the server. Check your connection and try again.</p>';
            });
        });
      })
      .catch(function () {
        body.innerHTML = '<p class="empty-text">Could not load AI Assistant. Check your connection and reload the page.</p>';
      });
  }

  // Wires the Accept/Edit/Reject controls rendered by aiAssistantDraftHtml() to
  // post_ai_assistant_decision — the only action any of the three ever calls
  // (ADR-022: recording a decision never itself persists anything into a target
  // entity).
  function wireAiAssistantDecisionButtons(sessionToken, resultArea, interaction, capability) {
    var buttons = resultArea.querySelectorAll('[data-decision]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (evt) {
        var decision = evt.currentTarget.getAttribute('data-decision');
        fetch(WEB_APP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            foundation_action: 'post_ai_assistant_decision',
            session_token: sessionToken,
            interaction_id: interaction.interaction_id,
            doctor_decision: decision
          })
        })
          .then(function (response) { return response.json(); })
          .then(function (data) {
            if (data.status === 'ok') {
              resultArea.innerHTML = aiAssistantDraftHtml(data.data, capability);
            }
          });
      });
    }
  }

  // The Holoscan Review card's body (docs/56-WPI-11-HOLOSCAN-ARCHITECTURE-FREEZE.md
  // §19.2) — every pending HoloscanRecognitionItem across the caller's own derived
  // roster, each with an always-visible, un-dismissable "AI-recognized — not yet in
  // Medication History" banner above its own Approve/Correct/Reject control,
  // mirroring AI Assistant's own "AI-generated draft — not saved" banner precedent
  // exactly (docs/55 §14) so ADR-025's boundary is visible at the point of use.
  // Disabled by default (ADR-026) — this card renders for no doctor until a
  // staff/administrative action explicitly enables it.
  function holoscanCandidateSummaryHtml_(item) {
    var fields = [
      ['Name', item.extracted_name], ['Strength', item.extracted_strength],
      ['Form', item.extracted_dosage_form], ['Manufacturer', item.extracted_manufacturer],
      ['Batch', item.extracted_batch], ['Expiry', item.extracted_expiry]
    ].filter(function (pair) { return pair[1]; })
      .map(function (pair) { return escapeHtmlForDisplay(pair[0]) + ': ' + escapeHtmlForDisplay(pair[1]); })
      .join(' &middot; ');
    return fields || 'No legible fields extracted from this photo.';
  }

  function holoscanReviewQueueHtml(entries) {
    if (!entries.length) {
      return emptyStateHtml('nodata', 'No Holoscan submissions are awaiting your review.');
    }
    var items = entries.map(function (item) {
      var flagsHtml = item.check_flags.length
        ? '<ul class="ai-assistant-flags">' + item.check_flags.map(function (f) { return '<li>' + escapeHtmlForDisplay(f) + '</li>'; }).join('') + '</ul>'
        : '';
      return '<li data-holoscan-item="' + escapeHtmlForDisplay(item.recognition_item_id) + '">' +
        '<p class="ai-assistant-banner" role="note">AI-recognized &mdash; not yet in Medication History</p>' +
        '<div class="roster-name">' + escapeHtmlForDisplay(item.confidence_score) + ' confidence</div>' +
        '<div class="roster-conditions">' + holoscanCandidateSummaryHtml_(item) + '</div>' +
        flagsHtml +
        '<div class="ai-assistant-decision-controls">' +
        '<button type="button" data-holoscan-decision="approved">Approve</button>' +
        '<button type="button" data-holoscan-decision="rejected">Reject</button>' +
        '</div>' +
        '</li>';
    }).join('');
    return '<ul class="roster-list">' + items + '</ul>';
  }

  // Approve/Reject controls call post_holoscan_recognition_decision only — never
  // auto-navigating to, or silently prefilling, Medication History's own authoring
  // form (docs/56 §19.2's disclosed restraint, mirroring docs/55 §14's identical one
  // for AI Assistant's own Accept action).
  function wireHoloscanDecisionButtons_(sessionToken, body, capabilityKey) {
    body.querySelectorAll('[data-holoscan-decision]').forEach(function (btn) {
      btn.addEventListener('click', function (evt) {
        var li = evt.currentTarget.closest('[data-holoscan-item]');
        var recognitionItemId = li.getAttribute('data-holoscan-item');
        var decision = evt.currentTarget.getAttribute('data-holoscan-decision');
        fetch(WEB_APP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            foundation_action: 'post_holoscan_recognition_decision', session_token: sessionToken,
            recognition_item_id: recognitionItemId, doctor_decision: decision
          })
        })
          .then(function (response) { return response.json(); })
          .then(function (data) {
            if (data.status === 'ok') {
              li.innerHTML = '<p class="ai-assistant-decision">Decision recorded: ' + escapeHtmlForDisplay(decision) +
                '. To add this to the patient\'s Medication History, open the Medication History card and enter it there yourself &mdash; this decision alone does not save anything.</p>';
            }
          });
      });
    });
  }

  function loadHoloscanReviewQueue(sessionToken, capabilityKey) {
    var body = document.getElementById('card-' + capabilityKey + '-body');
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_holoscan_review_queue', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status === 'ok' && Array.isArray(data.data)) {
          body.innerHTML = holoscanReviewQueueHtml(data.data);
          wireHoloscanDecisionButtons_(sessionToken, body, capabilityKey);
        } else {
          body.innerHTML = '<p class="empty-text">Could not load the Holoscan review queue. Check your connection and reload the page.</p>';
        }
      })
      .catch(function () {
        body.innerHTML = '<p class="empty-text">Could not load the Holoscan review queue. Check your connection and reload the page.</p>';
      });
  }

  // The Medication History card's body (docs/56 §19.3) — a roster-scoped, per-patient
  // view (reusing the Patient Roster card's own patient-selection route, no new
  // patient-lookup mechanism), an "Add Entry" form calling
  // create_medication_history_entry, and Continue/Stop/Replace/Unknown controls
  // calling record_medication_decision — never implying a status changed until the
  // doctor's own explicit action records it.
  var MEDICATION_STATUS_LABELS_ = { active: 'Active', stopped: 'Stopped', replaced: 'Replaced', unknown: 'Unknown' };
  var MEDICATION_DECISION_TYPE_LABELS_ = { continue: 'Continue', stop: 'Stop', replace: 'Replace', unknown: 'Mark unknown' };

  function medicationHistoryPatientPickerHtml_(rosterEntries) {
    var options = rosterEntries.map(function (p) {
      return '<option value="' + escapeHtmlForDisplay(p.patient_id) + '">' + escapeHtmlForDisplay(p.full_name) + '</option>';
    }).join('');
    return '<div class="medication-history-picker">' +
      '<label for="mhPatientSelect">Patient</label>' +
      '<select id="mhPatientSelect">' + (options || '<option value="">No roster patients</option>') + '</select>' +
      '<button type="button" id="mhLoadBtn">Load</button>' +
      '</div>' +
      '<div id="mhResultArea"></div>';
  }

  function medicationHistoryAddEntryFormHtml_() {
    return '<form id="mhAddEntryForm">' +
      '<div class="field"><label for="mhMedicineName">Medicine name</label><input id="mhMedicineName" type="text" required></div>' +
      '<div class="field"><label for="mhStrength">Strength</label><input id="mhStrength" type="text"></div>' +
      '<div class="field"><label for="mhDosageForm">Dosage form</label><input id="mhDosageForm" type="text"></div>' +
      '<div class="field"><label for="mhManufacturer">Manufacturer</label><input id="mhManufacturer" type="text"></div>' +
      '<button class="submit" type="submit" id="mhAddEntrySubmitBtn">Add to Medication History</button>' +
      '<div class="status" id="mhAddEntryStatus" role="status" aria-live="polite"></div>' +
      '</form>';
  }

  // "Replace" needs a second, explicit choice beyond the button itself — which other
  // MedicationHistory entry for this same patient replaces this one
  // (record_medication_decision's own replacement_medication_history_id, docs/56 §11.4's
  // disclosed boundary: it must reference a different, already-existing row for the same
  // patient). `otherEntries` is every entry for this patient except this one; rendered as
  // a plain <select> alongside the Replace button, never a silent/implicit choice.
  function medicationDecisionControlsHtml_(medicationHistoryId, otherEntries) {
    var replaceControl;
    if (otherEntries.length) {
      var replaceOptions = otherEntries.map(function (e) {
        return '<option value="' + escapeHtmlForDisplay(e.medication_history_id) + '">' + escapeHtmlForDisplay(e.medicine_name) + '</option>';
      }).join('');
      replaceControl =
        '<select data-mh-replace-select aria-label="Replacement medicine">' + replaceOptions + '</select>' +
        '<button type="button" data-mh-decision="replace">Replace</button>';
    } else {
      // No other MedicationHistory entry exists yet for this patient to replace with —
      // named, disclosed limitation (docs/56 §11.4: "this freeze names no mechanism for
      // recording a replacement medication that was never itself photographed and
      // recognized"), never a silently-hidden or broken control.
      replaceControl = '<span class="mh-replace-unavailable">No other medication on record yet to replace with</span>';
    }
    return '<div class="ai-assistant-decision-controls" data-mh-decision-controls="' + escapeHtmlForDisplay(medicationHistoryId) + '">' +
      '<button type="button" data-mh-decision="continue">Continue</button>' +
      '<button type="button" data-mh-decision="stop">Stop</button>' +
      replaceControl +
      '<button type="button" data-mh-decision="unknown">Mark unknown</button>' +
      '</div>';
  }

  function medicationHistoryEntryHtml_(entry, allEntries) {
    var ledgerItems = (entry.decisions || []).slice().sort(function (a, b) {
      return a.decided_at < b.decided_at ? 1 : (a.decided_at > b.decided_at ? -1 : 0);
    }).map(function (d) {
      return '<li>' + escapeHtmlForDisplay(String(d.decided_at).slice(0, 10)) + ' &mdash; ' +
        escapeHtmlForDisplay(MEDICATION_DECISION_TYPE_LABELS_[d.decision_type] || d.decision_type) + '</li>';
    }).join('');
    var otherEntries = allEntries.filter(function (e) { return e.medication_history_id !== entry.medication_history_id; });
    return '<li>' +
      '<div class="roster-name">' + escapeHtmlForDisplay(entry.medicine_name) + ' &middot; ' +
      escapeHtmlForDisplay(MEDICATION_STATUS_LABELS_[entry.current_status] || entry.current_status) + '</div>' +
      '<div class="roster-conditions">' + escapeHtmlForDisplay(entry.strength || '') + ' ' + escapeHtmlForDisplay(entry.dosage_form || '') + '</div>' +
      (ledgerItems ? '<ul class="mh-doctor-ledger">' + ledgerItems + '</ul>' : '') +
      medicationDecisionControlsHtml_(entry.medication_history_id, otherEntries) +
      '</li>';
  }

  function medicationHistoryListHtml_(entries) {
    if (!entries.length) {
      return emptyStateHtml('nodata', 'This patient has no Medication History entries yet.');
    }
    return '<ul class="roster-list">' + entries.map(function (entry) { return medicationHistoryEntryHtml_(entry, entries); }).join('') + '</ul>';
  }

  function wireMedicationDecisionButtons_(sessionToken, resultArea, patientId) {
    resultArea.querySelectorAll('[data-mh-decision]').forEach(function (btn) {
      btn.addEventListener('click', function (evt) {
        var controls = evt.currentTarget.closest('[data-mh-decision-controls]');
        var medicationHistoryId = controls.getAttribute('data-mh-decision-controls');
        var decisionType = evt.currentTarget.getAttribute('data-mh-decision');
        var requestBody = {
          foundation_action: 'record_medication_decision', session_token: sessionToken,
          medication_history_id: medicationHistoryId, decision_type: decisionType
        };
        if (decisionType === 'replace') {
          var select = controls.querySelector('[data-mh-replace-select]');
          // No target selected (or none exists) — nothing to submit; the doctor's own
          // explicit selection is required, never a default/implicit choice.
          if (!select || !select.value) return;
          requestBody.replacement_medication_history_id = select.value;
        }
        fetch(WEB_APP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(requestBody)
        })
          .then(function (response) { return response.json(); })
          .then(function (data) {
            if (data.status === 'ok') {
              loadMedicationHistoryForPatient_(sessionToken, resultArea, patientId);
            }
          });
      });
    });
  }

  function wireMedicationAddEntryForm_(sessionToken, resultArea, patientId) {
    var form = document.getElementById('mhAddEntryForm');
    if (!form) return;
    var submitBtn = document.getElementById('mhAddEntrySubmitBtn');
    var statusBox = document.getElementById('mhAddEntryStatus');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      submitBtn.disabled = true;
      statusBox.className = 'status loading';
      statusBox.textContent = 'Saving…';
      fetch(WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          foundation_action: 'create_medication_history_entry', session_token: sessionToken, patient_id: patientId,
          medicine_name: document.getElementById('mhMedicineName').value,
          strength: document.getElementById('mhStrength').value,
          dosage_form: document.getElementById('mhDosageForm').value,
          manufacturer: document.getElementById('mhManufacturer').value
        })
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          submitBtn.disabled = false;
          if (data.status === 'ok') {
            statusBox.className = 'status ok';
            statusBox.textContent = 'Added.';
            form.reset();
            loadMedicationHistoryForPatient_(sessionToken, resultArea, patientId);
          } else {
            statusBox.className = 'status err';
            statusBox.textContent = (data.error && data.error.message) || 'Something went wrong. Please try again.';
          }
        })
        .catch(function () {
          submitBtn.disabled = false;
          statusBox.className = 'status err';
          statusBox.textContent = 'Could not reach the server. Check your connection and try again.';
        });
    });
  }

  function loadMedicationHistoryForPatient_(sessionToken, resultArea, patientId) {
    resultArea.innerHTML = '<div class="skeleton"></div>';
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_medication_history', session_token: sessionToken, patient_id: patientId })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status !== 'ok' || !Array.isArray(data.data)) {
          resultArea.innerHTML = '<p class="empty-text">Could not load Medication History. Check your connection and reload the page.</p>';
          return;
        }
        resultArea.innerHTML = medicationHistoryListHtml_(data.data) + medicationHistoryAddEntryFormHtml_();
        wireMedicationDecisionButtons_(sessionToken, resultArea, patientId);
        wireMedicationAddEntryForm_(sessionToken, resultArea, patientId);
      })
      .catch(function () {
        resultArea.innerHTML = '<p class="empty-text">Could not load Medication History. Check your connection and reload the page.</p>';
      });
  }

  function loadMedicationHistoryCard(sessionToken, capabilityKey) {
    var body = document.getElementById('card-' + capabilityKey + '-body');
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_doctor_patient_roster', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status !== 'ok') {
          body.innerHTML = '<p class="empty-text">Could not load your patient roster. Check your connection and reload the page.</p>';
          return;
        }
        body.innerHTML = medicationHistoryPatientPickerHtml_(data.data);
        var loadBtn = document.getElementById('mhLoadBtn');
        if (!loadBtn) return; // no roster patients — nothing further to wire
        loadBtn.addEventListener('click', function () {
          var patientId = document.getElementById('mhPatientSelect').value;
          var resultArea = document.getElementById('mhResultArea');
          if (patientId) loadMedicationHistoryForPatient_(sessionToken, resultArea, patientId);
        });
      })
      .catch(function () {
        body.innerHTML = '<p class="empty-text">Could not load your patient roster. Check your connection and reload the page.</p>';
      });
  }

  // ---- Milestone Review card (Batch PXP-11, docs/58 §19.2) ----
  // A roster-scoped, per-patient Health Milestones authoring surface: a patient picker
  // (reusing the same get_doctor_patient_roster route the Patient Roster card already
  // returns — no new patient-lookup mechanism), a care-start-anchor control
  // (set_milestone_track), and, per milestone point, a six-dimension authoring form
  // (save_milestone_review) plus an explicit Publish control (publish_milestone_review).
  // Non-AI (ADR-027): every field is doctor-typed, nothing is model-generated. The UI
  // makes plain that a review is a PRIVATE DRAFT until published, and that publishing is
  // what makes it visible to the patient (docs/58 §10.2/§19.2).
  var MILESTONE_LABELS_ = { '30_day': '30 Days', '90_day': '90 Days', '6_month': '6 Months', '1_year': '1 Year' };
  var MILESTONE_STATE_LABELS_ = { upcoming: 'Upcoming', due: 'Due', overdue: 'Overdue', completed: 'Completed' };
  var MILESTONE_REVIEW_DIMENSIONS_ = [
    { key: 'progress_summary', label: 'Progress', required: true },
    { key: 'improvements', label: 'Improvements', required: false },
    { key: 'medicines_review', label: 'Medicines', required: false },
    { key: 'investigations', label: 'Investigations', required: false },
    { key: 'recommendations', label: 'Recommendations', required: false },
    { key: 'next_goals', label: 'Next goals', required: false }
  ];

  function milestonePatientPickerHtml_(rosterEntries) {
    var options = rosterEntries.map(function (p) {
      return '<option value="' + escapeHtmlForDisplay(p.patient_id) + '">' + escapeHtmlForDisplay(p.full_name) + '</option>';
    }).join('');
    return '<div class="milestone-review-picker">' +
      '<label for="msPatientSelect">Patient</label>' +
      '<select id="msPatientSelect">' + (options || '<option value="">No roster patients</option>') + '</select>' +
      '<button type="button" id="msLoadBtn">Load</button>' +
      '</div>' +
      '<div id="msResultArea"></div>';
  }

  function milestoneAnchorFormHtml_(track) {
    var current = track && track.care_start_date ? track.care_start_date : '';
    var statusLine = track
      ? '<p class="ms-anchor-status">Care start date set to <strong>' + escapeHtmlForDisplay(track.care_start_date) + '</strong> (' + escapeHtmlForDisplay(track.status) + ').</p>'
      : '<p class="ms-anchor-status">No care-start date set yet — set one to start this patient\'s milestone schedule.</p>';
    return '<form id="msAnchorForm" class="ms-anchor-form">' +
      statusLine +
      '<div class="field"><label for="msCareStartDate">Care start date</label>' +
      '<input id="msCareStartDate" type="date" value="' + escapeHtmlForDisplay(current) + '" required></div>' +
      '<button class="submit" type="submit" id="msAnchorSubmitBtn">' + (track ? 'Update care-start date' : 'Set care-start date') + '</button>' +
      '<div class="status" id="msAnchorStatus" role="status" aria-live="polite"></div>' +
      '</form>';
  }

  // One milestone point's authoring block: the point's state, its published/draft
  // visibility, the six-dimension form, a Save-draft button and (for an unpublished
  // review) an explicit Publish button. The draft-vs-published visibility boundary is
  // stated in words, never implied.
  function milestonePointBlockHtml_(point, review) {
    var label = MILESTONE_LABELS_[point.milestone_type] || point.milestone_type;
    var isPublished = review && review.status === 'published';
    var visibilityBanner = isPublished
      ? '<p class="ms-visibility ms-visibility-published" data-ms-visibility="published">Published &mdash; visible to the patient.</p>'
      : '<p class="ms-visibility ms-visibility-draft" data-ms-visibility="draft">Draft &mdash; private to you. The patient sees nothing until you press Publish.</p>';
    var fields = MILESTONE_REVIEW_DIMENSIONS_.map(function (dim) {
      var value = review && review[dim.key] ? review[dim.key] : '';
      return '<div class="field"><label for="ms-' + point.milestone_type + '-' + dim.key + '">' + escapeHtmlForDisplay(dim.label) +
        (dim.required ? ' *' : '') + '</label>' +
        '<textarea id="ms-' + point.milestone_type + '-' + dim.key + '" data-ms-field="' + dim.key + '"' +
        (isPublished ? ' readonly' : '') + (dim.required ? ' required' : '') + ' rows="2">' + escapeHtmlForDisplay(value) + '</textarea></div>';
    }).join('');
    var actions = isPublished
      ? '<p class="ms-published-note">This review is published and can no longer be edited.</p>'
      : '<button type="button" class="submit" data-ms-save="' + point.milestone_type + '">Save draft</button>' +
        (review ? '<button type="button" class="ms-publish-btn" data-ms-publish="' + escapeHtmlForDisplay(review.review_id) + '">Publish to patient</button>' : '');
    return '<div class="ms-point" data-ms-point="' + point.milestone_type + '">' +
      '<h4>' + escapeHtmlForDisplay(label) + ' &middot; <span class="ms-state">' + escapeHtmlForDisplay(MILESTONE_STATE_LABELS_[point.state] || point.state) + '</span>' +
      (point.target_date ? ' &middot; <span class="ms-target">Target ' + escapeHtmlForDisplay(point.target_date) + '</span>' : '') + '</h4>' +
      visibilityBanner +
      '<form data-ms-review-form="' + point.milestone_type + '">' + fields + '<div class="ms-actions">' + actions + '</div>' +
      '<div class="status" data-ms-status="' + point.milestone_type + '" role="status" aria-live="polite"></div></form>' +
      '</div>';
  }

  function milestoneResultHtml_(payload) {
    var track = payload && payload.track;
    var schedule = (payload && payload.schedule) || [];
    var reviews = (payload && payload.reviews) || [];
    var reviewsByType = {};
    reviews.forEach(function (r) { reviewsByType[r.milestone_type] = r; });
    var anchorHtml = milestoneAnchorFormHtml_(track);
    if (!track) {
      return anchorHtml;
    }
    // If the track is paused, the computed schedule is empty; still let the doctor see
    // the anchor form (to un-pause) — reviews are keyed by type via the schedule below.
    if (!schedule.length) {
      return anchorHtml + '<p class="empty-text">This patient\'s milestone schedule is paused. Set the care-start date to active to resume it.</p>';
    }
    var points = schedule.map(function (p) { return milestonePointBlockHtml_(p, reviewsByType[p.milestone_type]); }).join('');
    return anchorHtml + '<div class="ms-points">' + points + '</div>';
  }

  function wireMilestoneAnchorForm_(sessionToken, resultArea, patientId) {
    var form = document.getElementById('msAnchorForm');
    if (!form) return;
    var submitBtn = document.getElementById('msAnchorSubmitBtn');
    var statusBox = document.getElementById('msAnchorStatus');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      submitBtn.disabled = true;
      statusBox.className = 'status loading';
      statusBox.textContent = 'Saving…';
      fetch(WEB_APP_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ foundation_action: 'set_milestone_track', session_token: sessionToken, patient_id: patientId, care_start_date: document.getElementById('msCareStartDate').value })
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          submitBtn.disabled = false;
          if (data.status === 'ok') { loadMilestonesForPatient_(sessionToken, resultArea, patientId); }
          else { statusBox.className = 'status err'; statusBox.textContent = (data.error && data.error.message) || 'Something went wrong.'; }
        })
        .catch(function () { submitBtn.disabled = false; statusBox.className = 'status err'; statusBox.textContent = 'Could not reach the server.'; });
    });
  }

  function wireMilestoneReviewForms_(sessionToken, resultArea, patientId) {
    resultArea.querySelectorAll('[data-ms-save]').forEach(function (btn) {
      btn.addEventListener('click', function (evt) {
        var milestoneType = evt.currentTarget.getAttribute('data-ms-save');
        var pointEl = evt.currentTarget.closest('[data-ms-point]');
        var statusBox = pointEl.querySelector('[data-ms-status]');
        var body = { foundation_action: 'save_milestone_review', session_token: sessionToken, patient_id: patientId, milestone_type: milestoneType };
        pointEl.querySelectorAll('[data-ms-field]').forEach(function (ta) { body[ta.getAttribute('data-ms-field')] = ta.value; });
        if (!body.progress_summary || !body.progress_summary.trim()) {
          statusBox.className = 'status err'; statusBox.textContent = 'Progress is required.'; return;
        }
        statusBox.className = 'status loading'; statusBox.textContent = 'Saving draft…';
        fetch(WEB_APP_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
          .then(function (response) { return response.json(); })
          .then(function (data) {
            if (data.status === 'ok') { loadMilestonesForPatient_(sessionToken, resultArea, patientId); }
            else { statusBox.className = 'status err'; statusBox.textContent = (data.error && data.error.message) || 'Something went wrong.'; }
          })
          .catch(function () { statusBox.className = 'status err'; statusBox.textContent = 'Could not reach the server.'; });
      });
    });
    resultArea.querySelectorAll('[data-ms-publish]').forEach(function (btn) {
      btn.addEventListener('click', function (evt) {
        var reviewId = evt.currentTarget.getAttribute('data-ms-publish');
        var pointEl = evt.currentTarget.closest('[data-ms-point]');
        var statusBox = pointEl.querySelector('[data-ms-status]');
        statusBox.className = 'status loading'; statusBox.textContent = 'Publishing…';
        fetch(WEB_APP_URL, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ foundation_action: 'publish_milestone_review', session_token: sessionToken, review_id: reviewId })
        })
          .then(function (response) { return response.json(); })
          .then(function (data) {
            if (data.status === 'ok') { loadMilestonesForPatient_(sessionToken, resultArea, patientId); }
            else { statusBox.className = 'status err'; statusBox.textContent = (data.error && data.error.message) || 'Something went wrong.'; }
          })
          .catch(function () { statusBox.className = 'status err'; statusBox.textContent = 'Could not reach the server.'; });
      });
    });
  }

  function loadMilestonesForPatient_(sessionToken, resultArea, patientId) {
    resultArea.innerHTML = '<div class="skeleton"></div>';
    fetch(WEB_APP_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_patient_milestones', session_token: sessionToken, patient_id: patientId })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status !== 'ok' || !data.data) {
          resultArea.innerHTML = '<p class="empty-text">Could not load milestones. Check your connection and reload the page.</p>';
          return;
        }
        resultArea.innerHTML = milestoneResultHtml_(data.data);
        wireMilestoneAnchorForm_(sessionToken, resultArea, patientId);
        wireMilestoneReviewForms_(sessionToken, resultArea, patientId);
      })
      .catch(function () {
        resultArea.innerHTML = '<p class="empty-text">Could not load milestones. Check your connection and reload the page.</p>';
      });
  }

  function loadMilestoneReviewCard(sessionToken, capabilityKey) {
    var body = document.getElementById('card-' + capabilityKey + '-body');
    fetch(WEB_APP_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_doctor_patient_roster', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status !== 'ok') {
          body.innerHTML = '<p class="empty-text">Could not load your patient roster. Check your connection and reload the page.</p>';
          return;
        }
        body.innerHTML = milestonePatientPickerHtml_(data.data);
        var loadBtn = document.getElementById('msLoadBtn');
        if (!loadBtn) return;
        loadBtn.addEventListener('click', function () {
          var patientId = document.getElementById('msPatientSelect').value;
          var resultArea = document.getElementById('msResultArea');
          if (patientId) loadMilestonesForPatient_(sessionToken, resultArea, patientId);
        });
      })
      .catch(function () {
        body.innerHTML = '<p class="empty-text">Could not load your patient roster. Check your connection and reload the page.</p>';
      });
  }

  // ---- Digital Twin Review card (Batch PXP-12, docs/59 §14.2) ----
  // The platform's highest-risk AI surface: a doctor generates a patient-facing narrative and
  // approves it before the patient ever sees it (ADR-028). Disabled by default (ADR-030) — this
  // card renders for no doctor until a staff/administrative action explicitly enables it. A
  // roster-scoped patient picker (reusing get_doctor_patient_roster), a narrative-type generate
  // control (generate_digital_twin_narrative), and, per narrative, an always-visible,
  // un-dismissable "AI-generated draft — not yet visible to the patient" banner above any
  // Approve/Edit/Reject control (review_digital_twin_narrative) — so the ADR-028 boundary is
  // visible at the point of use. Approve publishes the model's text; Edit & Approve publishes the
  // doctor's own words; Reject shows the patient nothing.
  var DIGITAL_TWIN_STATUS_LABELS_ = { pending: 'Pending review', approved: 'Approved', edited_and_approved: 'Edited & approved', rejected: 'Rejected' };

  function digitalTwinPatientPickerHtml_(rosterEntries) {
    var options = rosterEntries.map(function (p) {
      return '<option value="' + escapeHtmlForDisplay(p.patient_id) + '">' + escapeHtmlForDisplay(p.full_name) + '</option>';
    }).join('');
    return '<div class="digital-twin-picker">' +
      '<label for="dtPatientSelect">Patient</label>' +
      '<select id="dtPatientSelect">' + (options || '<option value="">No roster patients</option>') + '</select>' +
      '<button type="button" id="dtLoadBtn">Load</button>' +
      '</div>' +
      '<div id="dtResultArea"></div>';
  }

  function digitalTwinGenerateControlHtml_(narrativeTypes) {
    var options = (narrativeTypes || []).map(function (n) {
      return '<option value="' + escapeHtmlForDisplay(n.narrative_type) + '">' + escapeHtmlForDisplay(n.display_name) + '</option>';
    }).join('');
    return '<div class="dt-generate">' +
      '<label for="dtNarrativeType">Narrative type</label>' +
      '<select id="dtNarrativeType">' + (options || '<option value="">None available</option>') + '</select>' +
      '<button type="button" id="dtGenerateBtn">Generate draft</button>' +
      '<div class="status" id="dtGenerateStatus" role="status" aria-live="polite"></div>' +
      '</div>';
  }

  // One narrative: the mandatory, un-dismissable ADR-028 banner (naming PATIENT VISIBILITY as
  // what approval unlocks) always precedes any decision control, for a pending draft; a
  // reviewed narrative shows its recorded decision and the published text (if any), read-only.
  function digitalTwinNarrativeHtml_(narrative) {
    var flagsHtml = (narrative.ai_output_flags && narrative.ai_output_flags.length)
      ? '<ul class="ai-assistant-flags">' + narrative.ai_output_flags.map(function (f) { return '<li>' + escapeHtmlForDisplay(f) + '</li>'; }).join('') + '</ul>'
      : '';
    var typeLabel = escapeHtmlForDisplay(narrative.narrative_type);
    if (narrative.review_status === 'pending') {
      return '<li data-dt-narrative="' + escapeHtmlForDisplay(narrative.narrative_id) + '">' +
        '<p class="ai-assistant-banner" role="note" data-dt-visibility="draft">AI-generated draft &mdash; not yet visible to the patient. Approving is what makes it visible.</p>' +
        '<div class="roster-name">' + typeLabel + '</div>' +
        '<p class="ai-assistant-output" data-dt-output>' + escapeHtmlForDisplay(narrative.ai_output) + '</p>' +
        flagsHtml +
        '<textarea data-dt-edit rows="3" aria-label="Edited narrative">' + escapeHtmlForDisplay(narrative.ai_output) + '</textarea>' +
        '<div class="ai-assistant-decision-controls">' +
        '<button type="button" data-dt-decision="approved">Approve</button>' +
        '<button type="button" data-dt-decision="edited_and_approved">Edit &amp; Approve</button>' +
        '<button type="button" data-dt-decision="rejected">Reject</button>' +
        '</div>' +
        '<div class="status" data-dt-status role="status" aria-live="polite"></div>' +
        '</li>';
    }
    var visibilityLine = (narrative.review_status === 'approved' || narrative.review_status === 'edited_and_approved')
      ? '<p class="ms-visibility ms-visibility-published" data-dt-visibility="published">Approved &mdash; visible to the patient.</p>'
      : '<p class="ms-visibility ms-visibility-draft" data-dt-visibility="rejected">Rejected &mdash; the patient sees nothing.</p>';
    return '<li data-dt-narrative="' + escapeHtmlForDisplay(narrative.narrative_id) + '">' +
      '<div class="roster-name">' + typeLabel + ' &middot; ' + escapeHtmlForDisplay(DIGITAL_TWIN_STATUS_LABELS_[narrative.review_status] || narrative.review_status) + '</div>' +
      visibilityLine +
      (narrative.published_output ? '<p class="ai-assistant-output">' + escapeHtmlForDisplay(narrative.published_output) + '</p>' : '') +
      '</li>';
  }

  function digitalTwinResultHtml_(payload) {
    var view = payload.digital_twin || {};
    var narratives = payload.narratives || [];
    var summary = '<div class="dt-summary"><div class="roster-conditions">' +
      escapeHtmlForDisplay(view.check_in_count || 0) + ' check-ins &middot; ' +
      escapeHtmlForDisplay(view.calculator_result_count || 0) + ' calculator results &middot; ' +
      escapeHtmlForDisplay(view.milestones_celebrated || 0) + ' of ' + escapeHtmlForDisplay(view.milestones_total || 0) + ' milestones celebrated' +
      '</div></div>';
    var generate = digitalTwinGenerateControlHtml_(payload.narrative_types);
    var list = narratives.length
      ? '<ul class="roster-list">' + narratives.map(digitalTwinNarrativeHtml_).join('') + '</ul>'
      : '<p class="empty-text">No narratives generated for this patient yet.</p>';
    return summary + generate + list;
  }

  function wireDigitalTwinControls_(sessionToken, resultArea, patientId) {
    var generateBtn = document.getElementById('dtGenerateBtn');
    if (generateBtn) {
      generateBtn.addEventListener('click', function () {
        var narrativeType = document.getElementById('dtNarrativeType').value;
        var statusBox = document.getElementById('dtGenerateStatus');
        if (!narrativeType) { statusBox.className = 'status err'; statusBox.textContent = 'Choose a narrative type.'; return; }
        statusBox.className = 'status loading'; statusBox.textContent = 'Generating…';
        fetch(WEB_APP_URL, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ foundation_action: 'generate_digital_twin_narrative', session_token: sessionToken, patient_id: patientId, narrative_type: narrativeType })
        })
          .then(function (response) { return response.json(); })
          .then(function (data) {
            if (data.status === 'ok') { loadDigitalTwinForPatient_(sessionToken, resultArea, patientId); }
            else { statusBox.className = 'status err'; statusBox.textContent = (data.error && data.error.message) || 'Something went wrong.'; }
          })
          .catch(function () { statusBox.className = 'status err'; statusBox.textContent = 'Could not reach the server.'; });
      });
    }
    resultArea.querySelectorAll('[data-dt-decision]').forEach(function (btn) {
      btn.addEventListener('click', function (evt) {
        var li = evt.currentTarget.closest('[data-dt-narrative]');
        var narrativeId = li.getAttribute('data-dt-narrative');
        var decision = evt.currentTarget.getAttribute('data-dt-decision');
        var statusBox = li.querySelector('[data-dt-status]');
        var requestBody = { foundation_action: 'review_digital_twin_narrative', session_token: sessionToken, narrative_id: narrativeId, review_status: decision };
        if (decision === 'edited_and_approved') {
          var edit = li.querySelector('[data-dt-edit]');
          requestBody.edited_output = edit ? edit.value : '';
        }
        statusBox.className = 'status loading'; statusBox.textContent = 'Recording…';
        fetch(WEB_APP_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(requestBody) })
          .then(function (response) { return response.json(); })
          .then(function (data) {
            if (data.status === 'ok') { loadDigitalTwinForPatient_(sessionToken, resultArea, patientId); }
            else { statusBox.className = 'status err'; statusBox.textContent = (data.error && data.error.message) || 'Something went wrong.'; }
          })
          .catch(function () { statusBox.className = 'status err'; statusBox.textContent = 'Could not reach the server.'; });
      });
    });
  }

  function loadDigitalTwinForPatient_(sessionToken, resultArea, patientId) {
    resultArea.innerHTML = '<div class="skeleton"></div>';
    fetch(WEB_APP_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_patient_digital_twin', session_token: sessionToken, patient_id: patientId })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status !== 'ok' || !data.data) {
          resultArea.innerHTML = '<p class="empty-text">Could not load the Digital Twin. Check your connection and reload the page.</p>';
          return;
        }
        resultArea.innerHTML = digitalTwinResultHtml_(data.data);
        wireDigitalTwinControls_(sessionToken, resultArea, patientId);
      })
      .catch(function () {
        resultArea.innerHTML = '<p class="empty-text">Could not load the Digital Twin. Check your connection and reload the page.</p>';
      });
  }

  function loadDigitalTwinReviewCard(sessionToken, capabilityKey) {
    var body = document.getElementById('card-' + capabilityKey + '-body');
    fetch(WEB_APP_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_doctor_patient_roster', session_token: sessionToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status !== 'ok') {
          body.innerHTML = '<p class="empty-text">Could not load your patient roster. Check your connection and reload the page.</p>';
          return;
        }
        body.innerHTML = digitalTwinPatientPickerHtml_(data.data);
        var loadBtn = document.getElementById('dtLoadBtn');
        if (!loadBtn) return;
        loadBtn.addEventListener('click', function () {
          var patientId = document.getElementById('dtPatientSelect').value;
          var resultArea = document.getElementById('dtResultArea');
          if (patientId) loadDigitalTwinForPatient_(sessionToken, resultArea, patientId);
        });
      })
      .catch(function () {
        body.innerHTML = '<p class="empty-text">Could not load your patient roster. Check your connection and reload the page.</p>';
      });
  }

  // Loader-dispatcher registry — one entry per registry data_source, the
  // same discipline my-health-journey/dashboard.js's own MODULE_LOADERS
  // already establishes.
  var CAPABILITY_LOADERS = {
    'get_doctor_patient_roster': loadPatientRosterPreview,
    'get_doctor_appointments': loadAppointmentsPreview,
    'get_inventory_items': loadInventoryPreview,
    'get_pillfill_orders': loadPillFillOrdersPreview,
    'get_doctor_analytics': loadAnalyticsPreview,
    'get_ai_assistant_capabilities': loadAiAssistantCard,
    'get_holoscan_review_queue': loadHoloscanReviewQueue,
    'get_medication_history': loadMedicationHistoryCard,
    'get_patient_milestones': loadMilestoneReviewCard,
    'get_patient_digital_twin': loadDigitalTwinReviewCard
  };

  // Merges the per-doctor state rows from get_doctor_module_states with
  // the local registry: keeps only entries whose enabled === true and
  // whose capability_key is in the registry (fail-closed on both sides —
  // mirrors filterEnabledModules() exactly, applied to the doctor identity
  // space). Sorts by display_order.
  function filterEnabledCapabilities(stateEntries) {
    var enabled = [];
    for (var i = 0; i < stateEntries.length; i++) {
      var state = stateEntries[i];
      if (!state || state.enabled !== true) continue;
      var descriptor = getCapabilityDescriptor(state.capability_key);
      if (!descriptor) continue;
      enabled.push({ descriptor: descriptor, state: state });
    }
    enabled.sort(function (a, b) { return a.descriptor.display_order - b.descriptor.display_order; });
    return enabled;
  }

  // Whole-dashboard empty state: the doctor is authenticated but has no
  // enabled capabilities (the intentional "registry-driven visibility"
  // outcome, mirroring my-health-journey/dashboard.js's own
  // dashboardEmptyStateHtml(), not an error).
  function dashboardEmptyStateHtml() {
    return '<div class="card dash-card" style="grid-column:1/-1" id="dashEmptyState">' +
      '<p class="empty-text">No dashboard capabilities are enabled for your account yet. Contact your administrator to enable capabilities relevant to your work — you\'ll see them here once they do.</p>' +
      '</div>';
  }

  // Zero-line-per-card: renderDashboard() never learns about any specific
  // capability_key. Every card that appears is one whose registry entry
  // exists and whose DoctorModuleState.enabled === true.
  function renderDashboard(doctor, enabledCapabilities) {
    greeting.textContent = 'Hi, ' + doctor.full_name;
    grid.setAttribute('aria-busy', 'false');
    if (!enabledCapabilities.length) {
      grid.innerHTML = dashboardEmptyStateHtml();
      return;
    }
    var html = '';
    for (var i = 0; i < enabledCapabilities.length; i++) {
      var d = enabledCapabilities[i].descriptor;
      html += cardHtml(d.capability_key, d.display_name, '<div class="skeleton"></div><div class="skeleton"></div>');
    }
    grid.innerHTML = html;
  }

  function dispatchLoaders(sessionToken, enabledCapabilities) {
    for (var i = 0; i < enabledCapabilities.length; i++) {
      var d = enabledCapabilities[i].descriptor;
      var loader = CAPABILITY_LOADERS[d.data_source];
      if (!loader) {
        // Registry declares a data_source we have no loader for — leave
        // the card skeleton in place rather than crash, mirroring
        // my-health-journey/dashboard.js's own dispatchLoaders() exactly.
        if (window.console && console.warn) {
          console.warn('WiseDoctorDashboard: no loader registered for data_source "' + d.data_source +
            '" (capability_key "' + d.capability_key + '") — card left as skeleton.');
        }
        continue;
      }
      loader(sessionToken, d.capability_key);
    }
  }

  var token = window.sessionStorage.getItem(SESSION_KEY);
  if (!token) {
    goToLogin();
    return;
  }

  // Two calls in parallel: get_doctor_profile (the header greeting) and
  // get_doctor_module_states (WPI-3, the per-doctor enablement rows this
  // registry-driven consumer needs) — mirrors
  // my-health-journey/dashboard.js's own get_profile/get_patient_module_states
  // parallel-call pattern exactly, for the doctor identity space.
  Promise.all([
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_doctor_profile', session_token: token })
    }).then(function (response) { return response.json(); }),
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'get_doctor_module_states', session_token: token })
    }).then(function (response) { return response.json(); })
  ])
    .then(function (results) {
      var profileEnv = results[0];
      var statesEnv = results[1];
      if (profileEnv.status !== 'ok' || statesEnv.status !== 'ok') {
        goToLogin('expired');
        return;
      }
      var stateEntries = Array.isArray(statesEnv.data) ? statesEnv.data : [];
      var enabled = filterEnabledCapabilities(stateEntries);
      renderDashboard(profileEnv.data, enabled);
      dispatchLoaders(token, enabled);
    })
    .catch(function () {
      // A network failure is not a session failure — keep the token and
      // let the doctor retry, rather than forcing a re-login on a
      // connectivity blip (docs/04 Error State), mirroring
      // my-health-journey/dashboard.js's own catch handler exactly.
      grid.setAttribute('aria-busy', 'false');
      grid.innerHTML = '<div class="card dash-card" style="grid-column:1/-1"><p class="sub" style="text-align:left;margin-bottom:0">Could not reach the server. Check your connection and reload the page.</p></div>';
    });

  // Explicit, minimal test-support surface — exposes the pure formatting
  // functions plus the registry-consumer helpers so
  // validation/wpi-4-doctor-dashboard/browser-test.js can exercise the
  // real code directly rather than re-implementing this logic in the test,
  // mirroring window.WiseDashboard's own precedent.
  window.WiseDoctorDashboard = {
    emptyStateHtml: emptyStateHtml,
    cardHtml: cardHtml,
    EMPTY_STATE_BADGES: EMPTY_STATE_BADGES,
    DOCTOR_MODULE_REGISTRY: DOCTOR_MODULE_REGISTRY,
    getCapabilityDescriptor: getCapabilityDescriptor,
    filterEnabledCapabilities: filterEnabledCapabilities,
    dashboardEmptyStateHtml: dashboardEmptyStateHtml,
    patientRosterHtml: patientRosterHtml,
    appointmentsHtml: appointmentsHtml,
    inventoryHtml: inventoryHtml,
    pillFillOrdersHtml: pillFillOrdersHtml,
    analyticsHtml: analyticsHtml,
    aiAssistantPickerHtml: aiAssistantPickerHtml,
    aiAssistantDraftHtml: aiAssistantDraftHtml,
    holoscanReviewQueueHtml: holoscanReviewQueueHtml,
    medicationHistoryListHtml: medicationHistoryListHtml_,
    medicationHistoryPatientPickerHtml: medicationHistoryPatientPickerHtml_,
    milestonePatientPickerHtml: milestonePatientPickerHtml_,
    milestoneResultHtml: milestoneResultHtml_,
    milestonePointBlockHtml: milestonePointBlockHtml_,
    milestoneAnchorFormHtml: milestoneAnchorFormHtml_,
    digitalTwinPatientPickerHtml: digitalTwinPatientPickerHtml_,
    digitalTwinResultHtml: digitalTwinResultHtml_,
    digitalTwinNarrativeHtml: digitalTwinNarrativeHtml_
  };
})();
