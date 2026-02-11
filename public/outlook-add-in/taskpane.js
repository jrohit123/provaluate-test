/* global Office */

const SETTINGS_KEYS = { API_BASE: 'provaluate_api_base', COMPANY_ID: 'provaluate_company_id', USER_ID: 'provaluate_user_id' };

function parseUrlParams() {
  var q = typeof window !== 'undefined' && window.location && window.location.search;
  if (!q || q.length < 2) return null;
  var params = {};
  q.slice(1).split('&').forEach(function (pair) {
    var i = pair.indexOf('=');
    if (i !== -1) params[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
  });
  var apiBase = params.api_base || '';
  var companyId = params.company_id || '';
  var userId = params.user_id || '';
  if (!apiBase && !companyId && !userId) return null;
  return { apiBase: apiBase, companyId: companyId, userId: userId };
}

function getSettings() {
  var fromUrl = parseUrlParams();
  if (fromUrl) {
    if (typeof localStorage !== 'undefined') {
      if (fromUrl.apiBase) localStorage.setItem(SETTINGS_KEYS.API_BASE, fromUrl.apiBase);
      if (fromUrl.companyId) localStorage.setItem(SETTINGS_KEYS.COMPANY_ID, fromUrl.companyId);
      if (fromUrl.userId) localStorage.setItem(SETTINGS_KEYS.USER_ID, fromUrl.userId);
    }
    if (typeof history !== 'undefined' && history.replaceState) {
      try { history.replaceState(null, '', window.location.pathname || 'taskpane.html'); } catch (e) {}
    }
    return {
      apiBase: fromUrl.apiBase || 'https://devprovaluate_py.aitamate.com',
      companyId: fromUrl.companyId,
      userId: fromUrl.userId
    };
  }
  return {
    apiBase: (typeof localStorage !== 'undefined' && localStorage.getItem(SETTINGS_KEYS.API_BASE)) || 'https://devprovaluate_py.aitamate.com',
    companyId: (typeof localStorage !== 'undefined' && localStorage.getItem(SETTINGS_KEYS.COMPANY_ID)) || '',
    userId: (typeof localStorage !== 'undefined' && localStorage.getItem(SETTINGS_KEYS.USER_ID)) || ''
  };
}

function setStatus(text, isError, isSuccess) {
  var el = document.getElementById('status');
  if (!el) return;
  el.textContent = text || '';
  el.className = isError ? 'error' : (isSuccess ? 'success' : '');
}

function getMessageId() {
  if (!Office || !Office.context || !Office.context.mailbox || !Office.context.mailbox.item) return null;
  var item = Office.context.mailbox.item;
  return item.itemId || item.id || null;
}

function getSubject() {
  if (!Office || !Office.context || !Office.context.mailbox || !Office.context.mailbox.item) return null;
  var item = Office.context.mailbox.item;
  if (item.subject) return item.subject;
  return null;
}

function getReceivedDateTime() {
  if (!Office || !Office.context || !Office.context.mailbox || !Office.context.mailbox.item) return null;
  var item = Office.context.mailbox.item;
  if (item.dateTimeCreated) return item.dateTimeCreated.toISOString ? item.dateTimeCreated.toISOString() : String(item.dateTimeCreated);
  return null;
}

function getSelectedAttachmentIds() {
  var list = document.getElementById('attachment-list');
  if (!list) return [];
  var checkboxes = list.querySelectorAll('input[type="checkbox"]:checked');
  var ids = [];
  for (var i = 0; i < checkboxes.length; i++) {
    var id = checkboxes[i].value;
    if (id) ids.push(id);
  }
  return ids;
}

function loadAttachments() {
  var settings = getSettings();
  var messageId = getMessageId();
  if (!messageId || !settings.apiBase || !settings.userId) {
    setStatus('Open an email first and ensure you are signed in.', true);
    return;
  }
  var url = settings.apiBase.replace(/\/$/, '') + '/api/outlook/list-attachments';
  setStatus('Loading attachments...');
  getAccessToken().then(function (token) { return token; }).catch(function () { return null; }).then(function (token) {
    var body = {
      messageId: messageId,
      user_id: settings.userId,
      subject: getSubject(),
      receivedDateTime: getReceivedDateTime()
    };
    if (token) body.accessToken = token;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }).then(function (r) { return r.json(); }).then(function (data) {
    setStatus('');
    var list = document.getElementById('attachment-list');
    if (!list) return;
    list.innerHTML = '';
    var attachments = (data && data.attachments && Array.isArray(data.attachments)) ? data.attachments : [];
    if (attachments.length === 0) {
      list.appendChild(document.createTextNode('No resume attachments found.'));
      return;
    }
    attachments.forEach(function (a) {
      var id = a.id;
      var name = a.name || ('Attachment ' + id);
      var div = document.createElement('div');
      div.className = 'attachment-item';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = id;
      cb.id = 'att-' + id;
      cb.checked = true;
      var label = document.createElement('label');
      label.htmlFor = cb.id;
      label.appendChild(document.createTextNode(name));
      div.appendChild(cb);
      div.appendChild(label);
      list.appendChild(div);
    });
  }).catch(function (err) {
    setStatus('Failed to load attachments: ' + (err && err.message ? err.message : String(err)), true);
  });
}

function getAccessToken() {
  return new Promise(function (resolve, reject) {
    if (!Office || !Office.auth || typeof Office.auth.getAccessTokenAsync !== 'function') {
      reject(new Error('SSO not supported in this host'));
      return;
    }
    Office.auth.getAccessTokenAsync({ allowSignInPrompt: true }, function (result) {
      if (result.status === 'succeeded') resolve(result.value);
      else reject(new Error(result.error?.message || 'Failed to get token'));
    });
  });
}

function loadJobDescriptions(apiBase, companyId) {
  if (!companyId) return Promise.resolve([]);
  var url = apiBase.replace(/\/$/, '') + '/api/job_descriptions?company_id=' + encodeURIComponent(companyId);
  return fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data && data.data && Array.isArray(data.data)) return data.data;
      return [];
    })
    .catch(function () { return []; });
}

function loadCriteria(apiBase, companyId, jdId) {
  if (!companyId) return Promise.resolve([]);
  var url = apiBase.replace(/\/$/, '') + '/api/criteria?company_id=' + encodeURIComponent(companyId);
  if (jdId) url += '&jd_id=' + encodeURIComponent(jdId);
  return fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data && data.data && Array.isArray(data.data)) return data.data;
      return [];
    })
    .catch(function () { return []; });
}

function runAssess() {
  var settings = getSettings();
  var apiBase = settings.apiBase;
  var companyId = settings.companyId;
  var userId = settings.userId;
  if (!companyId || !userId) {
    setStatus('Open Settings and set Company ID and User ID.', true);
    return;
  }
  var jdSelect = document.getElementById('jd');
  var criteriaSelect = document.getElementById('criteria');
  var jdId = jdSelect && jdSelect.value ? jdSelect.value : '';
  var criteriaId = criteriaSelect && criteriaSelect.value ? criteriaSelect.value : '';
  if (!jdId) {
    setStatus('Please select a job description.', true);
    return;
  }
  var messageId = getMessageId();
  if (!messageId) {
    setStatus('No message selected or item ID not available.', true);
    return;
  }
  var btn = document.getElementById('assess');
  if (btn) btn.disabled = true;
  setStatus('Getting token and assessing...');
  getAccessToken()
    .catch(function (err) {
      if (err && err.message && err.message.indexOf('SSO not supported') !== -1) return null;
      throw err;
    })
    .then(function (token) {
      setStatus('Analyzing resumes...');
      var url = apiBase.replace(/\/$/, '') + '/api/outlook/fetch-and-analyze';
      var body = {
        messageId: messageId,
        jd_id: jdId,
        criteria_id: criteriaId || null,
        company_id: companyId,
        user_id: userId,
        accessToken: token || null,
        subject: getSubject(),
        receivedDateTime: getReceivedDateTime()
      };
      var selectedIds = getSelectedAttachmentIds();
      if (selectedIds && selectedIds.length > 0) body.attachmentIds = selectedIds;
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    })
    .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
    .then(function (result) {
      if (btn) btn.disabled = false;
      if (!result.ok) {
        setStatus('Error: ' + (result.data && result.data.error ? result.data.error : result.data.message || 'Request failed'), true);
        return;
      }
      var d = result.data;
      var success = d && (d.successful_analyses || 0);
      var failed = d && (d.failed_analyses || 0);
      var msg = (d && d.message) ? d.message : 'Done. ' + success + ' analyzed, ' + failed + ' failed.';
      setStatus(msg, false, true);
      if (success > 0 && d.jd_id) {
        var dashboardUrl = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://devprovaluate.aitamate.com';
        setStatus(msg + '\n\nOpen dashboard: ' + dashboardUrl, false, true);
      }
    })
    .catch(function (err) {
      if (btn) btn.disabled = false;
      setStatus('Error: ' + (err && err.message ? err.message : String(err)), true);
    });
}

function populateJDs(list) {
  var sel = document.getElementById('jd');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Select JD --</option>';
  (list || []).forEach(function (jd) {
    var opt = document.createElement('option');
    opt.value = jd.jd_id || jd.id || '';
    opt.textContent = jd.title || jd.jd_id || 'Untitled';
    sel.appendChild(opt);
  });
}

function populateCriteria(list) {
  var sel = document.getElementById('criteria');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Select criteria --</option>';
  (list || []).forEach(function (c) {
    var opt = document.createElement('option');
    opt.value = c.criteria_id || c.id || '';
    opt.textContent = c.criteria_name || c.criteria_id || 'Untitled';
    sel.appendChild(opt);
  });
}

function onJdChange() {
  var settings = getSettings();
  var jdSelect = document.getElementById('jd');
  var jdId = jdSelect && jdSelect.value ? jdSelect.value : '';
  loadCriteria(settings.apiBase, settings.companyId, jdId).then(populateCriteria);
}

function getSignInUrl() {
  var base = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://devprovaluate.aitamate.com';
  return base + '/login?redirect=outlook-add-in';
}

function init() {
  var settings = getSettings();
  var signinPrompt = document.getElementById('signin-prompt');
  var mainContent = document.getElementById('main-content');
  if (!settings.companyId || !settings.userId) {
    if (signinPrompt) {
      signinPrompt.style.display = 'block';
      var signinLink = document.getElementById('signin-link');
      if (signinLink) signinLink.href = getSignInUrl();
    }
    if (mainContent) mainContent.style.display = 'none';
    return;
  }
  if (signinPrompt) signinPrompt.style.display = 'none';
  if (mainContent) mainContent.style.display = 'block';
  var attachmentsSection = document.getElementById('attachments-section');
  if (attachmentsSection) attachmentsSection.style.display = 'block';
  var loadAttachmentsBtn = document.getElementById('load-attachments');
  if (loadAttachmentsBtn) loadAttachmentsBtn.addEventListener('click', loadAttachments);
  setStatus('Loading job descriptions...');
  loadJobDescriptions(settings.apiBase, settings.companyId).then(function (list) {
    populateJDs(list);
    setStatus('');
    var jdSelect = document.getElementById('jd');
    if (jdSelect) jdSelect.addEventListener('change', onJdChange);
    loadCriteria(settings.apiBase, settings.companyId).then(populateCriteria);
  });
  var btn = document.getElementById('assess');
  if (btn) {
    btn.disabled = !settings.companyId || !settings.userId;
    btn.addEventListener('click', runAssess);
  }
}

function setRegisterLink() {
  var settings = getSettings();
  var apiBase = (settings.apiBase || '').trim().replace(/\/$/, '');
  if (!apiBase) apiBase = 'https://devprovaluate_py.aitamate.com';
  var link = document.getElementById('register-link');
  if (link) {
    var url = apiBase + '/api/outlook/register-start';
    if (settings.userId) url += '?user_id=' + encodeURIComponent(settings.userId);
    link.href = url;
  }
}

Office.onReady(function () {
  init();
  setRegisterLink();
});
