/**
 * Shared authenticated-page session guard for Phase 2A patient-facing
 * pages beyond the dashboard shell — docs/39-CONSULTATION-TIMELINE-READINESS-REVIEW.md
 * §7's "ripe for extraction" recommendation, first acted on in Batch PA-3
 * now that a second and third authenticated page (Timeline list, Timeline
 * detail) actually exist to reuse it.
 *
 * Deliberately does NOT touch my-health-journey/dashboard.js. That file is
 * part of the frozen PA-2 surface (docs/38-PATIENT-ACCESS-DASHBOARD-SHELL-CLOSEOUT.md)
 * and, per this session's explicit instruction, frozen components are not
 * modified except for bug fixes — its own session-guard logic stays
 * self-contained and unchanged. This module is new code, consumed only by
 * the new pages this batch adds.
 *
 * Mirrors dashboard.js's own session-guard behavior exactly (same
 * WEB_APP_URL, same sessionStorage key, same get_profile-verify-or-redirect
 * flow, same generic session-expiry message trigger) so the two
 * implementations stay behaviorally identical even though they are not the
 * same file.
 */
(function (global) {
  'use strict';

  var WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwrAx9jPnji2U-ngBpYTtV2p_SJnnFrYa7fKYo589zeVfRrwuz3N5aIS0xeiQeuFvMhIQ/exec';
  var SESSION_KEY = 'wise_session_token';

  function getToken() {
    return window.sessionStorage.getItem(SESSION_KEY);
  }

  function goToLogin(reason) {
    window.sessionStorage.removeItem(SESSION_KEY);
    window.location.href = '../../login.html' + (reason ? '?reason=' + reason : '');
  }

  function callFoundation(action, extraFields) {
    var body = { foundation_action: action, session_token: getToken() };
    if (extraFields) {
      Object.keys(extraFields).forEach(function (key) { body[key] = extraFields[key]; });
    }
    return fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (response) { return response.json(); });
  }

  /**
   * Verifies the stored session via get_profile before calling
   * `onReady(profile)`. An absent token redirects to /login.html silently
   * (never having logged in isn't a privacy event). A present-but-rejected
   * token redirects to /login.html?reason=expired, clearing the stale
   * token first — login.html shows the approved generic message for this
   * (docs/38 §4). A network failure (the call itself failing, distinct
   * from a rejected session) calls `onNetworkError` instead of redirecting
   * — the token is kept so the patient can retry.
   */
  function requireSession(handlers) {
    var token = getToken();
    if (!token) {
      goToLogin();
      return;
    }
    callFoundation('get_profile')
      .then(function (data) {
        if (data.status === 'ok') {
          handlers.onReady(data.data, token);
        } else {
          goToLogin('expired');
        }
      })
      .catch(function () {
        if (handlers.onNetworkError) handlers.onNetworkError();
      });
  }

  function wireSignOut(buttonId) {
    var btn = document.getElementById(buttonId);
    if (btn) {
      btn.addEventListener('click', function () { goToLogin(); });
    }
  }

  global.WiseSessionGuard = {
    requireSession: requireSession,
    callFoundation: callFoundation,
    wireSignOut: wireSignOut,
    goToLogin: goToLogin
  };
})(window);
