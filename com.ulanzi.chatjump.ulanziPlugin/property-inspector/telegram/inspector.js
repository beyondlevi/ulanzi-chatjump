const ACTION_UUID = 'com.ulanzi.ulanzistudio.chatjump.telegram';

let form;

$UD.connect(ACTION_UUID);

$UD.onConnected(() => {
  form = document.querySelector('#property-inspector');
  document.querySelector('.uspi-wrapper').classList.remove('hidden');

  form.addEventListener(
    'input',
    Utils.debounce(() => {
      toggleRows();
      save();
    })
  );

  document.querySelector('#target').addEventListener('change', () => {
    toggleRows();
    save();
  });

  document.querySelector('#pickPhoto').addEventListener('click', () => {
    $UD.selectFileDialog('image(*.png *.jpg *.jpeg *.gif)');
  });

  toggleRows();
});

$UD.onAdd((jsn) => {
  if (jsn?.param) restore(jsn.param);
});

$UD.onParamFromApp((jsn) => {
  if (jsn?.param) restore(jsn.param);
});

$UD.onSelectdialog((jsn) => {
  if (jsn?.path) {
    form.querySelector('[name="iconPath"]').value = jsn.path;
    updatePhotoLabel(jsn.path);
    save();
  }
});

function save() {
  $UD.sendParamFromPlugin(Utils.getFormValue(form));
}

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
