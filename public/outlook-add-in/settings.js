var SETTINGS_KEYS = { API_BASE: 'provaluate_api_base', COMPANY_ID: 'provaluate_company_id', USER_ID: 'provaluate_user_id' };

function parseUrlParams() {
  var q = typeof window !== 'undefined' && window.location && window.location.search;
  if (!q || q.length < 2) return {};
  var params = {};
  q.slice(1).split('&').forEach(function (pair) {
    var i = pair.indexOf('=');
    if (i !== -1) params[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent((pair.slice(i + 1) || '').replace(/\+/g, ' '));
  });
  return params;
}

var DEFAULT_API_BASE = 'https://flask-6421997997235322.kloudbeansite.com';

function load() {
  try {
    var params = parseUrlParams();
    var apiBase = params.api_base || localStorage.getItem(SETTINGS_KEYS.API_BASE) || DEFAULT_API_BASE;
    var companyId = params.company_id || localStorage.getItem(SETTINGS_KEYS.COMPANY_ID) || '';
    var userId = params.user_id || localStorage.getItem(SETTINGS_KEYS.USER_ID) || '';
    if (apiBase) localStorage.setItem(SETTINGS_KEYS.API_BASE, apiBase);
    document.getElementById('company_id').value = companyId;
    document.getElementById('user_id').value = userId;
  } catch (e) {}
}

function save() {
  try {
    var apiBase = localStorage.getItem(SETTINGS_KEYS.API_BASE) || DEFAULT_API_BASE;
    var companyId = (document.getElementById('company_id').value || '').trim();
    var userId = (document.getElementById('user_id').value || '').trim();
    if (companyId) localStorage.setItem(SETTINGS_KEYS.COMPANY_ID, companyId);
    if (userId) localStorage.setItem(SETTINGS_KEYS.USER_ID, userId);
    var el = document.getElementById('saved');
    if (el) { el.textContent = 'Settings saved. Returning to task pane...'; }
    var qs = '?api_base=' + encodeURIComponent(apiBase) + '&company_id=' + encodeURIComponent(companyId) + '&user_id=' + encodeURIComponent(userId);
    window.location.href = 'taskpane.html?v=2' + (qs ? qs.replace('?', '&') : '');
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
