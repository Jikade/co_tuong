import { expect } from '@playwright/test';
import { getLegalDestinations, toDisplayCoordinate } from '../../src/shared/game/xiangqi.js';

export async function expectMoveHints(page) {
  const board = await page.locator('.piece').evaluateAll((elements) => {
    const names = { Xe: 'rook', Mã: 'horse', Tượng: 'elephant', Sĩ: 'advisor', Tướng: 'king', Pháo: 'cannon', Tốt: 'pawn' };
    return elements.map((el) => {
      const [, name, color, column, row] = el.getAttribute('aria-label').match(/^(.*?) (Đỏ|Đen), cột (\d+), hàng (\d+)$/);
      return { id: el.dataset.pieceId, type: names[name], color: color === 'Đỏ' ? 'red' : 'black', x: Number(column) - 1, y: Number(row) - 1, selected: el.getAttribute('aria-pressed') === 'true' };
    });
  });
  const selected = board.find((p) => p.selected);
  expect(selected, 'selection must be active during the player turn').toBeTruthy();
  const expected = getLegalDestinations(board, selected.id);
  const key = (p) => `${p.x},${p.y}`;
  await expect.poll(async () => (await page.locator('.legal-move').evaluateAll((els) => els.map((el) => `${el.dataset.x},${el.dataset.y}`))).sort()).toEqual(expected.map(key).sort());
  for (const to of expected) {
    const marker = page.locator(`.legal-move[data-x="${to.x}"][data-y="${to.y}"]`);
    await expect(marker).toBeVisible();
    await expect(marker).toHaveCSS('pointer-events', 'none');
    const capture = board.some((p) => p.x === to.x && p.y === to.y);
    expect(await marker.evaluate((el) => el.classList.contains('capture'))).toBe(capture);
    const display = toDisplayCoordinate(to, selected.color === 'black');
    expect(await marker.evaluate((el) => ({ left: el.style.left, top: el.style.top }))).toEqual({ left: `${20 + display.x * 49}px`, top: `${20 + display.y * 49}px` });
  }
  return expected;
}
