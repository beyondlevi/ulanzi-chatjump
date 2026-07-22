/**
 * ChatJump - main service (HTML)
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
 */

const MAIN_UUID = 'com.ulanzi.ulanzistudio.chatjump';

const ACTION_CACHES = {};

$UD.connect(MAIN_UUID);
$UD.onConnected(() => {});

$UD.onAdd((jsn) => {
  const ctx = jsn.context;
  if (!ACTION_CACHES[ctx]) ACTION_CACHES[ctx] = new ChatContact(ctx);
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

function applySettings(jsn) {
  const inst = ACTION_CACHES[jsn.context];
  const settings = jsn.param || {};
  if (!inst || JSON.stringify(settings) === '{}') return;
  inst.update(settings);
}

class ChatContact {
  constructor(context) {
    this.context = context;
    this.settings = {};
    // Derive the app from the action UUID (last segment: whatsapp | telegram).
    let uuid = MAIN_UUID;
    try {
      uuid = $UD.decodeContext(context).uuid || MAIN_UUID;
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
      $UD.setPathIcon(this.context, this.settings.iconPath, label);
    } else {
      // No custom photo yet: keep the default action icon, overlay the name.
      $UD.setStateIcon(this.context, 0, label);
    }
  }

  open() {
    const link = this.buildLink();
    if (!link) {
      $UD.showAlert(this.context);
      $UD.toast('ChatJump: set a phone number or username in the settings first.');
      return;
    }
    // Custom URI scheme -> handed to the OS default handler (not a local file).
    $UD.openUrl(link.url, false, link.param);
  }

  buildLink() {
    if (this.app === 'whatsapp') return this.buildWhatsApp();
    if (this.app === 'telegram') return this.buildTelegram();
    return null;
  }

  buildWhatsApp() {
    const phone = digitsOnly(this.settings.phone);
    if (!phone) return null;
    // whatsapp://send?phone=<international number, digits only>
    return { url: 'whatsapp://send', param: { phone } };
  }

  buildTelegram() {
    const target = this.settings.target || 'username';
    if (target === 'phone') {
      const phone = digitsOnly(this.settings.phone);
      if (!phone) return null;
      // tg://resolve?phone=<digits> (no leading +)
      return { url: 'tg://resolve', param: { phone } };
    }
    const domain = (this.settings.username || '').trim().replace(/^@/, '');
    if (!domain) return null;
    // tg://resolve?domain=<username>
    return { url: 'tg://resolve', param: { domain } };
  }
}

function digitsOnly(value) {
  return (value || '').toString().replace(/\D/g, '');
}
