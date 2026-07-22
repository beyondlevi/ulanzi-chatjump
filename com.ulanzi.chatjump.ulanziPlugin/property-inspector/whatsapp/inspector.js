const ACTION_UUID = 'com.ulanzi.ulanzistudio.chatjump.whatsapp';

let form;

$UD.connect(ACTION_UUID);

$UD.onConnected(() => {
  form = document.querySelector('#property-inspector');
  document.querySelector('.uspi-wrapper').classList.remove('hidden');

  form.addEventListener(
    'input',
    Utils.debounce(() => {
      save();
    })
  );

  document.querySelector('#pickPhoto').addEventListener('click', () => {
    $UD.selectFileDialog('image(*.png *.jpg *.jpeg *.gif *.webp *.heic)');
  });
});

$UD.onAdd((jsn) => {
  if (jsn?.param) restore(jsn.param);
});

$UD.onParamFromApp((jsn) => {
  if (jsn?.param) restore(jsn.param);
});

// File/folder picker result.
$UD.onSelectdialog((jsn) => {
  if (jsn?.path) {
    form.querySelector('[name="iconPath"]').value = jsn.path;
    updatePhotoLabel(jsn.path);
    save();
    // refresh diagnostics after the main service re-renders the key
    setTimeout(() => window.cjFetchLogs && window.cjFetchLogs(), 700);
  }
});

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
