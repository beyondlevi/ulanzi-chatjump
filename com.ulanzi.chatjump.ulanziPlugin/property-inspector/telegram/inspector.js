const ACTION_UUID = 'com.ulanzi.ulanzistudio.chatjump.telegram';

let form;
let tgDialogs = [];
let tgSession = '';

$UD.connect(ACTION_UUID);

$UD.onConnected(() => {
  form = document.querySelector('#property-inspector');
  document.querySelector('.uspi-wrapper').classList.remove('hidden');

  form.addEventListener('input', Utils.debounce(() => { toggleRows(); save(); }));
  document.querySelector('#target').addEventListener('change', () => { toggleRows(); save(); });
  document.querySelector('#pickPhoto').addEventListener('click', () => {
    $UD.selectFileDialog('image(*.png *.jpg *.jpeg *.gif)');
  });

  initTelegramImport();
  $UD.getGlobalSettings();
  toggleRows();
});

$UD.onAdd((jsn) => { if (jsn?.param) restore(jsn.param); });
$UD.onParamFromApp((jsn) => { if (jsn?.param) restore(jsn.param); });

$UD.onSelectdialog((jsn) => {
  if (jsn?.path) {
    form.querySelector('[name="iconPath"]').value = jsn.path;
    updatePhotoLabel(jsn.path);
    save();
  }
});

// Telegram credentials + session live in global settings (shared by all keys).
$UD.onDidReceiveGlobalSettings((jsn) => {
  const gs = (jsn && (jsn.settings || jsn.payload || jsn.param)) || {};
  setVal('tg-apiid', gs.tgApiId);
  setVal('tg-apihash', gs.tgApiHash);
  setVal('tg-phone', gs.tgPhone);
  tgSession = gs.tgSession || '';
});

// Replies from the main service.
$UD.onSendToPropertyInspector((jsn) => {
  const p = jsn && jsn.payload;
  if (!p || p.cmd !== 'tgResult') return;
  if (p.op === 'login') handleLogin(p);
  else if (p.op === 'list') {
    if (!p.ok) return setStatus(p.error, false);
    tgDialogs = p.contacts || [];
    setStatus(`${tgDialogs.length} conversas`, true);
    document.getElementById('tg-search').classList.remove('cj-hidden');
    renderDialogs('');
  } else if (p.op === 'pick') {
    if (!p.ok) return setStatus(p.error, false);
    applyPicked(p);
  } else if (p.op === 'status') {
    if (p.connected) { setStatus(`${$UD.t('Connected as')} ${p.name}`, true); showImport(true); }
  }
});

function initTelegramImport() {
  document.getElementById('tg-search').placeholder = $UD.t('Search contacts...');
  ['tg-apiid', 'tg-apihash', 'tg-phone'].forEach((id) => {
    document.getElementById(id).addEventListener('input', Utils.debounce(saveGlobal));
  });
  document.getElementById('tg-connect').addEventListener('click', () => {
    setStatus($UD.t('Connecting...'), true);
    hide('tg-code-row'); hide('tg-pass-row');
    $UD.sendToPlugin({ cmd: 'tg', op: 'login', config: tgConfig() });
  });
  document.getElementById('tg-code-btn').addEventListener('click', () => {
    $UD.sendToPlugin({ cmd: 'tg', op: 'code', code: val('tg-code') });
    setStatus($UD.t('Checking code...'), true);
  });
  document.getElementById('tg-pass-btn').addEventListener('click', () => {
    $UD.sendToPlugin({ cmd: 'tg', op: 'password', password: val('tg-pass') });
    setStatus($UD.t('Checking password...'), true);
  });
  document.getElementById('tg-import').addEventListener('click', () => {
    setStatus($UD.t('Loading contacts...'), true);
    $UD.sendToPlugin({ cmd: 'tg', op: 'list', config: tgConfig() });
  });
  document.getElementById('tg-search').addEventListener('input', (e) => renderDialogs(e.target.value));
}

function handleLogin(p) {
  if (p.ok === false) return setStatus(p.error, false);
  if (p.need === 'code') { show('tg-code-row'); hide('tg-pass-row'); setStatus($UD.t('Enter the code Telegram sent you'), true); return; }
  if (p.need === 'password') { show('tg-pass-row'); setStatus($UD.t('Enter your 2FA password'), true); return; }
  if (p.connected) {
    tgSession = p.session || tgSession;
    saveGlobal(); // persist the new session
    hide('tg-code-row'); hide('tg-pass-row');
    setStatus(`${$UD.t('Connected as')} ${p.name}`, true);
    showImport(true);
  }
}

function tgConfig() {
  return { apiId: val('tg-apiid'), apiHash: val('tg-apihash'), phone: val('tg-phone'), session: tgSession };
}

function saveGlobal() {
  $UD.setGlobalSettings({ tgApiId: val('tg-apiid'), tgApiHash: val('tg-apihash'), tgPhone: val('tg-phone'), tgSession: tgSession });
}

function showImport(on) {
  document.getElementById('tg-import').classList.toggle('cj-hidden', !on);
}

function renderDialogs(query) {
  const q = (query || '').trim().toLowerCase();
  const box = document.getElementById('tg-results');
  const list = q
    ? tgDialogs.filter((c) => c.name.toLowerCase().includes(q) || (c.username || '').toLowerCase().includes(q))
    : tgDialogs;
  box.innerHTML = '';
  const shown = list.slice(0, 200);
  if (!shown.length) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  for (const c of shown) {
    const row = document.createElement('div');
    row.className = 'cj-contact';
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = c.name;
    const sub = document.createElement('span');
    sub.className = 'sub';
    sub.textContent = c.username || c.type;
    row.appendChild(nm);
    row.appendChild(sub);
    row.addEventListener('click', () => pickDialog(c));
    box.appendChild(row);
  }
}

function pickDialog(c) {
  setStatus(`${$UD.t('Fetching...')} ${c.name}`, true);
  $UD.sendToPlugin({ cmd: 'tg', op: 'pick', config: tgConfig(), id: c.id });
}

function applyPicked(p) {
  form.querySelector('[name="contactName"]').value = p.name || '';
  const targetEl = form.querySelector('[name="target"]');
  if (p.target === 'username') { targetEl.value = 'username'; form.querySelector('[name="username"]').value = p.username || ''; }
  else if (p.target === 'phone') { targetEl.value = 'phone'; form.querySelector('[name="phone"]').value = p.phone || ''; }
  else if (p.target === 'invite') { targetEl.value = 'invite'; form.querySelector('[name="groupLink"]').value = p.groupLink || ''; }
  if (p.iconPath) { form.querySelector('[name="iconPath"]').value = p.iconPath; updatePhotoLabel(p.iconPath); }
  toggleRows();
  save();
  if (p.error) setStatus(p.error, false);
  else setStatus(`${$UD.t('Imported')}: ${p.name}${p.iconPath ? '' : ' (' + $UD.t('no photo') + ')'}`, true);
  document.getElementById('tg-results').style.display = 'none';
}

// helpers
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function setVal(id, v) { const el = document.getElementById(id); if (el && v != null) el.value = v; }
function show(id) { document.getElementById(id).classList.remove('cj-hidden'); }
function hide(id) { document.getElementById(id).classList.add('cj-hidden'); }
function setStatus(msg, ok) { const el = document.getElementById('tg-status'); if (!el) return; el.textContent = msg || ''; el.style.color = ok ? '#8bd48b' : '#e88'; }

function save() { $UD.sendParamFromPlugin(Utils.getFormValue(form)); }

function restore(param) {
  Utils.setFormValue(param, form);
  updatePhotoLabel(param.iconPath || '');
  toggleRows();
}

function toggleRows() {
  const target = form.querySelector('[name="target"]').value || 'username';
  document.querySelector('#row-username').classList.toggle('hidden', target !== 'username');
  document.querySelector('#row-phone').classList.toggle('hidden', target !== 'phone');
  document.querySelector('#row-invite').classList.toggle('hidden', target !== 'invite');
}

function updatePhotoLabel(path) {
  const el = document.querySelector('#photoPath');
  if (!el) return;
  el.textContent = path ? path.split(/[\\/]/).pop() : '';
}
