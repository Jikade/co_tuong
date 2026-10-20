import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLegalMove,
  createInitialPieces,
  getTurnStatus,
  isInCheck,
} from '../src/xiangqi.js';

test('creates the standard 32-piece starting position', () => {
  const pieces = createInitialPieces();
  assert.equal(pieces.length, 32);
  assert.equal(pieces.filter((piece) => piece.color === 'red').length, 16);
  assert.equal(pieces.filter((piece) => piece.color === 'black').length, 16);
  assert.ok(pieces.some((piece) => piece.id === 'red-pawn-0' && piece.x === 0 && piece.y === 6));
});

test('enforces rook paths, horse legs, elephant eyes, river and palace rules', () => {
  const pieces = createInitialPieces();
  assert.equal(applyLegalMove(pieces, 'red-rook-0', { x: 2, y: 9 }), null);
  assert.equal(applyLegalMove(pieces, 'red-horse-1', { x: 3, y: 8 }), null);
  assert.equal(applyLegalMove(pieces, 'red-advisor-3', { x: 2, y: 8 }), null);

  const blockedEye = [
    { id: 'red-king', type: 'king', color: 'red', x: 4, y: 9 },
    { id: 'black-king', type: 'king', color: 'black', x: 3, y: 0 },
    { id: 'red-elephant', type: 'elephant', color: 'red', x: 2, y: 9 },
    { id: 'eye-blocker', type: 'pawn', color: 'black', x: 3, y: 8 },
  ];
  assert.equal(applyLegalMove(blockedEye, 'red-elephant', { x: 4, y: 7 }), null);

  const riverBlocked = [
    { id: 'red-king', type: 'king', color: 'red', x: 4, y: 9 },
    { id: 'black-king', type: 'king', color: 'black', x: 3, y: 0 },
    { id: 'red-elephant', type: 'elephant', color: 'red', x: 2, y: 6 },
  ];
  assert.equal(applyLegalMove(riverBlocked, 'red-elephant', { x: 4, y: 4 }), null);
});

test('allows cannon captures only across one screen', () => {
  const pieces = [
    { id: 'red-king', type: 'king', color: 'red', x: 4, y: 9 },
    { id: 'black-king', type: 'king', color: 'black', x: 4, y: 0 },
    { id: 'red-cannon', type: 'cannon', color: 'red', x: 0, y: 5 },
    { id: 'screen', type: 'pawn', color: 'black', x: 0, y: 4 },
    { id: 'target', type: 'pawn', color: 'black', x: 0, y: 2 },
    { id: 'king-file-blocker', type: 'pawn', color: 'red', x: 4, y: 5 },
  ];
  const capture = applyLegalMove(pieces, 'red-cannon', { x: 0, y: 2 });
  assert.equal(capture?.capturedPiece.id, 'target');
  assert.equal(
    applyLegalMove([...pieces, { id: 'second-screen', type: 'pawn', color: 'red', x: 0, y: 3 }], 'red-cannon', { x: 0, y: 2 }),
    null,
  );
});

test('rejects a move that exposes the two kings or leaves its king in check', () => {
  const pieces = [
    { id: 'red-king', type: 'king', color: 'red', x: 4, y: 9 },
    { id: 'black-king', type: 'king', color: 'black', x: 4, y: 0 },
    { id: 'blocker', type: 'rook', color: 'red', x: 4, y: 5 },
  ];
  assert.equal(applyLegalMove(pieces, 'blocker', { x: 3, y: 5 }), null);

  const checked = [
    { id: 'red-king', type: 'king', color: 'red', x: 4, y: 9 },
    { id: 'black-king', type: 'king', color: 'black', x: 3, y: 0 },
    { id: 'black-rook', type: 'rook', color: 'black', x: 4, y: 5 },
    { id: 'red-pawn', type: 'pawn', color: 'red', x: 0, y: 6 },
  ];
  assert.equal(isInCheck(checked, 'red'), true);
  assert.equal(applyLegalMove(checked, 'red-pawn', { x: 0, y: 5 }), null);
});

test('reports check and a loss when a side has no legal moves', () => {
  const pieces = [
    { id: 'red-king', type: 'king', color: 'red', x: 4, y: 9 },
    { id: 'black-king', type: 'king', color: 'black', x: 3, y: 0 },
    { id: 'black-rook', type: 'rook', color: 'black', x: 4, y: 8 },
    { id: 'black-rook-2', type: 'rook', color: 'black', x: 3, y: 8 },
    { id: 'black-rook-3', type: 'rook', color: 'black', x: 5, y: 8 },
  ];
  const status = getTurnStatus(pieces, 'red');
  assert.equal(status.inCheck, true);
  assert.equal(status.hasLegalMove, false);
  assert.equal(status.winner, 'black');
  assert.equal(status.reason, 'checkmate');
});
