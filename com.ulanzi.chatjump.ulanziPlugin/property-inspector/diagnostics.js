/**
 * ChatJump - Property Inspector diagnostics panel.
 *
 * Shows the plugin version and the main service's recent log lines (including
 * exactly why a key did or didn't get its app badge). Talks to the main
 * service over the standard PI<->plugin channel:
 *   PI  -> main : sendToPlugin({ cmd: 'getLogs' })
 *   main -> PI  : sendToPropertyInspector({ cmd: 'logs', version, lines })
 */
(function () {
  function box() { return document.querySelector('#cj-logs'); }

  // Receive logs from the main service.
  $UD.onSendToPropertyInspector((jsn) => {
    const p = jsn && jsn.payload;
    if (!p || p.cmd !== 'logs') return;
    const verEl = document.querySelector('#cj-version');
    if (verEl && p.version) verEl.textContent = 'v' + p.version;
    const el = box();
    if (!el) return;
    el.textContent = p.lines && p.lines.length
      ? p.lines.join('\n')
      : '(no diagnostics yet - pick a contact photo to generate them)';
    el.scrollTop = el.scrollHeight;
  });

  // Ask the main service for the latest logs.
  window.cjFetchLogs = function () {
    try { $UD.sendToPlugin({ cmd: 'getLogs' }); } catch (e) { /* not connected yet */ }
  };

  window.addEventListener('DOMContentLoaded', () => {
    const btn = document.querySelector('#cj-refresh');
    if (btn) btn.addEventListener('click', window.cjFetchLogs);
    // The PI learns its key/actionid a moment after connecting, so poll a few
    // times until the round-trip can reach the main service.
    [400, 1200, 2500].forEach((ms) => setTimeout(window.cjFetchLogs, ms));
  });
})();
