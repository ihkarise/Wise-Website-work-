(function () {
  var content = document.getElementById('dvContent');
  var greeting = document.getElementById('greeting');

  WiseSessionGuard.wireSignOut('signOutBtn');

  function escapeHtmlForDisplay(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(isoString) {
    return isoString ? escapeHtmlForDisplay(String(isoString).slice(0, 10)) : 'Never';
  }

  // Bare list, newest-created first (already the order
  // foundationGetPatientTrustedDevices_() returns) — mirrors every other
  // history-backed page's "no chart, no trend" scope (docs/29 §9).
  function deviceItemHtml(device) {
    var isRevoked = !!device.revoked_at;
    var label = device.device_label ? escapeHtmlForDisplay(device.device_label) : 'Unnamed device';
    var meta = 'Added ' + formatDate(device.created_at) + ' &middot; Last used ' + formatDate(device.last_used_at);
    if (isRevoked) {
      return '<div class="dv-item">' +
        '<div><div class="dv-label dv-revoked">' + label + '</div>' +
        '<div class="dv-meta dv-revoked">' + meta + ' &middot; Revoked ' + formatDate(device.revoked_at) + '</div></div>' +
        '</div>';
    }
    return '<div class="dv-item" data-device-id="' + escapeHtmlForDisplay(device.device_id) + '">' +
      '<div><div class="dv-label">' + label + '</div><div class="dv-meta">' + meta + '</div></div>' +
      '<button class="dv-revoke-btn" type="button" data-device-id="' + escapeHtmlForDisplay(device.device_id) + '">Revoke</button>' +
      '</div>';
  }

  function devicesListHtml(devices) {
    if (!devices.length) {
      return '<div class="card" style="max-width:560px"><p class="empty-text">You have not marked any device as trusted yet. Check "Keep me signed in on this device" the next time you sign in with your email link.</p></div>';
    }
    return '<div class="card" style="max-width:560px;padding-top:4px;padding-bottom:4px">' +
      devices.map(deviceItemHtml).join('') +
      '</div>';
  }

  function renderError() {
    content.innerHTML = '<div class="card" style="max-width:560px"><p style="font-size:14px;color:var(--color-text-secondary);margin:0">Could not load your devices. Check your connection and reload the page.</p></div>';
  }

  function wireRevokeButtons() {
    var buttons = content.querySelectorAll('.dv-revoke-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var deviceId = btn.getAttribute('data-device-id');
        btn.disabled = true;
        btn.textContent = 'Revoking…';
        WiseSessionGuard.callFoundation('revoke_trusted_device', { device_id: deviceId })
          .then(function (data) {
            if (data.status === 'ok') {
              loadDevices();
            } else {
              btn.disabled = false;
              btn.textContent = 'Revoke';
            }
          })
          .catch(function () {
            btn.disabled = false;
            btn.textContent = 'Revoke';
          });
      });
    });
  }

  function loadDevices() {
    WiseSessionGuard.callFoundation('get_trusted_devices')
      .then(function (data) {
        content.setAttribute('aria-busy', 'false');
        if (data.status === 'ok') {
          content.innerHTML = devicesListHtml(data.data);
          wireRevokeButtons();
        } else {
          renderError();
        }
      })
      .catch(function () {
        content.setAttribute('aria-busy', 'false');
        renderError();
      });
  }

  WiseSessionGuard.requireSession({
    onReady: function (profile) {
      greeting.textContent = 'Hi, ' + profile.full_name;
      loadDevices();
    },
    onNetworkError: function () {
      content.setAttribute('aria-busy', 'false');
      renderError();
    }
  });

  // Explicit, minimal test-support surface, mirroring profile.js's own
  // window.WiseProfile convention.
  window.WiseDevices = {
    devicesListHtml: devicesListHtml,
    deviceItemHtml: deviceItemHtml
  };
})();
