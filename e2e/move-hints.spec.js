import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { expectMoveHints } from './helpers/move-hints.js';

async function user(browser, baseURL, mobile = false) {
  const context = await browser.newContext({ baseURL, viewport: mobile ? { width: 390, height: 844 } : { width: 1694, height: 1000 }, ...(mobile && { isMobile: true, hasTouch: true }) });
  const name = `hints_${randomUUID().slice(0, 8)}`;
  const data = { username: name, displayName: name, email: `${name}@example.test`, password: 'HintPass123', confirmPassword: 'HintPass123' };
  expect((await context.request.post('/api/auth/register', { data })).status()).toBe(201);
  expect((await context.request.post('/api/auth/login', { data })).status()).toBe(200);
  const page = await context.newPage(), errors = [], control = { hold: false, release: null };
  page.on('pageerror', (e) => errors.push(e.message));
  await page.routeWebSocket('**/ws', (route) => {
    const server = route.connectToServer();
    route.onMessage((message) => {
      if (control.hold && JSON.parse(message.toString()).action === 'move') control.release = () => { control.release = null; server.send(message); };
      else server.send(message);
    });
  });
  await page.goto('/'); await expect(page.locator('#connection-label')).toHaveText('Đã kết nối');
  return { page, context, errors, control, mobile };
}

const piece = (page, id) => page.locator(`.piece[data-piece-id="${id}"]`);
async function select(u, id) { const target = piece(u.page, id); if (u.mobile) await target.tap(); else await target.click(); return expectMoveHints(u.page); }
async function cell(page, x, y, black = false) {
  const canvas = page.locator('#board-canvas'), box = await canvas.boundingBox(), size = await canvas.evaluate((e) => ({ width: e.width, height: e.height }));
  await page.mouse.click(box.x + (20 + (black ? 8 - x : x) * 49) / size.width * box.width, box.y + (20 + (black ? 9 - y : y) * 49) / size.height * box.height);
}
async function chooseAllTypes(u, side) {
  for (const suffix of ['rook-0', 'horse-1', 'elephant-2', 'advisor-3', 'king-4', 'cannon-1', 'pawn-0']) await select(u, `${side}-${suffix}`);
}

test('PvP hints: both colors/all pieces, capture rings, pending, rejection, reconnect, spectator and replay', async ({ browser, baseURL }) => {
  const users = [];
  try {
    const a = await user(browser, baseURL), b = await user(browser, baseURL, true), s = await user(browser, baseURL); users.push(a, b, s);
    await a.page.locator('#room-name').fill('Move hints QA');
    await a.page.locator('#create-room-form button[type=submit]').click();
    await expect(a.page.locator('#room-view')).toBeVisible(); const code = await a.page.locator('#room-code').innerText();
    for (const u of [b, s]) { await u.page.locator('#room-code-input').fill(code); await u.page.locator('#join-room-form button[type=submit]').click(); await expect(u.page.locator('#room-view')).toBeVisible(); }
    for (const u of users) await expect(u.page.locator('.legal-move')).toHaveCount(0);
    await expect(s.page.locator('#my-role')).toHaveText('Khán giả');
    await a.page.locator('#ready-button').click(); await b.page.locator('#ready-button').click(); await a.page.locator('#start-button').click();
    for (const u of users) await expect(u.page.locator('#room-view')).toHaveAttribute('data-phase', 'playing');
    const red = (await a.page.locator('#host-slot').getAttribute('data-side')) === 'red' ? a : b, black = red === a ? b : a;
    await expect(black.page.locator('.piece').first()).toBeDisabled(); await expect(black.page.locator('.legal-move')).toHaveCount(0);
    await s.page.locator('.piece').first().dispatchEvent('click'); await expect(s.page.locator('.legal-move')).toHaveCount(0);
    const dimensions = await red.page.locator('#board-canvas').boundingBox();
    await chooseAllTypes(red, 'red');
    await select(red, 'red-cannon-1');
    await expect(red.page.locator('.legal-move.capture[data-x="1"][data-y="0"]')).toHaveCount(1);
    await red.page.screenshot({ path: 'artifacts/move-hints/pvp-capture-red.png', fullPage: true });
    expect(await red.page.locator('#board-canvas').boundingBox()).toEqual(dimensions);
    // Clicking the selected piece again clears it; keyboard Escape does too.
    if (red.mobile) await piece(red.page, 'red-cannon-1').tap(); else await piece(red.page, 'red-cannon-1').click();
    await expect(red.page.locator('.legal-move')).toHaveCount(0); await expect(red.page.locator('.piece.selected')).toHaveCount(0);
    await select(red, 'red-rook-0'); await red.page.keyboard.press('Escape'); await expect(red.page.locator('.legal-move')).toHaveCount(0);
    await select(red, 'red-pawn-0');
    // An illegal empty destination still goes to the authoritative server.
    await expect(red.page.locator('.legal-move[data-x="0"][data-y="4"]')).toHaveCount(0);
    await cell(red.page, 0, 4); await expect(red.page.locator('#notice')).toContainText('Nước đi không hợp lệ');
    await expect(red.page.locator('#move-history li')).toHaveCount(0); await expectMoveHints(red.page);
    red.control.hold = true;
    await cell(red.page, 0, 5); await expect.poll(() => Boolean(red.control.release)).toBe(true);
    await expect(red.page.locator('.legal-move')).toHaveCount(0); await expect(red.page.locator('.piece').first()).toBeDisabled();
    red.control.hold = false; red.control.release();
    await expect(red.page.locator('#move-history li')).toHaveCount(1); await expect(red.page.locator('.legal-move')).toHaveCount(0);
    await chooseAllTypes(black, 'black');
    await select(black, 'black-cannon-1'); await black.page.screenshot({ path: 'artifacts/move-hints/pvp-capture-black.png', fullPage: true });
    await black.context.setOffline(true); await expect(black.page.locator('.legal-move')).toHaveCount(0);
    await black.context.setOffline(false); await expect(black.page.locator('#connection-label')).toHaveText('Đã kết nối');
    await expect(black.page.locator('#room-view')).toHaveAttribute('data-phase', 'playing'); await expect(black.page.locator('.legal-move')).toHaveCount(0);
    await select(black, 'black-pawn-0'); await cell(black.page, 0, 4, true); await expect(red.page.locator('#move-history li')).toHaveCount(2);
    await select(red, 'red-pawn-0'); await expect(red.page.locator('.legal-move.capture[data-x="0"][data-y="4"]')).toHaveCount(1);
    // Capture uses the piece underneath the pointer-transparent ring.
    await piece(red.page, 'black-pawn-0').click(); await expect(red.page.locator('#move-history li')).toHaveCount(3);
    await expect(piece(red.page, 'black-pawn-0')).toHaveCount(0); await expect(red.page.locator('.legal-move')).toHaveCount(0);
    await select(black, 'black-cannon-1');
    await black.page.locator('#room-settings-toggle').click(); black.page.once('dialog', (d) => d.accept()); await black.page.locator('#resign-button').click();
    for (const u of users) { await expect(u.page.locator('#room-view')).toHaveAttribute('data-phase', 'finished'); await expect(u.page.locator('.legal-move')).toHaveCount(0); }
    await red.page.locator('#history-button').click(); await red.page.locator('#history-list button').first().click();
    await expect(red.page.locator('#replay-bar')).toBeVisible(); await red.page.locator('.piece').first().dispatchEvent('click');
    await expect(red.page.locator('.legal-move')).toHaveCount(0); await red.page.locator('#replay-last').click(); await expect(red.page.locator('.legal-move')).toHaveCount(0);
    for (const u of users) expect(u.errors).toEqual([]);
  } finally { await Promise.all(users.map((u) => u.context.close())); }
});

test('mobile PvE touch hints update selection and clear through AI turn, reload and finish', async ({ browser, baseURL }) => {
  const u = await user(browser, baseURL, true), page = u.page;
  try {
    await page.locator('#computer-play-button').tap(); await page.locator('[data-computer-side="red"]').tap();
    await expect(page.locator('#room-view')).toHaveAttribute('data-phase', 'playing');
    await chooseAllTypes(u, 'red');
    await select(u, 'red-cannon-1'); await page.screenshot({ path: 'artifacts/move-hints/mobile-pve-hints.png', fullPage: true });
    await piece(page, 'red-cannon-1').tap(); await expect(page.locator('.legal-move')).toHaveCount(0);
    await select(u, 'red-pawn-0'); await cell(page, 0, 5);
    await expect(page.locator('.legal-move')).toHaveCount(0); await expect(page.locator('#move-history li')).toHaveCount(2);
    await select(u, 'red-pawn-0'); await page.reload(); await expect(page.locator('#room-view')).toHaveAttribute('data-phase', 'playing');
    await expect(page.locator('.legal-move')).toHaveCount(0); await select(u, 'red-cannon-1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#room-settings-toggle').tap(); page.once('dialog', (d) => d.accept()); await page.locator('#resign-button').tap();
    await expect(page.locator('#room-view')).toHaveAttribute('data-phase', 'finished'); await expect(page.locator('.legal-move')).toHaveCount(0);
    expect(u.errors).toEqual([]);
  } finally { await u.context.close(); }
});
