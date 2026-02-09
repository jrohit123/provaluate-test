var SETTINGS_KEYS = { API_BASE: 'provaluate_api_base', COMPANY_ID: 'provaluate_company_id', USER_ID: 'provaluate_user_id' };

function load() {
  try {
    document.getElementById('api_base').value = localStorage.getItem(SETTINGS_KEYS.API_BASE) || 'https://devprovaluate_py.aitamate.com';
    document.getElementById('company_id').value = localStorage.getItem(SETTINGS_KEYS.COMPANY_ID) || '';
    document.getElementById('user_id').value = localStorage.getItem(SETTINGS_KEYS.USER_ID) || '';
  } catch (e) {}
}

function save() {
  try {
    var apiBase = (document.getElementById('api_base').value || '').trim();
    var companyId = (document.getElementById('company_id').value || '').trim();
    var userId = (document.getElementById('user_id').value || '').trim();
    if (apiBase) localStorage.setItem(SETTINGS_KEYS.API_BASE, apiBase);
    if (companyId) localStorage.setItem(SETTINGS_KEYS.COMPANY_ID, companyId);
    if (userId) localStorage.setItem(SETTINGS_KEYS.USER_ID, userId);
    var el = document.getElementById('saved');
    if (el) { el.textContent = 'Settings saved. Returning to task pane...'; }
    var qs = '?api_base=' + encodeURIComponent(apiBase) + '&company_id=' + encodeURIComponent(companyId) + '&user_id=' + encodeURIComponent(userId);
    window.location.href = 'taskpane.html' + qs;
  } catch (e) {
    var el = document.getElementById('saved');
    if (el) { el.textContent = 'Error saving: ' + e.message; el.style.color = '#c00'; }
  }
}

document.addEventListener('DOMContentLoaded', function () {
  load();
  var btn = document.getElementById('save');
  if (btn) btn.addEventListener('click', save);
});
