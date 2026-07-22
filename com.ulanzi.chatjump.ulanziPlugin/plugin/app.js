/**
 * ChatJump - main service (Node.js)
 *
 * Each key is a shortcut to one specific conversation in a messaging app.
 * Two actions share this main service:
 *   - com.ulanzi.ulanzistudio.chatjump.whatsapp
 *   - com.ulanzi.ulanzistudio.chatjump.telegram
 *
 * The app to open is derived from the action UUID of each key, so the same
 * logic handles both. Settings per key:
 *   { contactName, iconPath, phone }                       // whatsapp
 *   { contactName, iconPath, target, username, phone }     // telegram
 *
 * Why Node (not HTML): opening a chat means launching a custom URI scheme
 * (whatsapp://, tg://) so the OS hands it to the installed desktop app.
 * The host's $UD.openUrl only drives the built-in browser and rewrites
 * custom schemes into http://, so it can never reach the app. Node lets us
 * call the OS URL handler directly via child_process.
 */

import { spawn } from 'node:child_process';
import { UlanziApi } from './plugin-common-node/index.js';
import { composeIconDataUri } from './badge.js';

const MAIN_UUID = 'com.ulanzi.ulanzistudio.chatjump';
const VERSION = '1.0.2';

const $UD = new UlanziApi();
const ACTION_CACHES = {};

// In-memory diagnostics, surfaced to the Property Inspector on request.
const LOG_BUFFER = [];
function pushLog(msg) {
  const line = `${new Date().toISOString().slice(11, 19)} ${msg}`;
  LOG_BUFFER.push(line);
  if (LOG_BUFFER.length > 200) LOG_BUFFER.shift();
  try { $UD.logMessage(`ChatJump ${msg}`, 'info'); } catch (e) { /* ignore */ }
}

$UD.connect(MAIN_UUID);
$UD.onConnected(() => pushLog(`connected v${VERSION} platform=${process.platform} node=${process.version}`));

$UD.onAdd((jsn) => {
  const ctx = jsn.context;
  if (!ACTION_CACHES[ctx]) ACTION_CACHES[ctx] = new ChatContact(ctx, $UD);
  applySettings(jsn);
});

$UD.onRun((jsn) => {
  const inst = ACTION_CACHES[jsn.context];
  if (!inst) return $UD.emit('add', jsn); // auto-recover if not cached yet
  inst.open();
});

$UD.onClear((jsn) => {
  (jsn.param || []).forEach((item) => {
    delete ACTION_CACHES[item.context];
  });
});

$UD.onParamFromApp(applySettings);
$UD.onParamFromPlugin(applySettings);

// Property Inspector asks for diagnostics; reply with version + recent log lines.
$UD.onSendToPlugin((jsn) => {
  const cmd = jsn && jsn.payload && jsn.payload.cmd;
  if (cmd === 'getLogs' && jsn.context) {
    $UD.sendToPropertyInspector({ cmd: 'logs', version: VERSION, lines: LOG_BUFFER.slice(-200) }, jsn.context);
  }
});

function applySettings(jsn) {
  const inst = ACTION_CACHES[jsn.context];
  const settings = jsn.param || {};
  if (!inst || JSON.stringify(settings) === '{}') return;
  inst.update(settings);
}

class ChatContact {
  constructor(context, ud) {
    this.context = context;
    this.$UD = ud;
    this.settings = {};
    // Derive the app from the action UUID (last segment: whatsapp | telegram).
    let uuid = MAIN_UUID;
    try {
      uuid = ud.decodeContext(context).uuid || MAIN_UUID;
    } catch (e) {
      uuid = MAIN_UUID;
    }
    this.app = uuid.split('.').pop(); // "whatsapp" | "telegram"
  }

  update(settings) {
    this.settings = settings || {};
    this.render();
  }

  render() {
    const label = (this.settings.contactName || '').trim();
    if (this.settings.iconPath) {
      // Photo set: overlay the app badge so the messenger stays recognizable.
      let dataUri = null;
      const diag = [];
      try {
        dataUri = composeIconDataUri(this.settings.iconPath, this.app, diag);
      } catch (e) {
        diag.push(`EXCEPTION ${e.message}`);
      }
      pushLog(`[${this.app}] render icon: ${diag.join(' | ')}`);
      if (dataUri) {
        this.$UD.setBaseDataIcon(this.context, dataUri, label);
      } else {
        // Couldn't build a badged icon: show the photo as-is.
        this.$UD.setPathIcon(this.context, this.settings.iconPath, label);
      }
    } else {
      // No custom photo: the default action icon already identifies the app.
      this.$UD.setStateIcon(this.context, 0, label);
    }
  }

  open() {
    const url = this.buildUrl();
    if (!url) {
      pushLog(`[${this.app}] open aborted: missing number/username/invite`);
      this.$UD.showAlert(this.context);
      this.$UD.toast('ChatJump: set a phone number or username in the settings first.');
      return;
    }
    pushLog(`[${this.app}] open ${url}`);
    openExternal(url, (err) => {
      if (err) {
        pushLog(`[${this.app}] open FAILED: ${err.message}`);
        this.$UD.showAlert(this.context);
      }
    });
  }

  buildUrl() {
    if (this.app === 'whatsapp') return this.buildWhatsApp();
    if (this.app === 'telegram') return this.buildTelegram();
    return null;
  }

  buildWhatsApp() {
    const phone = digitsOnly(this.settings.phone);
    if (!phone) return null;
    // whatsapp://send?phone=<international number, digits only>
    return `whatsapp://send?phone=${encodeURIComponent(phone)}`;
  }

  buildTelegram() {
    const target = this.settings.target || 'username';
    if (target === 'phone') {
      const phone = digitsOnly(this.settings.phone);
      if (!phone) return null;
      // tg://resolve?phone=<digits> (no leading +)
      return `tg://resolve?phone=${encodeURIComponent(phone)}`;
    }
    if (target === 'invite') {
      const hash = parseTelegramInvite(this.settings.groupLink);
      if (!hash) return null;
      // tg://join?invite=<hash> — opens the private group; if already a member,
      // Telegram just opens it instead of re-joining.
      return `tg://join?invite=${encodeURIComponent(hash)}`;
    }
    const domain = (this.settings.username || '').trim().replace(/^@/, '');
    if (!domain) return null;
    // tg://resolve?domain=<username> (works for public users, groups, channels)
    return `tg://resolve?domain=${encodeURIComponent(domain)}`;
  }
}

function digitsOnly(value) {
  return (value || '').toString().replace(/\D/g, '');
}

/**
 * Extract the invite hash from any Telegram private-group invite reference:
 *   https://t.me/+AbCdEf...        -> AbCdEf...
 *   https://t.me/joinchat/AbCdEf   -> AbCdEf
 *   tg://join?invite=AbCdEf        -> AbCdEf
 *   +AbCdEf / AbCdEf (raw)         -> AbCdEf
 */
function parseTelegramInvite(input) {
  const s = (input || '').toString().trim();
  if (!s) return null;
  let m = s.match(/joinchat\/([^/?#\s]+)/i);
  if (m) return m[1];
  m = s.match(/[?&]invite=([^&#\s]+)/i);
  if (m) return m[1];
  m = s.match(/t\.me\/\+([^/?#\s]+)/i);
  if (m) return m[1];
  // Raw hash pasted directly (optionally with a leading +).
  const raw = s.replace(/^\+/, '').split(/[?#]/)[0].replace(/\/+$/, '');
  return raw || null;
}

/**
 * Hand a URL (incl. custom URI schemes) to the OS default handler.
 * Args are passed as an array (no shell) so contact data can't be interpreted
 * as shell syntax. On Windows the `start` builtin needs cmd, with an empty
 * title argument before the URL.
 */
function openExternal(url, done) {
  let cmd;
  let args;
  const opts = { windowsHide: true, stdio: 'ignore' };
  switch (process.platform) {
    case 'darwin':
      cmd = 'open';
      args = [url];
      break;
    case 'win32':
      cmd = 'cmd';
      args = ['/c', 'start', '', url];
      break;
    default: // linux and others
      cmd = 'xdg-open';
      args = [url];
      break;
  }
  try {
    const child = spawn(cmd, args, opts);
    child.on('error', (err) => done && done(err));
    child.unref();
  } catch (err) {
    done && done(err);
  }
}
