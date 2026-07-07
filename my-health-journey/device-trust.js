/**
 * Trusted Device client helper — Batch PXP-8 (docs/44-PHASE-2B-TECHNICAL-
 * PLAN.md §5, §22; docs/47-PHASE-2B-IMPLEMENTATION-RULES.md), ADR-015.
 *
 * A new, non-frozen file, deliberately kept independent of both
 * my-health-journey/dashboard.js and my-health-journey/session-guard.js —
 * dashboard.js's own header comment already documents that it stays
 * self-contained and does not depend on session-guard.js; this file
 * preserves that property rather than introducing a new dependency
 * between the two. Both consume this file's small, shared surface via
 * their own additive, minimal, disclosed touch (see each file's own
 * header comment for the exact, small diff and its justification per
 * docs/47 §6).
 *
 * Holds the *only* localStorage-writing code this batch adds. The Session
 * token itself continues to live exclusively in sessionStorage, cleared on
 * tab close (docs/29 §3, completely unchanged by this batch) — what makes
 * "persistent login" persistent is this file's own separate device token,
 * stored under DEVICE_TOKEN_KEY. See shared/schemas/trusted-device.md's
 * "Where each token lives" for the full reasoning.
 */
(function (global) {
  'use strict';

  var SESSION_KEY = 'wise_session_token';
  var DEVICE_TOKEN_KEY = 'wise_trusted_device_token';

  function getDeviceToken() {
    try {
      return window.localStorage.getItem(DEVICE_TOKEN_KEY);
    } catch (err) {
      // Private-browsing modes / storage-disabled environments can throw on
      // localStorage access — treated as "no device token," the same
      // fail-closed posture as never having trusted a device at all, never
      // a crash (docs/04 Error State).
      return null;
    }
  }

  function setDeviceToken(token) {
    try {
      window.localStorage.setItem(DEVICE_TOKEN_KEY, token);
    } catch (err) {
      // See getDeviceToken()'s own comment — a write failure here just
      // means this device won't stay trusted across a restart; it never
      // blocks the sign-in the patient is actually completing right now.
    }
  }

  function clearDeviceToken() {
    try {
      window.localStorage.removeItem(DEVICE_TOKEN_KEY);
    } catch (err) {
      // See getDeviceToken()'s own comment.
    }
  }

  /**
   * Marks the current device as trusted, given an already-established
   * session token (called only right after a successful magic-link
   * consume — verify.html's own opt-in checkbox). Stores the returned raw
   * device token in localStorage on success. Never throws — a failure here
   * (network, or a genuinely unexpected server error) just means the
   * device isn't trusted; the patient's own magic-link sign-in already
   * succeeded regardless (this call never blocks or reverses it).
   */
  function markDeviceTrusted(webAppUrl, sessionToken, deviceLabel) {
    return fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        foundation_action: 'mark_device_trusted',
        session_token: sessionToken,
        device_label: deviceLabel || ''
      })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status === 'ok') {
          setDeviceToken(data.data.device_token);
        }
        return data;
      })
      .catch(function () {
        // Silent — see this function's own header comment.
        return null;
      });
  }

  /**
   * Attempts a silent sign-in via a locally-stored trusted device token —
   * this batch's own "session renewal" mechanic (shared/schemas/
   * trusted-device.md), tried only when no valid Session token is already
   * present. Resolves the new Session token on success (also storing it in
   * sessionStorage and rotating the stored device token), or null on any
   * failure (no device token stored, an invalid/expired/revoked device
   * token, or a network error) — null always means "fall back to the
   * normal magic-link login flow," never a distinguishable reason, the
   * same anti-enumeration-style generic-rejection discipline
   * consume_trusted_device's own backend implementation already applies.
   */
  function attemptTrustedDeviceLogin(webAppUrl) {
    var deviceToken = getDeviceToken();
    if (!deviceToken) {
      return Promise.resolve(null);
    }
    return fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ foundation_action: 'consume_trusted_device', device_token: deviceToken })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status === 'ok') {
          window.sessionStorage.setItem(SESSION_KEY, data.data.session_token);
          setDeviceToken(data.data.device_token);
          return data.data.session_token;
        }
        // Rejected (unknown/expired/revoked) — the stale local token is
        // worthless from here on, so it's cleared rather than retried
        // forever on every future page load.
        clearDeviceToken();
        return null;
      })
      .catch(function () {
        // A network failure is not a rejection — the stored device token
        // may still be perfectly valid, so it's deliberately kept (mirrors
        // session-guard.js's own onNetworkError discipline: never discard
        // a credential just because a request failed to complete).
        return null;
      });
  }

  global.WiseDeviceTrust = {
    getDeviceToken: getDeviceToken,
    setDeviceToken: setDeviceToken,
    clearDeviceToken: clearDeviceToken,
    markDeviceTrusted: markDeviceTrusted,
    attemptTrustedDeviceLogin: attemptTrustedDeviceLogin
  };
})(window);
