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

  // Schema 1.1.0's is_minor enum, mirrored exactly.
  var MINOR_OPTIONS = [
    { value: '', label: '— Not stated —' },
    { value: 'no', label: 'No — 18 or over' },
    { value: 'yes', label: 'Yes — under 18' }
  ];

  function minorOptionsHtml(selected) {
    return MINOR_OPTIONS.map(function (option) {
      var isSelected = option.value === (selected || '') ? ' selected' : '';
      return '<option value="' + option.value + '"' + isSelected + '>' + option.label + '</option>';
    }).join('');
  }

  /**
   * Renders the guardian-consent state from guardian_consent_at ALONE.
   * That field is server-set and only ever non-empty once the backend has
   * actually persisted the consent, so this can never claim consent is on
   * file when it is not. Nothing here is derived from what the patient
   * just typed or from a successful-looking HTTP response.
   */
  var CONSENT_RECORDED_STYLE = 'font-size:13px;color:#1B3463;background:#F4F7FB;border:1px solid #E7EBF1;' +
    'border-left:3px solid #27498C;border-radius:8px;padding:10px 12px;margin:0 0 14px';
  var CONSENT_MISSING_STYLE = 'font-size:13px;color:#0B0B0B;background:#FFF6F7;border:1px solid #F3CBD3;' +
    'border-left:3px solid #D62E4D;border-radius:8px;padding:10px 12px;margin:0 0 14px';

  function guardianConsentStatusHtml(profile) {
    var recordedAt = profile.guardian_consent_at ? String(profile.guardian_consent_at) : '';
    if (recordedAt) {
      return '<p class="pf-consent-state" id="pfConsentState" data-recorded-at="' + escapeHtmlForDisplay(recordedAt) +
        '" style="' + CONSENT_RECORDED_STYLE + '">Guardian consent recorded on ' +
        escapeHtmlForDisplay(recordedAt.slice(0, 10)) + '.</p>';
    }
    return '<p class="pf-consent-state" id="pfConsentState" data-recorded-at="" style="' + CONSENT_MISSING_STYLE + '">' +
      '<strong>Guardian consent not yet recorded.</strong> Complete the guardian details below and save.</p>';
  }

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
      '<div class="field"><label for="pfIsMinor">Is this patient under 18?</label>' +
      '<select id="pfIsMinor">' + minorOptionsHtml(profile.is_minor) + '</select></div>' +
      '<div id="pfGuardianBlock" hidden>' +
        guardianConsentStatusHtml(profile) +
        '<div class="field"><label for="pfGuardianName">Parent or legal guardian&rsquo;s full name</label>' +
        '<input id="pfGuardianName" type="text" value="' + escapeHtmlForDisplay(profile.guardian_name) + '" maxlength="120"></div>' +
        '<div class="field"><label for="pfGuardianRelationship">Their relationship to the patient</label>' +
        '<input id="pfGuardianRelationship" type="text" value="' + escapeHtmlForDisplay(profile.guardian_relationship) + '" maxlength="60" placeholder="e.g. mother, father, legal guardian"></div>' +
        '<div class="consent" style="display:flex;align-items:flex-start;gap:10px;background:var(--color-surface);' +
        'border:1px solid var(--color-line);border-radius:12px;padding:14px 16px;margin:0 0 18px">' +
        '<input type="checkbox" id="pfGuardianConsent" style="width:auto;flex:none;margin-top:3px">' +
        '<label for="pfGuardianConsent" style="font-size:13.5px;font-weight:500;line-height:1.5">I am this patient&rsquo;s ' +
        'parent or legal guardian, and I consent to Wise Homeopathy providing care to them and handling their health ' +
        'information as described in the <a href="../../patient-privacy.html" target="_blank" rel="noopener">Patient ' +
        'Portal Privacy Policy</a>.</label></div>' +
      '</div>' +
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
    var isMinorSelect = document.getElementById('pfIsMinor');
    var guardianBlock = document.getElementById('pfGuardianBlock');
    var guardianName = document.getElementById('pfGuardianName');
    var guardianRelationship = document.getElementById('pfGuardianRelationship');
    var guardianConsent = document.getElementById('pfGuardianConsent');

    // The guardian block is shown, and its fields become required, only for a
    // declared minor. Adults never see it and are entirely unaffected. The
    // server enforces the same rule regardless of what the browser does.
    function syncGuardian() {
      var isMinor = isMinorSelect.value === 'yes';
      guardianBlock.hidden = !isMinor;
      guardianName.required = isMinor;
      guardianRelationship.required = isMinor;
      // Consent is re-affirmed only when it is not already on file; an
      // already-recorded consent is never silently re-collected.
      // "Already recorded" is read from the PERSISTED timestamp the server
      // returned, carried on data-recorded-at — never inferred from what the
      // patient just typed, and never from a style lookup.
      var consentState = document.getElementById('pfConsentState');
      var alreadyRecorded = !!(consentState && consentState.getAttribute('data-recorded-at'));
      guardianConsent.required = isMinor && !alreadyRecorded;
    }
    isMinorSelect.addEventListener('change', syncGuardian);
    syncGuardian();

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submitBtn.disabled = true;
      statusBox.className = 'status loading';
      statusBox.textContent = 'Saving…';

      WiseSessionGuard.callFoundation('save_patient_profile', {
        phone: document.getElementById('pfPhone').value,
        date_of_birth: document.getElementById('pfDob').value,
        preferred_contact_method: document.getElementById('pfContactMethod').value,
        emergency_contact: document.getElementById('pfEmergencyContact').value,
        is_minor: isMinorSelect.value,
        guardian_name: guardianName.value,
        guardian_relationship: guardianRelationship.value,
        guardian_consent: guardianConsent.checked === true
      })
        .then(function (data) {
          submitBtn.disabled = false;
          if (data.status === 'ok') {
            statusBox.className = 'status ok';
            statusBox.textContent = 'Saved. Thank you.';
            // Re-render from the PERSISTED record the server returned, so the
            // consent state on screen is whatever was actually stored — never
            // an optimistic echo of what was typed.
            if (data.data) {
              content.innerHTML = profileFormHtml(data.data);
              wireProfileForm(sessionToken);
              var freshStatus = document.getElementById('pfStatus');
              freshStatus.className = 'status ok';
              freshStatus.textContent = 'Saved. Thank you.';
            }
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
