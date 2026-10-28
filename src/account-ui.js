export function createAccountUi({ apiBase, onLogin, onLogout, joinRoom, currentRoom, notify }) {
  const authView = document.createElement('section');
  authView.id = 'auth-view';
  authView.className = 'panel auth-view';
  authView.innerHTML = `<p class="eyebrow">CỜ TƯỚNG TRỰC TUYẾN</p><h1>Chào mừng trở lại</h1>
    <div class="auth-tabs"><button class="button button-secondary" data-mode="login">Đăng nhập</button><button class="button button-quiet" data-mode="register">Đăng ký</button><button class="button button-quiet" data-mode="forgot">Quên mật khẩu</button></div>
    <form id="account-form"><div data-field="username"><label for="auth-username">Tên đăng nhập</label><input class="text-input" id="auth-username" name="username" autocomplete="username" maxlength="50" required></div>
    <div data-field="displayName" hidden><label for="auth-displayName">Tên hiển thị</label><input class="text-input" id="auth-displayName" name="displayName" maxlength="50" autocomplete="nickname"></div>
    <div data-field="email" hidden><label for="auth-email">Email</label><input class="text-input" id="auth-email" name="email" type="email" maxlength="254" autocomplete="email"></div>
    <div data-field="password"><label for="auth-password">Mật khẩu</label><input class="text-input" id="auth-password" name="password" type="password" maxlength="128" autocomplete="current-password" required></div>
    <div data-field="confirmPassword" hidden><label for="auth-confirmPassword">Xác nhận mật khẩu</label><input class="text-input" id="auth-confirmPassword" name="confirmPassword" type="password" maxlength="128" autocomplete="new-password"></div>
    <p class="muted" id="password-hint" hidden>Từ 8–128 ký tự, có cả chữ và số.</p><p id="auth-message" role="status" aria-live="polite"></p><button id="auth-submit" class="button button-primary" type="submit">Đăng nhập</button></form>`;
  document.querySelector('main').prepend(authView);
  const bar = document.createElement('div');
  bar.className = 'account-bar'; bar.hidden = true;
  bar.innerHTML = '<span id="account-name"></span><button id="account-toggle" class="button button-quiet">Tài khoản & bạn bè</button><button id="logout-button" class="button button-quiet">Đăng xuất</button>';
  document.querySelector('.topbar').append(bar);
  const dashboard = document.createElement('section');
  dashboard.id = 'account-dashboard'; dashboard.className = 'panel account-dashboard'; dashboard.hidden = true;
  dashboard.innerHTML = `<div class="panel-heading"><h2>Tài khoản & bạn bè</h2><button id="account-close" class="button button-quiet">Đóng</button></div>
    <div class="account-grid"><section><h3>Hồ sơ</h3><p id="profile-details" class="muted"></p><form id="profile-form"><label for="profile-name">Tên hiển thị</label><input id="profile-name" class="text-input" maxlength="50" required><button class="button button-secondary">Lưu tên</button></form><h3>Phiên đăng nhập</h3><div id="session-list"></div></section>
    <section><h3>Bạn bè</h3><form id="friend-search-form"><label for="friend-query">Tìm theo tên đăng nhập hoặc tên hiển thị</label><input id="friend-query" class="text-input" minlength="2" maxlength="50" required><button class="button button-secondary">Tìm kiếm</button></form><div id="friend-search-results"></div><div id="friend-list"></div><h3>Lời mời kết bạn</h3><div id="friend-requests"></div></section>
    <section><h3>Lời mời vào phòng</h3><div id="room-invites"></div><h3>Thông báo</h3><div id="notification-list"></div></section></div>`;
  document.querySelector('main').insertBefore(dashboard, document.querySelector('#lobby'));
  const publicSection = document.createElement('section');
  publicSection.className = 'public-rooms';
  publicSection.innerHTML = '<div class="panel-heading"><h2>Phòng công khai</h2><button class="button button-quiet" id="refresh-public">Làm mới</button></div><div id="public-room-list"></div>';
  document.querySelector('#lobby').append(publicSection);
  let user = null;
  let mode = 'login';
  const resetToken = new URLSearchParams(location.search).get('reset');
  function setMode(next) {
    mode = next;
    const visible = { login: ['username', 'password'], register: ['username', 'displayName', 'email', 'password', 'confirmPassword'], forgot: ['email'], reset: ['password', 'confirmPassword'] }[mode];
    for (const field of authView.querySelectorAll('[data-field]')) {
      field.hidden = !visible.includes(field.dataset.field);
      field.querySelector('input').required = !field.hidden;
    }
    document.querySelector('#auth-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    document.querySelector('#password-hint').hidden = !['register', 'reset'].includes(mode);
    document.querySelector('#auth-submit').textContent = { login: 'Đăng nhập', register: 'Tạo tài khoản', forgot: 'Gửi hướng dẫn đặt lại', reset: 'Đặt lại mật khẩu' }[mode];
    document.querySelector('#auth-message').textContent = '';
    authView.querySelector('h1').textContent = { login: 'Chào mừng trở lại', register: 'Tạo tài khoản', forgot: 'Quên mật khẩu', reset: 'Đặt lại mật khẩu' }[mode];
  }
  function expire() {
    user = null; authView.hidden = false; bar.hidden = true; dashboard.hidden = true;
    onLogout(); setMode('login');
  }
  async function request(route, { method = 'GET', body } = {}) {
    const response = await fetch(`${apiBase()}${route}`, { method, credentials: 'same-origin', headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) {
      if (response.status === 401 && user) expire();
      throw new Error(payload.error || 'Yêu cầu thất bại.');
    }
    return payload;
  }
  async function loggedIn(account) {
    user = account; authView.hidden = true; bar.hidden = false;
    document.querySelector('#account-name').textContent = account.displayName;
    document.querySelector('#profile-name').value = account.displayName;
    document.querySelector('#profile-details').textContent = `${account.username} · ${account.email}`;
    await onLogin(account);
    refreshPublic().catch((e) => notify(e.message));
  }
  function row(container, text, actions = []) {
    const item = document.createElement('div'); item.className = 'account-row';
    const label = document.createElement('span'); label.textContent = text; item.append(label);
    for (const [title, callback] of actions) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'button button-quiet'; button.textContent = title;
      button.onclick = async () => { button.disabled = true; try { await callback(); await refreshSocial(); } catch (e) { notify(e.message); } finally { button.disabled = false; } };
      item.append(button);
    }
    container.append(item);
  }
  async function refreshPublic() {
    if (!user) return;
    const { rooms } = await request('/api/rooms/public');
    const list = document.querySelector('#public-room-list'); list.replaceChildren();
    if (!rooms.length) row(list, 'Chưa có phòng công khai. Bạn có thể tạo phòng mới.');
    for (const r of rooms) row(list, `${r.name} · ${r.code} · ${r.opponent ? 'Đủ hai người' : 'Chờ đối thủ'} · ${r.spectators.length} khán giả`, [['Tham gia', () => joinRoom(r.code)]]);
  }
  async function refreshSocial() {
    if (!user || dashboard.hidden) return;
    const social = await request('/api/friends');
    for (const id of ['friend-list', 'friend-requests', 'room-invites', 'notification-list', 'session-list']) document.getElementById(id).replaceChildren();
    for (const f of social.friends) {
      const actions = [['Hủy kết bạn', () => request(`/api/friends/${f.id}`, { method: 'DELETE' })]];
      if (f.online && currentRoom()?.host?.id === user.id && !currentRoom()?.opponent) actions.unshift(['Mời vào phòng', () => request(`/api/rooms/${currentRoom().code}/invites`, { method: 'POST', body: { userId: f.id } })]);
      row(document.querySelector('#friend-list'), `${f.displayName} (@${f.username}) · ${f.online ? 'Online' : 'Offline'}`, actions);
    }
    for (const r of social.requests) {
      const incoming = r.to === user.id;
      const actions = incoming ? ['accept', 'reject'] : ['cancel'];
      row(document.querySelector('#friend-requests'), `${incoming ? r.sender.displayName : r.recipient.displayName} · ${incoming ? 'Đã gửi lời mời' : 'Đang chờ'}`, actions.map((a) => [{ accept: 'Chấp nhận', reject: 'Từ chối', cancel: 'Hủy' }[a], () => request(`/api/friends/requests/${r.id}/${a}`, { method: 'POST' })]));
    }
    for (const i of social.invites) row(document.querySelector('#room-invites'), `Phòng ${i.roomCode} · hết hạn ${new Date(i.expiresAt).toLocaleTimeString('vi-VN')}`, (i.to === user.id ? ['accept', 'decline'] : ['cancel']).map((action) => [{ accept: 'Vào phòng', decline: 'Từ chối', cancel: 'Hủy' }[action], async () => { const result = await request(`/api/rooms/invites/${i.id}/${action}`, { method: 'POST' }); if (action === 'accept') { joinRoom(result.roomCode); dashboard.hidden = true; } }]));
    for (const n of social.notifications) row(document.querySelector('#notification-list'), `${n.read ? '' : '● '}${n.text}`, n.read ? [] : [['Đã đọc', () => request(`/api/notifications/${n.id}/read`, { method: 'POST' })]]);
    const { sessions } = await request('/api/auth/sessions');
    for (const s of sessions) row(document.querySelector('#session-list'), `${s.current ? 'Phiên hiện tại' : 'Phiên khác'} · hết hạn ${new Date(s.expiresAt).toLocaleDateString('vi-VN')}`, s.current ? [] : [['Thu hồi', () => request(`/api/auth/sessions/${s.id}`, { method: 'DELETE' })]]);
  }
  authView.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });
  document.querySelector('#account-form').onsubmit = async (event) => {
    event.preventDefault(); const button = document.querySelector('#auth-submit'); button.disabled = true;
    const data = Object.fromEntries(new FormData(event.target));
    try {
      if (mode === 'login') { const result = await request('/api/auth/login', { method: 'POST', body: data }); await loggedIn(result.user); }
      else if (mode === 'register') { await request('/api/auth/register', { method: 'POST', body: data }); setMode('login'); document.querySelector('#auth-message').textContent = 'Đăng ký thành công. Hãy đăng nhập.'; }
      else {
        const result = await request(mode === 'forgot' ? '/api/auth/forgot-password' : '/api/auth/reset-password', { method: 'POST', body: { ...data, token: resetToken } });
        if (mode === 'reset') { history.replaceState(null, '', location.pathname); setMode('login'); }
        document.querySelector('#auth-message').textContent = result.message;
      }
      document.querySelector('#auth-password').value = ''; document.querySelector('#auth-confirmPassword').value = '';
    } catch (error) { document.querySelector('#auth-message').textContent = error.message; }
    finally { button.disabled = false; }
  };
  document.querySelector('#logout-button').onclick = async () => { try { await request('/api/auth/logout', { method: 'POST' }); expire(); } catch (e) { notify(e.message); } };
  document.querySelector('#account-toggle').onclick = () => { dashboard.hidden = !dashboard.hidden; refreshSocial().catch((e) => notify(e.message)); };
  document.querySelector('#account-close').onclick = () => { dashboard.hidden = true; };
  document.querySelector('#refresh-public').onclick = () => refreshPublic().catch((e) => notify(e.message));
  document.querySelector('#friend-search-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const { users } = await request(`/api/friends/search?q=${encodeURIComponent(document.querySelector('#friend-query').value)}`);
      const list = document.querySelector('#friend-search-results'); list.replaceChildren();
      if (!users.length) row(list, 'Không tìm thấy người chơi.');
      for (const u of users) row(list, `${u.displayName} (@${u.username})`, [['Kết bạn', () => request('/api/friends/requests', { method: 'POST', body: { userId: u.id } })]]);
    } catch (error) { notify(error.message); }
  };
  document.querySelector('#profile-form').onsubmit = async (e) => {
    e.preventDefault();
    try { const result = await request('/api/me', { method: 'PATCH', body: { displayName: document.querySelector('#profile-name').value } }); user = result.user; document.querySelector('#account-name').textContent = user.displayName; document.querySelector('#display-name').value = user.displayName; notify('Đã lưu hồ sơ.'); }
    catch (error) { notify(error.message); }
  };
  setInterval(() => refreshSocial().catch(() => {}), 15000);
  return {
    request, expire,
    async init() {
      document.querySelector('#lobby').hidden = true;
      if (resetToken) { setMode('reset'); return; }
      try { const result = await request('/api/me'); await loggedIn(result.user); }
      catch (error) { setMode('login'); if (!error.message.includes('đăng nhập')) document.querySelector('#auth-message').textContent = error.message; }
    },
  };
}
