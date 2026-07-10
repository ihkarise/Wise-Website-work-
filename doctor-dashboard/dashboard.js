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
  var DOCTOR_MODULE_REGISTRY = [
    { capability_key: 'patient_roster', display_name: 'Patient Roster', display_order: 10, empty_state: 'nodata', data_source: 'get_doctor_patient_roster' },
    { capability_key: 'appointments', display_name: 'Appointments', display_order: 20, empty_state: 'nodata', data_source: 'get_doctor_appointments' },
    { capability_key: 'inventory', display_name: 'Inventory', display_order: 30, empty_state: 'nodata', data_source: 'get_inventory_items' },
    { capability_key: 'pillfill_orders', display_name: 'PillFill Orders', display_order: 40, empty_state: 'nodata', data_source: 'get_pillfill_orders' },
    { capability_key: 'analytics', display_name: 'Analytics', display_order: 50, empty_state: 'nodata', data_source: 'get_doctor_analytics' }
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

  // Loader-dispatcher registry — one entry per registry data_source, the
  // same discipline my-health-journey/dashboard.js's own MODULE_LOADERS
  // already establishes.
  var CAPABILITY_LOADERS = {
    'get_doctor_patient_roster': loadPatientRosterPreview,
    'get_doctor_appointments': loadAppointmentsPreview,
    'get_inventory_items': loadInventoryPreview,
    'get_pillfill_orders': loadPillFillOrdersPreview,
    'get_doctor_analytics': loadAnalyticsPreview
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
    analyticsHtml: analyticsHtml
  };
})();
