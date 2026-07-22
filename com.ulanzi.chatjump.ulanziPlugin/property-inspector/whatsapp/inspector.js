const ACTION_UUID = 'com.ulanzi.ulanzistudio.chatjump.whatsapp';

let form;
let evoContacts = [];

$UD.connect(ACTION_UUID);

$UD.onConnected(() => {
  form = document.querySelector('#property-inspector');
  document.querySelector('.uspi-wrapper').classList.remove('hidden');

  form.addEventListener('input', Utils.debounce(() => save()));

  document.querySelector('#pickPhoto').addEventListener('click', () => {
    $UD.selectFileDialog('image(*.png *.jpg *.jpeg *.gif)');
  });

  initEvolution();
  $UD.getGlobalSettings();
});

$UD.onAdd((jsn) => {
  if (jsn?.param) restore(jsn.param);
});

$UD.onParamFromApp((jsn) => {
  if (jsn?.param) restore(jsn.param);
});

// File picker result (manual photo).
$UD.onSelectdialog((jsn) => {
  if (jsn?.path) {
    form.querySelector('[name="iconPath"]').value = jsn.path;
    updatePhotoLabel(jsn.path);
    save();
  }
});

// Evolution config lives in global settings (shared by all ChatJump keys).
$UD.onDidReceiveGlobalSettings((jsn) => {
  const gs = (jsn && (jsn.param || jsn.payload)) || {};
  setVal('evo-server', gs.evoServer);
  setVal('evo-key', gs.evoKey);
  setVal('evo-instance', gs.evoInstance);
});

// Results coming back from the main service.
$UD.onSendToPropertyInspector((jsn) => {
  const p = jsn && jsn.payload;
  if (!p || p.cmd !== 'evoResult') return;
  if (p.op === 'test') {
    setStatus(p.ok ? `OK (${p.state})` : `${p.error}`, p.ok);
  } else if (p.op === 'list') {
    if (!p.ok) return setStatus(p.error, false);
    evoContacts = p.contacts || [];
    setStatus(`${evoContacts.length} contatos`, true);
    document.getElementById('evo-search').classList.remove('cj-hidden');
    renderContacts('');
  } else if (p.op === 'pick') {
    if (!p.ok) return setStatus(p.error, false);
    applyPicked(p);
  }
});

function initEvolution() {
  const search = document.getElementById('evo-search');
  search.placeholder = $UD.t('Search contacts...');
  ['evo-server', 'evo-key', 'evo-instance'].forEach((id) => {
    document.getElementById(id).addEventListener('input', Utils.debounce(saveGlobal));
  });
  document.getElementById('evo-test').addEventListener('click', () => {
    setStatus($UD.t('Testing...'), true);
    $UD.sendToPlugin({ cmd: 'evo', op: 'test', config: evoConfig() });
  });
  document.getElementById('evo-import').addEventListener('click', () => {
    setStatus($UD.t('Loading contacts...'), true);
    $UD.sendToPlugin({ cmd: 'evo', op: 'list', config: evoConfig() });
  });
  search.addEventListener('input', (e) => renderContacts(e.target.value));
}

function evoConfig() {
  return { server: val('evo-server'), apikey: val('evo-key'), instance: val('evo-instance') };
}

function saveGlobal() {
  $UD.setGlobalSettings({ evoServer: val('evo-server'), evoKey: val('evo-key'), evoInstance: val('evo-instance') });
}

function renderContacts(query) {
  const q = (query || '').trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const box = document.getElementById('evo-results');
  const list = q
    ? evoContacts.filter((c) => c.name.toLowerCase().includes(q) || (digits && c.number.includes(digits)))
    : evoContacts;
  box.innerHTML = '';
  const shown = list.slice(0, 200);
  if (!shown.length) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'block';
  for (const c of shown) {
    const row = document.createElement('div');
    row.className = 'cj-contact';
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = c.name;
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = c.number;
    row.appendChild(nm);
    row.appendChild(num);
    row.addEventListener('click', () => pickContact(c));
    box.appendChild(row);
  }
}

function pickContact(c) {
  setStatus(`${$UD.t('Fetching...')} ${c.name}`, true);
  $UD.sendToPlugin({ cmd: 'evo', op: 'pick', config: evoConfig(), number: c.number, name: c.name });
}

function applyPicked(p) {
  form.querySelector('[name="contactName"]').value = p.contactName || '';
  form.querySelector('[name="phone"]').value = p.number || '';
  if (p.iconPath) {
    form.querySelector('[name="iconPath"]').value = p.iconPath;
    updatePhotoLabel(p.iconPath);
  }
  save();
  setStatus(`${$UD.t('Imported')}: ${p.contactName || p.number}${p.iconPath ? '' : ' (' + $UD.t('no photo') + ')'}`, true);
  document.getElementById('evo-results').style.display = 'none';
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el && v != null) el.value = v;
}

function setStatus(msg, ok) {
  const el = document.getElementById('evo-status');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = ok ? '#8bd48b' : '#e88';
}

function save() {
  $UD.sendParamFromPlugin(Utils.getFormValue(form));
}

function restore(param) {
  Utils.setFormValue(param, form);
  updatePhotoLabel(param.iconPath || '');
}

function updatePhotoLabel(path) {
  const el = document.querySelector('#photoPath');
  if (!el) return;
  el.textContent = path ? path.split(/[\\/]/).pop() : '';
}
