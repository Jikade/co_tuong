import { test, expect } from '@playwright/test';

async function signUp(page, name) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(name);
  await page.locator('#auth-displayName').fill(name);
  await page.getByLabel('Email', { exact: true }).fill(`${name}@example.test`);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Browser123');
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('Browser123');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.locator('#auth-message')).toContainText('Đăng ký thành công');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Browser123');
  await page.locator('#auth-submit').click();
  await expect(page.locator('#lobby')).toBeVisible();
  await expect(page.locator('#connection-label')).toHaveText('Đã kết nối');
}

test('two browser sessions play, chat privately, reconnect, finish, replay and log out', async ({ browser }) => {
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['camera', 'microphone'] });
  const ctxB = await browser.newContext({ viewport: { width: 1366, height: 1000 }, permissions: ['camera', 'microphone'] });
  const a = await ctxA.newPage(), b = await ctxB.newPage();
  const errors = []; a.on('pageerror', (e) => errors.push(e.message)); b.on('pageerror', (e) => errors.push(e.message));
  try {
    await signUp(a, 'browser_alice'); await signUp(b, 'browser_bob');
    await a.locator('#room-name').fill('Bàn cờ tích hợp');
    await a.locator('#create-room-form button[type=submit]').click();
    await expect(a.locator('#room-view')).toBeVisible();
    const code = await a.locator('#room-code').innerText();
    await b.locator('#room-code-input').fill(code);
    await b.locator('#join-room-form button[type=submit]').click();
    await expect(b.locator('#room-view')).toBeVisible();
    await a.locator('#ready-button').click(); await b.locator('#ready-button').click();
    await expect(a.locator('#start-button')).toBeEnabled(); await a.locator('#start-button').click();
    await expect(a.locator('#room-view')).toHaveAttribute('data-phase', 'playing');
    await expect(b.locator('#room-view')).toHaveAttribute('data-phase', 'playing');
    await a.getByRole('button', { name: 'Tốt Đỏ, cột 1, hàng 7', exact: true }).click();
    await expect(a.locator('.legal-move')).toHaveCount(1);
    // Board canvas coordinates are transformed by the responsive scene scale.
    const canvas = a.locator('#board-canvas');
    const box = await canvas.boundingBox();
    const size = await canvas.evaluate((el) => ({ width: el.width, height: el.height }));
    await canvas.click({ position: { x: 20 / size.width * box.width, y: (20 + 5 * 49) / size.height * box.height } });
    await expect(a.locator('#move-history li')).toHaveCount(1);
    await expect(b.locator('#move-history li')).toHaveCount(1);
    await a.locator('#chat-toggle').click(); await b.locator('#chat-toggle').click();
    await a.locator('#chat-input').fill('Chào đối thủ!'); await a.locator('#chat-form button').click();
    await expect(b.locator('#chat-messages')).toContainText('Chào đối thủ!');
    await a.locator('[data-close-panel="chat"]').click();
    await a.locator('#video-toggle').click(); await a.locator('#call-start').click();
    await expect(b.locator('#incoming-call')).toBeVisible();
    await b.locator('#incoming-call-reject').click();
    await expect(b.locator('#incoming-call')).toBeHidden();
    await a.locator('#call-start').click();
    await expect(b.locator('#incoming-call')).toBeVisible();
    await b.locator('#incoming-call-accept').click();
    await expect(a.locator('#call-status')).toHaveText('Đã kết nối', { timeout: 15000 });
    await expect(b.locator('#call-status')).toHaveText('Đã kết nối', { timeout: 15000 });
    await a.locator('#toggle-audio').click();
    await expect(a.locator('#toggle-audio')).toHaveText('Bật micro');
    await a.locator('#call-end').click();
    await expect(b.locator('#call-status')).toHaveText('Đang chờ cuộc gọi');
    await b.reload();
    await expect(b.locator('#room-view')).toHaveAttribute('data-phase', 'playing');
    await expect(b.locator('#move-history li')).toHaveCount(1);
    await a.screenshot({ path: 'test-results/integration-desktop.png', fullPage: true });
    await b.locator('#room-settings-toggle').click();
    b.once('dialog', (d) => d.accept()); await b.locator('#resign-button').click();
    await expect(a.locator('#room-view')).toHaveAttribute('data-phase', 'finished');
    await a.locator('#history-button').click();
    await expect(a.locator('#history-list li')).toHaveCount(1);
    await a.locator('#history-list button').click();
    await expect(a.locator('#replay-bar')).toBeVisible();
    await a.locator('#replay-next').click();
    await a.locator('#logout-button').click();
    await expect(a.locator('#auth-view')).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await ctxA.close(); await ctxB.close(); }
});

test('mobile account flow fits the viewport and computer play displays legal moves', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  try {
    await signUp(page, 'mobile_player');
    await expect(page.locator('#account-toggle')).toBeVisible();
    await page.locator('#computer-play-button').click();
    await page.locator('[data-computer-side="black"]').click();
    await expect(page.locator('#room-view')).toHaveAttribute('data-phase', 'playing');
    await expect(page.locator('#move-history li')).toHaveCount(1);
    await page.getByRole('button', { name: 'Tốt Đen, cột 1, hàng 4', exact: true }).click();
    await expect(page.locator('.legal-move')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/integration-mobile.png', fullPage: true });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
