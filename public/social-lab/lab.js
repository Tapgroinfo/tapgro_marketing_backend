const LS = {
  apiBase: 'tg_lab_api',
  customerToken: 'tg_lab_ctoken',
  customerRefresh: 'tg_lab_crefresh',
  customer: 'tg_lab_customer',
  adminToken: 'tg_lab_atoken',
  mode: 'tg_lab_mode',
  pendingSession: 'tg_lab_session',
};

const $ = (id) => document.getElementById(id);
const logEl = () => $('apiLog');

function apiBase() {
  return ($('apiBase').value || window.location.origin).replace(/\/$/, '');
}

function setLabHint() {
  const url = `${apiBase()}/test/social/`;
  $('labUrlHint').textContent = url;
  try {
    const host = new URL(apiBase()).hostname;
    $('envPill').textContent = host === 'localhost' || host === '127.0.0.1' ? 'local' : host;
  } catch {
    $('envPill').textContent = 'local';
  }
}

function log(title, data) {
  const el = logEl();
  if (!el) return;
  const ts = new Date().toLocaleTimeString();
  const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  el.textContent = `[${ts}] ${title}\n${body}\n\n` + el.textContent;
}

function mode() {
  return localStorage.getItem(LS.mode) || 'customer';
}

function setMode(next) {
  localStorage.setItem(LS.mode, next);
  document.querySelectorAll('.seg-btn').forEach((t) => {
    t.classList.toggle('active', t.dataset.mode === next);
  });
  $('customerMode').classList.toggle('hidden', next !== 'customer');
  $('adminMode').classList.toggle('hidden', next !== 'admin');
}

function customerToken() {
  return localStorage.getItem(LS.customerToken) || '';
}
function adminToken() {
  return localStorage.getItem(LS.adminToken) || '';
}

function refreshWho() {
  try {
    const c = JSON.parse(localStorage.getItem(LS.customer) || 'null');
    $('customerWho').innerHTML = c
      ? `Session · <b>${c.name || c.mobile}</b> · ${c.businessName || '—'} · ${c.mobile}`
      : 'Not logged in — Send OTP → Verify first';
  } catch {
    $('customerWho').textContent = 'Not logged in';
  }
  $('adminWho').innerHTML = adminToken()
    ? 'Admin JWT <b>saved</b> in this browser'
    : 'Not logged in';
}

async function api(path, options = {}, auth = 'customer') {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (auth === 'admin' && adminToken()) {
    headers.Authorization = `Bearer ${adminToken()}`;
  } else if (auth === 'customer' && customerToken()) {
    headers.Authorization = `Bearer ${customerToken()}`;
  }
  const res = await fetch(`${apiBase()}${path}`, { ...options, headers });
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  log(`${options.method || 'GET'} ${path} → ${res.status}`, body);
  if (!res.ok) {
    const msg = (body && (body.message || body.error)) || `HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return body;
}

function showBanner(kind, text) {
  const el = $('returnBanner');
  el.className = `toast ${kind}`;
  el.textContent = text;
  el.classList.remove('hidden');
}

function clearBanner() {
  $('returnBanner').classList.add('hidden');
}

function statusPill(status) {
  const s = status || 'unknown';
  return `<span class="pill ${s}">${s}</span>`;
}

function renderPlatforms(list) {
  const box = $('platformsList');
  if (!list?.length) {
    box.className = 'list empty-state';
    box.innerHTML = 'No active platforms. Seed/enable platforms in admin.';
    return;
  }
  box.className = 'list';
  box.innerHTML = list
    .map((p) => {
      const connected = (p.connected || []).length > 0;
      const label = connected
        ? `connected: ${(p.connected || [])
            .map((c) => c.username || c.displayName || c.id)
            .join(', ')}`
        : 'not connected';
      return `<div class="row-item">
        <div class="meta">
          <strong>${p.name || p.slug}</strong>
          <small>${p.slug} · ${label}</small>
          ${p.needsReconnect ? statusPill('needs_reconnect') : connected ? statusPill('connected') : ''}
        </div>
        <div class="row-actions">
          <button type="button" class="btn success" data-connect="${p.slug}">Connect</button>
        </div>
      </div>`;
    })
    .join('');
  box.querySelectorAll('[data-connect]').forEach((btn) => {
    btn.addEventListener('click', () => connectPlatform(btn.dataset.connect));
  });
}

function renderChannels(list) {
  const box = $('channelsList');
  $('btnHealthAll').disabled = !list?.length;
  if (!list?.length) {
    box.className = 'list empty-state';
    box.innerHTML = 'No channels yet. Connect Instagram / Google / Facebook above.';
    return;
  }
  box.className = 'list';
  box.innerHTML = list
    .map((c) => {
      const id = c.id || c._id;
      return `<div class="row-item">
        <div class="meta">
          <strong>${c.platform} · ${c.displayName || c.username || id}</strong>
          <small>id: ${id}</small>
          ${statusPill(c.status)}
        </div>
        <div class="row-actions">
          <button type="button" class="btn success" data-health="${id}">Health</button>
          <button type="button" class="btn ghost" data-use="${id}">Use for post</button>
          <button type="button" class="btn danger" data-disc="${id}">Disconnect</button>
        </div>
      </div>`;
    })
    .join('');
  box.querySelectorAll('[data-health]').forEach((b) =>
    b.addEventListener('click', () => testHealth(b.dataset.health)),
  );
  box.querySelectorAll('[data-use]').forEach((b) =>
    b.addEventListener('click', () => {
      $('testChannelId').value = b.dataset.use;
      document.getElementById('publish')?.scrollIntoView({ behavior: 'smooth' });
    }),
  );
  box.querySelectorAll('[data-disc]').forEach((b) =>
    b.addEventListener('click', () => disconnectChannel(b.dataset.disc)),
  );
}

async function sendOtp() {
  const mobile = $('mobile').value.trim();
  const res = await api(
    '/api/customer/v1/auth/send-otp',
    { method: 'POST', body: JSON.stringify({ mobile }) },
    'none',
  );
  if (res?.data?.devOtp) $('otp').value = res.data.devOtp;
  showBanner('ok', res?.message || 'OTP sent');
}

async function verifyOtp() {
  const body = {
    mobile: $('mobile').value.trim(),
    otp: $('otp').value.trim(),
    name: $('name').value.trim() || undefined,
    businessName: $('businessName').value.trim() || undefined,
  };
  const res = await api(
    '/api/customer/v1/auth/verify-otp',
    { method: 'POST', body: JSON.stringify(body) },
    'none',
  );
  localStorage.setItem(
    LS.customerToken,
    res.token || res.accessToken || res.data?.token || '',
  );
  if (res.refreshToken) {
    localStorage.setItem(LS.customerRefresh, res.refreshToken);
  }
  localStorage.setItem(
    LS.customer,
    JSON.stringify(
      res.data?.customer ||
        res.customer || {
          mobile: body.mobile,
          name: body.name,
          businessName: body.businessName,
        },
    ),
  );
  refreshWho();
  showBanner('ok', 'Customer logged in');
  await loadPlatforms();
  await loadChannels();
}

function logoutCustomer() {
  localStorage.removeItem(LS.customerToken);
  localStorage.removeItem(LS.customerRefresh);
  localStorage.removeItem(LS.customer);
  refreshWho();
  clearBanner();
  $('platformsList').className = 'list empty-state';
  $('platformsList').innerHTML = 'Logged out';
  $('channelsList').className = 'list empty-state';
  $('channelsList').innerHTML = 'Logged out';
}

async function loadPlatforms() {
  if (!customerToken()) {
    showBanner('info', 'Login with OTP before refreshing platforms');
    return;
  }
  const res = await api('/api/customer/v1/platforms');
  renderPlatforms(res.data || []);
}

async function loadChannels() {
  if (!customerToken()) {
    showBanner('info', 'Login with OTP before refreshing channels');
    return;
  }
  const res = await api('/api/customer/v1/channels?includeDisconnected=true');
  renderChannels(res.data || []);
}

async function syncChannels() {
  const res = await api('/api/customer/v1/channels/sync', { method: 'POST' });
  showBanner('ok', res.message || 'Synced');
  await loadChannels();
  await loadPlatforms();
}

async function connectPlatform(platform) {
  const res = await api('/api/customer/v1/channels/connect', {
    method: 'POST',
    body: JSON.stringify({ platform }),
  });
  const data = res.data || {};
  const authUrl = data.authUrl || data.url;
  const session = data.session || data.state;
  if (session) localStorage.setItem(LS.pendingSession, session);
  if (!authUrl) {
    showBanner('err', res.message || 'No authUrl returned');
    return;
  }
  showBanner('info', `Opening ${platform} OAuth…`);
  window.open(authUrl, '_blank', 'noopener,noreferrer');
  if (session) pollSession(session, 'customer');
}

async function pollSession(session, kind) {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const path =
        kind === 'admin'
          ? `/api/backend/v1/social/connect/${session}`
          : `/api/customer/v1/channels/connect/${session}`;
      const res = await api(path, {}, kind === 'admin' ? 'admin' : 'customer');
      const status = res.data?.status;
      if (status === 'connected') {
        showBanner('ok', res.data?.message || 'Connected');
        localStorage.removeItem(LS.pendingSession);
        if (kind === 'customer') {
          await loadChannels();
          await loadPlatforms();
        }
        return;
      }
      if (status === 'failed') {
        showBanner('err', res.data?.message || 'Connect failed');
        localStorage.removeItem(LS.pendingSession);
        return;
      }
    } catch {
      /* keep polling */
    }
  }
  showBanner('info', 'Still pending — refresh channels after OAuth finishes');
}

async function testHealth(id) {
  const auth = mode() === 'admin' ? 'admin' : 'customer';
  const path =
    auth === 'admin'
      ? `/api/backend/v1/social/channel/${id}/test`
      : `/api/customer/v1/channels/${id}/test`;
  const res = await api(
    path,
    { method: 'POST', body: JSON.stringify({ mode: 'health' }) },
    auth,
  );
  showBanner('ok', res.message || 'Health OK');
}

async function disconnectChannel(id) {
  if (!confirm('Disconnect this channel?')) return;
  await api(`/api/customer/v1/channels/${id}`, { method: 'DELETE' });
  showBanner('ok', 'Disconnected');
  await loadChannels();
  await loadPlatforms();
}

async function healthAll() {
  const res = await api('/api/customer/v1/channels');
  for (const c of res.data || []) {
    await testHealth(c.id || c._id);
  }
}

async function adminLogin() {
  const res = await api(
    '/api/backend/v1/adminLogin',
    {
      method: 'POST',
      body: JSON.stringify({
        email: $('adminEmail').value.trim(),
        password: $('adminPassword').value,
      }),
    },
    'none',
  );
  const token = res.data?.token || res.data?.accessToken || res.token || res.accessToken;
  if (!token) throw new Error('No token in admin login response');
  localStorage.setItem(LS.adminToken, token);
  refreshWho();
  showBanner('ok', 'Admin logged in');
}

function saveAdminToken() {
  const t = $('adminTokenPaste').value.trim();
  if (!t) return;
  localStorage.setItem(LS.adminToken, t);
  refreshWho();
  showBanner('ok', 'Admin token saved');
}

function adminLogout() {
  localStorage.removeItem(LS.adminToken);
  refreshWho();
}

async function testProvider() {
  const res = await api('/api/backend/v1/social/provider/test', { method: 'POST' }, 'admin');
  showBanner('ok', res.message || 'Provider OK');
}

async function createProfile() {
  const res = await api(
    '/api/backend/v1/social/profile',
    {
      method: 'POST',
      body: JSON.stringify({
        name: $('profileName').value.trim(),
        description: $('profileDesc').value.trim() || undefined,
      }),
    },
    'admin',
  );
  const id = res.data?.id || res.data?._id;
  if (id) $('profileId').value = id;
  showBanner('ok', res.message || 'Profile created');
  await listProfiles();
}

async function listProfiles() {
  const res = await api('/api/backend/v1/social/profiles?limit=20', {}, 'admin');
  const rows = res.data || res.docs || [];
  const box = $('adminProfiles');
  if (!rows.length) {
    box.className = 'list empty-state';
    box.innerHTML = 'No profiles';
    return;
  }
  box.className = 'list';
  box.innerHTML = rows
    .map((p) => {
      const id = p.id || p._id;
      return `<div class="row-item">
        <div class="meta">
          <strong>${p.name}</strong>
          <small>${id}</small>
        </div>
        <div class="row-actions">
          <button type="button" class="btn ghost" data-pick="${id}">Use</button>
        </div>
      </div>`;
    })
    .join('');
  box.querySelectorAll('[data-pick]').forEach((b) =>
    b.addEventListener('click', () => {
      $('profileId').value = b.dataset.pick;
    }),
  );
}

async function adminConnect() {
  const id = $('profileId').value.trim();
  const platform = $('adminPlatform').value;
  if (!id) throw new Error('Profile id required');
  const res = await api(
    `/api/backend/v1/social/profile/${id}/connect`,
    { method: 'POST', body: JSON.stringify({ platform }) },
    'admin',
  );
  const data = res.data || {};
  const authUrl = data.authUrl || data.url;
  const session = data.session || data.state;
  if (session) localStorage.setItem(LS.pendingSession, session);
  if (!authUrl) {
    showBanner(data.alreadyConnected ? 'ok' : 'err', res.message || 'No authUrl');
    return;
  }
  window.open(authUrl, '_blank', 'noopener,noreferrer');
  showBanner('info', `Admin OAuth opened for ${platform}`);
  if (session) pollSession(session, 'admin');
}

async function adminSyncProfile() {
  const id = $('profileId').value.trim();
  if (!id) throw new Error('Profile id required');
  await api(`/api/backend/v1/social/profile/${id}/sync`, { method: 'POST' }, 'admin');
  showBanner('ok', 'Profile synced');
}

async function publishTestPost() {
  const id = $('testChannelId').value.trim();
  if (!id) throw new Error('Channel id required');
  const auth = mode() === 'admin' ? 'admin' : 'customer';
  const path =
    auth === 'admin'
      ? `/api/backend/v1/social/channel/${id}/test`
      : `/api/customer/v1/channels/${id}/test`;
  const body = {
    mode: 'post',
    content: $('testContent').value.trim(),
    confirmPublish: true,
  };
  const media = $('testMediaUrl').value.trim();
  if (media) {
    body.mediaUrl = media;
    body.mediaType = 'image';
  }
  if (!confirm('This publishes a REAL post. Continue?')) return;
  const res = await api(path, { method: 'POST', body: JSON.stringify(body) }, auth);
  showBanner('ok', res.message || 'Post published');
}

function handleReturnQuery() {
  const q = new URLSearchParams(window.location.search);
  const status = q.get('social_connect');
  if (!status) return;
  if (status === 'success') {
    showBanner(
      'ok',
      `Connect success · platform=${q.get('platform') || '—'} · channel=${q.get('channelId') || '—'}`,
    );
  } else {
    showBanner('err', q.get('message') || 'Connect error');
  }
  const session = localStorage.getItem(LS.pendingSession);
  if (session && customerToken()) pollSession(session, 'customer');
  if (session && adminToken() && mode() === 'admin') pollSession(session, 'admin');
  if (customerToken()) {
    loadChannels().catch(() => {});
    loadPlatforms().catch(() => {});
  }
  history.replaceState({}, '', window.location.pathname);
}

function wire() {
  $('apiBase').value = localStorage.getItem(LS.apiBase) || window.location.origin;
  setLabHint();
  $('apiBase').addEventListener('change', () => {
    localStorage.setItem(LS.apiBase, apiBase());
    setLabHint();
  });

  document.querySelectorAll('.seg-btn').forEach((t) =>
    t.addEventListener('click', () => setMode(t.dataset.mode)),
  );
  document.querySelectorAll('.rail-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rail-link').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.jump);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  setMode(mode());
  refreshWho();

  const wrap = (fn) => async () => {
    try {
      await fn();
    } catch (e) {
      showBanner('err', e.message || String(e));
      log('ERROR', e.message || String(e));
    }
  };

  $('btnSendOtp').onclick = wrap(sendOtp);
  $('btnVerifyOtp').onclick = wrap(verifyOtp);
  $('btnLogout').onclick = logoutCustomer;
  $('btnLoadPlatforms').onclick = wrap(loadPlatforms);
  $('btnLoadChannels').onclick = wrap(loadChannels);
  $('btnSync').onclick = wrap(syncChannels);
  $('btnHealthAll').onclick = wrap(healthAll);
  $('btnAdminLogin').onclick = wrap(adminLogin);
  $('btnAdminLogout').onclick = adminLogout;
  $('btnSaveAdminToken').onclick = saveAdminToken;
  $('btnTestProvider').onclick = wrap(testProvider);
  $('btnCreateProfile').onclick = wrap(createProfile);
  $('btnListProfiles').onclick = wrap(listProfiles);
  $('btnAdminConnect').onclick = wrap(adminConnect);
  $('btnAdminSyncProfile').onclick = wrap(adminSyncProfile);
  $('btnTestPost').onclick = wrap(publishTestPost);
  $('btnClearLog').onclick = () => {
    logEl().textContent = '';
  };

  handleReturnQuery();
  if (customerToken() && mode() === 'customer') {
    loadPlatforms().catch(() => {});
    loadChannels().catch(() => {});
  }
}

wire();
