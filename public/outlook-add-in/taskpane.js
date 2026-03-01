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
      apiBase: fromUrl.apiBase || 'https://flask-6421997997235322.kloudbeansite.com',
      companyId: fromUrl.companyId,
      userId: fromUrl.userId
    };
  }
  return {
    apiBase: (typeof localStorage !== 'undefined' && localStorage.getItem(SETTINGS_KEYS.API_BASE)) || 'https://flask-6421997997235322.kloudbeansite.com',
    companyId: (typeof localStorage !== 'undefined' && localStorage.getItem(SETTINGS_KEYS.COMPANY_ID)) || '',
    userId: (typeof localStorage !== 'undefined' && localStorage.getItem(SETTINGS_KEYS.USER_ID)) || ''
  };
}

function setStatus(text, isError, isSuccess) {
  var el = document.getElementById('status');
  if (!el) return;
  el.textContent = text || '';
  el.className = isError ? 'error' : (isSuccess ? 'success' : '');
  if (text) console.log('[setStatus]', text.substring(0, 80), { isError: isError, isSuccess: isSuccess });
}

function getMessageId() {
  if (!Office || !Office.context || !Office.context.mailbox || !Office.context.mailbox.item) {
    console.warn('[getMessageId] Office.context.mailbox.item not available');
    return null;
  }
  var item = Office.context.mailbox.item;
  var id = item.itemId || item.id || null;
  console.log('[getMessageId]', id ? id.substring(0, 40) + '...' : null);
  return id;
}

function getSubject() {
  if (!Office || !Office.context || !Office.context.mailbox || !Office.context.mailbox.item) return null;
  var item = Office.context.mailbox.item;
  var subject = item.subject || null;
  console.log('[getSubject]', subject);
  return subject;
}

function getReceivedDateTime() {
  if (!Office || !Office.context || !Office.context.mailbox || !Office.context.mailbox.item) return null;
  var item = Office.context.mailbox.item;
  if (item.dateTimeCreated) {
    var dt = item.dateTimeCreated.toISOString ? item.dateTimeCreated.toISOString() : String(item.dateTimeCreated);
    console.log('[getReceivedDateTime]', dt);
    return dt;
  }
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
  console.log('[getSelectedAttachmentIds]', ids.length, 'selected');
  return ids;
}

function loadAttachments() {
  console.log('[loadAttachments] Starting...');
  var settings = getSettings();
  console.log('[loadAttachments] Settings:', { hasApiBase: !!settings.apiBase, hasUserId: !!settings.userId, apiBase: settings.apiBase });

  var messageId = getMessageId();
  console.log('[loadAttachments] MessageId:', messageId ? messageId.substring(0, 40) + '...' : null);

  if (!messageId) {
    console.error('[loadAttachments] No message ID - user needs to open an email');
    setStatus('Please open an email first.', true);
    return;
  }
  if (!settings.apiBase) {
    console.error('[loadAttachments] No API base URL');
    setStatus('API URL not configured. Go to Settings.', true);
    return;
  }
  if (!settings.userId) {
    console.error('[loadAttachments] No user ID');
    setStatus('User ID not set. Please sign in to ProValuate first.', true);
    return;
  }

  var url = settings.apiBase.replace(/\/$/, '') + '/api/outlook/list-attachments';
  console.log('[loadAttachments] API URL:', url);
  setStatus('Loading attachments...');

  getAccessToken()
    .then(function (token) { console.log('[loadAttachments] Got access token:', !!token); return token; })
    .catch(function (err) { console.warn('[loadAttachments] Access token failed:', err && err.message); return null; })
    .then(function (token) {
      var body = {
        messageId: messageId,
        user_id: settings.userId,
        subject: getSubject(),
        receivedDateTime: getReceivedDateTime()
      };
      if (token) body.accessToken = token;
      console.log('[loadAttachments] Sending request, hasAccessToken:', !!token);
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    })
    .then(function (r) {
      console.log('[loadAttachments] Response status:', r.status, r.statusText);
      return r.json().then(function (data) {
        return { status: r.status, ok: r.ok, data: data };
      }).catch(function (parseErr) {
        console.error('[loadAttachments] Failed to parse JSON:', parseErr);
        throw new Error('Invalid JSON response from server');
      });
    })
    .then(function (result) {
      console.log('[loadAttachments] Result ok:', result.ok, 'data:', result.data);

      if (!result.ok) {
        var errorMsg = result.data && (result.data.error || result.data.message) ? (result.data.error || result.data.message) : 'Request failed';
        if (result.data && result.data.registration_required) {
          setStatus('Error: ' + errorMsg + '\n\nPlease click "Sign in for Outlook" below.', true);
        } else {
          setStatus('Error: ' + errorMsg, true);
        }
        return;
      }

      setStatus('');
      var list = document.getElementById('attachment-list');
      if (!list) { console.error('[loadAttachments] attachment-list element not found'); return; }
      list.innerHTML = '';

      var attachments = (result.data && result.data.attachments && Array.isArray(result.data.attachments)) ? result.data.attachments : [];
      console.log('[loadAttachments] Found attachments:', attachments.length);

      if (attachments.length === 0) {
        var msg = 'No resume attachments found (looking for .pdf, .doc, .docx, .txt files).';
        list.appendChild(document.createTextNode(msg));
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
      setStatus('Loaded ' + attachments.length + ' attachment(s). Select which to assess, or leave all checked.', false, true);
    })
    .catch(function (err) {
      console.error('[loadAttachments] Error:', err);
      setStatus('Failed to load attachments: ' + (err && err.message ? err.message : String(err)), true);
    });
}

function getAccessToken() {
  console.log('[getAccessToken] Requesting SSO token...');
  return new Promise(function (resolve, reject) {
    if (!Office || !Office.auth || typeof Office.auth.getAccessTokenAsync !== 'function') {
      console.warn('[getAccessToken] SSO not supported in this Outlook host');
      reject(new Error('SSO not supported in this host'));
      return;
    }
    Office.auth.getAccessTokenAsync({ allowSignInPrompt: true }, function (result) {
      if (result.status === 'succeeded') {
        console.log('[getAccessToken] Success');
        resolve(result.value);
      } else {
        var errorMsg = result.error && (result.error.message || result.error.code) ? (result.error.message || result.error.code) : 'Failed to get token';
        console.error('[getAccessToken] Failed:', errorMsg);
        reject(new Error(errorMsg));
      }
    });
  });
}

function loadJobDescriptions(apiBase, companyId) {
  if (!companyId) return Promise.resolve([]);
  var url = apiBase.replace(/\/$/, '') + '/api/job_descriptions?company_id=' + encodeURIComponent(companyId);
  console.log('[loadJobDescriptions]', url);
  return fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data && data.data && Array.isArray(data.data)) return data.data;
      return [];
    })
    .catch(function (err) { console.error('[loadJobDescriptions]', err); return []; });
}

function loadCriteria(apiBase, companyId, jdId) {
  if (!companyId) return Promise.resolve([]);
  var url = apiBase.replace(/\/$/, '') + '/api/criteria?company_id=' + encodeURIComponent(companyId);
  if (jdId) url += '&jd_id=' + encodeURIComponent(jdId);
  console.log('[loadCriteria]', url);
  return fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data && data.data && Array.isArray(data.data)) return data.data;
      return [];
    })
    .catch(function (err) { console.error('[loadCriteria]', err); return []; });
}

function runAssess() {
  console.log('[runAssess] Starting...');
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
      console.log('[runAssess] Token:', !!token);
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
      console.log('[runAssess] Request url:', url, 'attachmentIds:', selectedIds.length);
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    })
    .then(function (r) {
      console.log('[runAssess] Response status:', r.status);
      return r.json().then(function (data) { return { ok: r.ok, data: data }; });
    })
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
        var dashboardUrl = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://provaluate.aitamate.com';
        setStatus(msg + '\n\nOpen dashboard: ' + dashboardUrl, false, true);
      }
    })
    .catch(function (err) {
      console.error('[runAssess] Error:', err);
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
  var base = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://provaluate.aitamate.com';
  return base + '/login?redirect=outlook-add-in';
}

function init() {
  console.log('[init] Initializing add-in...');
  console.log('[init] Office:', typeof Office !== 'undefined', 'mailbox.item:', !!(Office && Office.context && Office.context.mailbox && Office.context.mailbox.item));

  var settings = getSettings();
  console.log('[init] Settings:', { apiBase: settings.apiBase, hasCompanyId: !!settings.companyId, hasUserId: !!settings.userId });

  var signinPrompt = document.getElementById('signin-prompt');
  var mainContent = document.getElementById('main-content');
  if (!settings.companyId || !settings.userId) {
    console.warn('[init] Missing Company ID or User ID - showing sign-in');
    if (signinPrompt) {
      signinPrompt.style.display = 'block';
      var signinLink = document.getElementById('signin-link');
      if (signinLink) signinLink.href = getSignInUrl();
    }
    if (mainContent) mainContent.style.display = 'none';
    return;
  }
  console.log('[init] Showing main content, attaching Load attachments handler');
  if (signinPrompt) signinPrompt.style.display = 'none';
  if (mainContent) mainContent.style.display = 'block';
  var attachmentsSection = document.getElementById('attachments-section');
  if (attachmentsSection) attachmentsSection.style.display = 'block';
  var loadAttachmentsBtn = document.getElementById('load-attachments');
  if (loadAttachmentsBtn) {
    loadAttachmentsBtn.addEventListener('click', loadAttachments);
    console.log('[init] Load attachments button wired');
  } else {
    console.warn('[init] load-attachments button not found');
  }
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
  if (!apiBase) apiBase = 'https://flask-6421997997235322.kloudbeansite.com';
  var link = document.getElementById('register-link');
  if (link) {
    var url = apiBase + '/api/outlook/register-start';
    if (settings.userId) url += '?user_id=' + encodeURIComponent(settings.userId);
    link.href = url;
    console.log('[setRegisterLink]', url);
  }
}

Office.onReady(function (info) {
  console.log('[Office.onReady]', info);
  init();
  setRegisterLink();
});
