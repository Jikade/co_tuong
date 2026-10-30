import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

async function player(browser, baseURL, displayName, viewport) {
  const context = await browser.newContext({ baseURL, viewport, permissions: ['camera', 'microphone'] });
  const username = `layout_${randomUUID().slice(0, 8)}`;
  const data = { username, displayName, email: `${username}@example.test`, password: 'LayoutTest123', confirmPassword: 'LayoutTest123' };
  expect((await context.request.post('/api/auth/register', { data })).status()).toBe(201);
  expect((await context.request.post('/api/auth/login', { data })).status()).toBe(200);
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('#lobby')).toBeVisible();
  await expect(page.locator('#connection-label')).toHaveText('Đã kết nối');
  return { context, page };
}

async function panels(page, wanted) {
  for (const name of ['chat', 'video']) {
    const button = page.locator(`#${name}-toggle`);
    if ((await button.getAttribute('aria-expanded') === 'true') !== wanted.includes(name)) await button.click();
  }
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function geometry(page) {
  return page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector), rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right, nativeWidth: element.offsetWidth };
    };
    return {
      frame: box('.board-frame'), piece: box('.piece'), scene: box('.game-scene'), header: box('.room-banner'),
      host: box('#host-slot .player-avatar'), opponent: box('#opponent-slot .player-avatar'),
      tools: box('.game-tools'), dock: box('.game-sidebar'), chat: box('#realtime-panel'),
      video: box('#call-panel'), controls: box('.call-controls'),
      viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight },
    };
  });
}

async function screenshot(page, name) {
  await page.screenshot({ path: `artifacts/layout/${name}.png`, fullPage: true });
}

for (const viewport of [{ width: 1824, height: 862 }, { width: 1694, height: 900 }]) {
  test(`reference layout at ${viewport.width}×${viewport.height}: five columns, stable scene and complete panels`, async ({ browser, baseURL }) => {
    await mkdir('artifacts/layout', { recursive: true });
    const owner = await player(browser, baseURL, 'Minh Anh', viewport);
    const guest = await player(browser, baseURL, 'Thanh Sơn', viewport);
    const a = owner.page, b = guest.page, errors = [];
    a.on('pageerror', (error) => errors.push(error.message));
    b.on('pageerror', (error) => errors.push(error.message));
    try {
      await a.locator('#room-name').fill('Phòng cờ cùng bạn');
      await a.locator('#create-room-form button[type=submit]').click();
      await expect(a.locator('#room-view')).toBeVisible();
      const code = await a.locator('#room-code').innerText();
      const closed = await geometry(a);
      await panels(a, ['chat', 'video']);
      await screenshot(a, `desktop-waiting-${viewport.width}`);
      const waiting = await geometry(a);
      await writeFile(`artifacts/layout/metrics-${viewport.width}.json`, JSON.stringify(waiting, null, 2));
      expect(waiting.header.height).toBeLessThan(110);
      expect(waiting.header.x).toBeGreaterThan(viewport.width * .65);
      expect(waiting.host.right).toBeLessThan(waiting.frame.x);
      expect(waiting.frame.right).toBeLessThan(waiting.opponent.x);
      expect(waiting.opponent.right).toBeLessThan(waiting.tools.x);
      expect(waiting.tools.right).toBeLessThan(waiting.dock.x);
      expect(waiting.opponent.y - waiting.host.y).toBeGreaterThan(250);
      expect(waiting.frame.width).toBeGreaterThan(470);
      expect(Math.abs(waiting.frame.width - closed.frame.width)).toBeLessThan(1);
      expect(Math.abs(waiting.frame.width / waiting.frame.nativeWidth - waiting.piece.width / waiting.piece.nativeWidth)).toBeLessThan(.01);
      expect(waiting.controls.bottom).toBeLessThanOrEqual(waiting.video.bottom - 8);
      expect(waiting.viewport.scrollHeight).toBeLessThanOrEqual(viewport.height + 2);
      expect(waiting.viewport.scrollWidth).toBe(viewport.width);
      await expect(a.locator('#opponent-slot')).toContainText('Đang chờ người chơi');

      await b.locator('#room-code-input').fill(code);
      await b.locator('#join-room-form button[type=submit]').click();
      await expect(a.locator('#opponent-slot')).toContainText('Thanh Sơn');
      await a.locator('#ready-button').click(); await b.locator('#ready-button').click();
      await expect(a.locator('#start-button')).toBeEnabled(); await a.locator('#start-button').click();
      await expect(a.locator('#room-view')).toHaveAttribute('data-phase', 'playing');
      await panels(a, ['chat']); await screenshot(a, `desktop-chat-${viewport.width}`);
      const chatOnly = await geometry(a);
      await panels(a, ['video']); await screenshot(a, `desktop-video-${viewport.width}`);
      const videoOnly = await geometry(a);
      await panels(a, ['chat', 'video']);
      const both = await geometry(a);
      expect(Math.abs(chatOnly.frame.width - videoOnly.frame.width)).toBeLessThan(1);
      expect(Math.abs(videoOnly.frame.width - both.frame.width)).toBeLessThan(1);
      expect(Math.abs(chatOnly.frame.x - both.frame.x)).toBeLessThan(1);
      expect(Math.abs(chatOnly.frame.y - both.frame.y)).toBeLessThan(1);
      expect(both.chat.bottom).toBeLessThan(both.video.y);
      expect(both.controls.bottom).toBeLessThanOrEqual(both.video.bottom - 8);
      expect(both.video.bottom).toBeLessThanOrEqual(viewport.height);
      await expect(a.locator('#turn-clock')).toBeVisible();

      await a.locator('#call-start').click();
      await expect(b.locator('#incoming-call')).toBeVisible();
      await b.locator('#incoming-call-accept').click();
      await expect(a.locator('#call-status')).toHaveText('Đã kết nối', { timeout: 15000 });
      await expect(b.locator('#call-status')).toHaveText('Đã kết nối', { timeout: 15000 });
      await expect(a.locator('#toggle-audio')).toBeVisible();
      await expect(a.locator('#toggle-video')).toBeVisible();
      const connected = await geometry(a);
      expect(connected.controls.bottom).toBeLessThanOrEqual(connected.video.bottom - 8);
      expect(Math.abs(connected.frame.width - both.frame.width)).toBeLessThan(1);
      await screenshot(a, `desktop-call-${viewport.width}`);
      await a.locator('#call-end').click();
      await expect(b.locator('#call-status')).toHaveText('Đang chờ cuộc gọi');
      await expect(a.locator('#notice')).toBeHidden();
      await screenshot(a, `desktop-playing-${viewport.width}`);

      await b.locator('#room-settings-toggle').click();
      b.once('dialog', (dialog) => dialog.accept()); await b.locator('#resign-button').click();
      await expect(a.locator('#room-view')).toHaveAttribute('data-phase', 'finished');
      await expect(a.locator('#notice')).toBeHidden();
      await screenshot(a, `desktop-finished-${viewport.width}`);
      if (viewport.width === 1824) {
        await a.setViewportSize({ width: 1024, height: 768 });
        await screenshot(a, 'tablet-1024');
        expect((await geometry(a)).viewport.scrollWidth).toBe(1024);
        await a.setViewportSize({ width: 390, height: 844 });
        await screenshot(a, 'mobile-panels-390');
        const mobile = await geometry(a);
        expect(mobile.frame.width).toBeGreaterThan(340);
        expect(mobile.frame.x).toBeGreaterThanOrEqual(0);
        expect(mobile.frame.right).toBeLessThanOrEqual(390);
        expect(mobile.viewport.scrollWidth).toBe(390);
        await panels(a, []); await screenshot(a, 'mobile-390');
      }
      expect(errors).toEqual([]);
    } finally { await owner.context.close(); await guest.context.close(); }
  });
}
