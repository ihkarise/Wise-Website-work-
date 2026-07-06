(function () {
  var content = document.getElementById('pfContent');
  var greeting = document.getElementById('greeting');

  WiseSessionGuard.wireSignOut('signOutBtn');

  // Batch PXP-1's own canonical contact-method options, mirroring
  // shared/schemas/patient-profile.schema.json's enum exactly.
  var CONTACT_METHOD_OPTIONS = [
    { value: '', label: '— None —' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone call' },
    { value: 'sms', label: 'Text message (SMS)' }
  ];

  function contactMethodOptionsHtml(selected) {
    return CONTACT_METHOD_OPTIONS.map(function (option) {
      var isSelected = option.value === (selected || '') ? ' selected' : '';
      return '<option value="' + option.value + '"' + isSelected + '>' + option.label + '</option>';
    }).join('');
  }

  // The only form on this page — pre-filled from get_patient_profile's
  // result (including the lazy-created, all-empty default for a patient's
  // first visit, shared/schemas/patient-profile.md). Unlike
  // dashboard.js's symptomFormHtml() (a create-only append form), this is
  // a genuine edit-in-place form — submitting it never clears the fields
  // on success (docs/47 §3: this batch's own upsert semantics).
  function profileFormHtml(profile) {
    return '<form id="profileForm">' +
      '<div class="field"><label for="pfPhone">Phone</label>' +
      '<input id="pfPhone" type="tel" value="' + escapeHtmlForDisplay(profile.phone) + '" placeholder="e.g. +1 555 123 4567"></div>' +
      '<div class="field"><label for="pfDob">Date of birth</label>' +
      '<input id="pfDob" type="date" value="' + escapeHtmlForDisplay(profile.date_of_birth) + '"></div>' +
      '<div class="field"><label for="pfContactMethod">Preferred contact method</label>' +
      '<select id="pfContactMethod">' + contactMethodOptionsHtml(profile.preferred_contact_method) + '</select></div>' +
      '<div class="field"><label for="pfEmergencyContact">Emergency contact (name and phone number)</label>' +
      '<input id="pfEmergencyContact" type="text" value="' + escapeHtmlForDisplay(profile.emergency_contact) + '" maxlength="200" placeholder="e.g. Jane Doe, +1 555 000 1111"></div>' +
      '<button class="submit" type="submit" id="pfSubmitBtn">Save profile</button>' +
      '<div class="status" id="pfStatus" role="status" aria-live="polite"></div>' +
      '</form>';
  }

  function escapeHtmlForDisplay(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderError() {
    content.innerHTML = '<div class="card" style="max-width:560px"><p style="font-size:14px;color:var(--color-text-secondary);margin:0">Could not load your profile. Check your connection and reload the page.</p></div>';
  }

  // Submission feedback via the existing .status/role=status/aria-live
  // component (the same pattern dashboard.js's wireSymptomForm()
  // already established). Unlike that append-only form, a successful
  // save here never resets the fields — it is an edit-in-place record,
  // not a log entry to clear for the next one (docs/47 §3).
  function wireProfileForm(sessionToken) {
    var form = document.getElementById('profileForm');
    var submitBtn = document.getElementById('pfSubmitBtn');
    var statusBox = document.getElementById('pfStatus');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submitBtn.disabled = true;
      statusBox.className = 'status loading';
      statusBox.textContent = 'Saving…';

      WiseSessionGuard.callFoundation('save_patient_profile', {
        phone: document.getElementById('pfPhone').value,
        date_of_birth: document.getElementById('pfDob').value,
        preferred_contact_method: document.getElementById('pfContactMethod').value,
        emergency_contact: document.getElementById('pfEmergencyContact').value
      })
        .then(function (data) {
          submitBtn.disabled = false;
          if (data.status === 'ok') {
            statusBox.className = 'status ok';
            statusBox.textContent = 'Saved. Thank you.';
          } else {
            statusBox.className = 'status err';
            statusBox.textContent = (data.error && data.error.message) || 'Something went wrong. Please try again.';
          }
        })
        .catch(function () {
          // A network failure keeps the patient's in-progress values in
          // place — the same discipline wireSymptomForm()/wireReportForm()
          // already apply to theirs (docs/04 Error State).
          submitBtn.disabled = false;
          statusBox.className = 'status err';
          statusBox.textContent = 'Could not reach the server. Check your connection and try again.';
        });
    });
  }

  WiseSessionGuard.requireSession({
    onReady: function (profile, token) {
      greeting.textContent = 'Hi, ' + profile.full_name;
      WiseSessionGuard.callFoundation('get_patient_profile')
        .then(function (data) {
          content.setAttribute('aria-busy', 'false');
          if (data.status === 'ok') {
            content.innerHTML = profileFormHtml(data.data);
            wireProfileForm(token);
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
  window.WiseProfile = {
    profileFormHtml: profileFormHtml,
    contactMethodOptionsHtml: contactMethodOptionsHtml,
    CONTACT_METHOD_OPTIONS: CONTACT_METHOD_OPTIONS
  };
})();
