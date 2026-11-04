import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import WebSocket from 'ws';

async function createUser(browser, baseURL, label) {
  const context = await browser.newContext({ baseURL });
  const username = `feature_${label}_${randomUUID().slice(0, 7)}`;
  const data = { username, displayName: `Feature ${label}`, email: `${username}@example.test`, password: 'Feature123', confirmPassword: 'Feature123' };
  expect((await context.request.post('/api/auth/register', { data })).status()).toBe(201);
  expect((await context.request.post('/api/auth/login', { data })).status()).toBe(200);
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('#connection-label')).toHaveText('Đã kết nối');
  return { context, page, data };
}

async function searchFriend(page, username) {
  if (await page.locator('#account-dashboard').isHidden()) await page.locator('#account-toggle').click();
  await page.locator('#friend-query').fill(username);
  await page.locator('#friend-search-form button').click();
  return page.locator('#friend-search-results .account-row').filter({ hasText: username });
}

async function createSession(baseURL, label) {
  const username = `feature_${label}_${randomUUID().slice(0, 7)}`;
  const data = { username, displayName: `Feature ${label}`, email: `${username}@example.test`, password: 'Feature123', confirmPassword: 'Feature123' };
  const register = await fetch(`${baseURL}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  expect(register.status).toBe(201);
  const login = await fetch(`${baseURL}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  expect(login.status).toBe(200);
  const session = login.headers.get('set-cookie')?.match(/cotuong_session=([^;,]+)/)?.[1];
  expect(session).toBeTruthy();
  return { data, session };
}

async function joinRoomSocket(baseURL, participant, roomCode) {
  const socket = new WebSocket(`${baseURL.replace(/^http/, 'ws')}/ws`, {
    headers: { Cookie: `cotuong_session=${participant.session}`, Origin: baseURL },
  });
  const messages = [];
  socket.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  socket.send(JSON.stringify({ action: 'join-room', roomCode }));
  await expect.poll(() => messages.some((message) => message.type === 'room-state' && message.room.code === roomCode)).toBe(true);
  return { socket, messages };
}

test('friend search shows send, receive, cancel and accepted relationship states with usernames', async ({ browser, baseURL }) => {
  const a = await createUser(browser, baseURL, 'sender');
  const b = await createUser(browser, baseURL, 'receiver');
  try {
    let result = await searchFriend(a.page, b.data.username);
    await expect(result).toContainText('Chưa kết bạn');
    await result.getByRole('button', { name: 'Kết bạn' }).click();
    result = a.page.locator('#friend-search-results .account-row').filter({ hasText: b.data.username });
    await expect(result).toContainText('Đã gửi lời mời');
    await expect(result.getByRole('button', { name: 'Hủy lời mời' })).toBeVisible();

    await b.page.locator('#account-toggle').click();
    const incoming = b.page.locator('#friend-requests .account-row');
    await expect(incoming).toContainText(`Feature sender (@${a.data.username})`);
    await expect(incoming.getByRole('button', { name: 'Chấp nhận' })).toBeVisible();

    await result.getByRole('button', { name: 'Hủy lời mời' }).click();
    await expect(a.page.locator('#friend-search-results .account-row')).toContainText('Chưa kết bạn');
    await expect(b.page.locator('#friend-requests')).not.toContainText(a.data.username);

    result = await searchFriend(a.page, b.data.username);
    await result.getByRole('button', { name: 'Kết bạn' }).click();
    const incomingSearch = await searchFriend(b.page, a.data.username);
    await expect(incomingSearch).toContainText('Có lời mời kết bạn');
    await incomingSearch.getByRole('button', { name: 'Chấp nhận' }).click();
    await expect(b.page.locator('#friend-search-results .account-row')).toContainText('Đã là bạn bè');
    await a.page.locator('#friend-search-form button').click();
    result = a.page.locator('#friend-search-results .account-row').filter({ hasText: b.data.username });
    await expect(result).toContainText('Đã là bạn bè');
    await expect(result.getByRole('button')).toHaveCount(0);
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test('dismissing remove-player confirmation leaves the room unchanged', async ({ browser, baseURL }) => {
  test.setTimeout(20000);
  const host = await createUser(browser, baseURL, 'host');
  const opponent = await createSession(baseURL, 'opponent');
  const spectator = await createSession(baseURL, 'spectator');
  let opponentConnection;
  let spectatorConnection;
  try {
    const sentActions = [];
    host.page.on('websocket', (webSocket) => webSocket.on('framesent', ({ payload }) => {
      try { sentActions.push(JSON.parse(payload).action); } catch { /* Ignore non-JSON WebSocket frames. */ }
    }));
    await host.page.locator('#room-name').fill('Confirmation room');
    await host.page.locator('#create-room-form button').click();
    await expect(host.page.locator('#room-view')).toBeVisible();
    const code = (await host.page.locator('#room-code').innerText()).trim();
    opponentConnection = await joinRoomSocket(baseURL, opponent, code);
    spectatorConnection = await joinRoomSocket(baseURL, spectator, code);
    await expect(host.page.locator('#spectator-list')).toContainText('Feature spectator');

    await host.page.locator('#spectators-toggle').click();
    host.page.once('dialog', (dialog) => dialog.dismiss());
    await host.page.getByRole('button', { name: 'Mời rời phòng' }).click();
    await expect(host.page.locator('#spectator-list')).toContainText('Feature spectator');
    await expect(host.page.locator('#spectator-count')).toHaveText('1/10');
    await expect(host.page.locator('#room-code')).toHaveText(code);
    expect(sentActions).not.toContain('kick-member');
    expect(spectatorConnection.messages.some((message) => message.type === 'room-closed' && message.reason === 'kicked')).toBe(false);
  } finally {
    const socketClosures = [opponentConnection?.socket, spectatorConnection?.socket].filter(Boolean).map((socket) => {
      const closed = once(socket, 'close');
      socket.terminate();
      return closed;
    });
    await Promise.all(socketClosures);
    await host.context.close();
  }
});

test('host can kick the opponent before a match and only the host sees that control', async ({ browser, baseURL }) => {
  const host = await createUser(browser, baseURL, 'kick-host');
  const opponent = await createSession(baseURL, 'kick-opponent');
  const opponentContext = await browser.newContext({ baseURL });
  try {
    await opponentContext.addCookies([{ name: 'cotuong_session', value: opponent.session, url: baseURL }]);
    const opponentPage = await opponentContext.newPage();
    await opponentPage.goto('/');
    await expect(opponentPage.locator('#connection-label')).toHaveText('Đã kết nối');

    await host.page.locator('#room-name').fill('Opponent kick room');
    await host.page.locator('#create-room-form button').click();
    await expect(host.page.locator('#room-view')).toBeVisible();
    const code = (await host.page.locator('#room-code').innerText()).trim();
    await opponentPage.locator('#display-name').fill(opponent.data.displayName);
    await opponentPage.locator('#room-code-input').fill(code);
    await opponentPage.locator('#join-room-form button').click();
    await expect(opponentPage.locator('#room-view')).toBeVisible();
    await expect(host.page.locator('#kick-opponent')).toBeVisible();
    await expect(opponentPage.locator('#kick-opponent')).toBeHidden();

    host.page.once('dialog', (dialog) => dialog.accept());
    await host.page.locator('#kick-opponent').click();
    await expect(host.page.locator('#opponent-slot .empty-avatar')).toBeVisible();
    await expect(host.page.locator('#kick-opponent')).toBeHidden();
    await expect(opponentPage.locator('#lobby')).toBeVisible();
  } finally {
    await opponentContext.close();
    await host.context.close();
  }
});
