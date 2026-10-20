const backRank = ['rook', 'horse', 'elephant', 'advisor', 'king', 'advisor', 'elephant', 'horse', 'rook'];

export function createInitialPieces() {
  const pieces = [];
  for (const color of ['black', 'red']) {
    const backRow = color === 'black' ? 0 : 9;
    const cannonRow = color === 'black' ? 2 : 7;
    const pawnRow = color === 'black' ? 3 : 6;

    backRank.forEach((type, x) => {
      pieces.push({ id: `${color}-${type}-${x}`, type, color, x, y: backRow });
    });
    for (const x of [1, 7]) {
      pieces.push({ id: `${color}-cannon-${x}`, type: 'cannon', color, x, y: cannonRow });
    }
    for (const x of [0, 2, 4, 6, 8]) {
      pieces.push({ id: `${color}-pawn-${x}`, type: 'pawn', color, x, y: pawnRow });
    }
  }
  return pieces;
}

function pieceAt(pieces, x, y) {
  return pieces.find((piece) => piece.x === x && piece.y === y);
}

function inBounds(x, y) {
  return x >= 0 && x <= 8 && y >= 0 && y <= 9;
}

function inPalace(color, x, y) {
  return x >= 3 && x <= 5 && (color === 'red' ? y >= 7 : y <= 2);
}

function riverCrossed(color, y) {
  return color === 'red' ? y <= 4 : y >= 5;
}

function piecesBetween(pieces, from, to) {
  let count = 0;
  const stepX = Math.sign(to.x - from.x);
  const stepY = Math.sign(to.y - from.y);
  let x = from.x + stepX;
  let y = from.y + stepY;
  while (x !== to.x || y !== to.y) {
    if (pieceAt(pieces, x, y)) count += 1;
    x += stepX;
    y += stepY;
  }
  return count;
}

function movementMatches(pieces, piece, to, target) {
  const dx = to.x - piece.x;
  const dy = to.y - piece.y;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);

  switch (piece.type) {
    case 'rook':
      return (dx === 0 || dy === 0) && piecesBetween(pieces, piece, to) === 0;
    case 'horse': {
      if (!((ax === 2 && ay === 1) || (ax === 1 && ay === 2))) return false;
      const legX = ax === 2 ? piece.x + Math.sign(dx) : piece.x;
      const legY = ay === 2 ? piece.y + Math.sign(dy) : piece.y;
      return !pieceAt(pieces, legX, legY);
    }
    case 'elephant': {
      if (ax !== 2 || ay !== 2) return false;
      const eye = pieceAt(pieces, piece.x + dx / 2, piece.y + dy / 2);
      if (eye || (piece.color === 'red' ? to.y < 5 : to.y > 4)) return false;
      return true;
    }
    case 'advisor':
      return ax === 1 && ay === 1 && inPalace(piece.color, to.x, to.y);
    case 'king': {
      if (ax + ay === 1 && inPalace(piece.color, to.x, to.y)) return true;
      return target?.type === 'king' && dx === 0 && piecesBetween(pieces, piece, to) === 0;
    }
    case 'cannon': {
      if (dx !== 0 && dy !== 0) return false;
      const screens = piecesBetween(pieces, piece, to);
      return target ? screens === 1 : screens === 0;
    }
    case 'pawn': {
      const forward = piece.color === 'red' ? -1 : 1;
      if (dx === 0 && dy === forward) return true;
      return riverCrossed(piece.color, piece.y) && ax === 1 && dy === 0;
    }
    default:
      return false;
  }
}

export function isInCheck(pieces, color) {
  const king = pieces.find((piece) => piece.type === 'king' && piece.color === color);
  if (!king) return true;
  return pieces.some((piece) =>
    piece.color !== color && movementMatches(pieces, piece, king, king),
  );
}

export function applyLegalMove(pieces, pieceId, to) {
  if (!Number.isInteger(to?.x) || !Number.isInteger(to?.y) || !inBounds(to.x, to.y)) return null;
  const piece = pieces.find((candidate) => candidate.id === pieceId);
  if (!piece) return null;
  const target = pieceAt(pieces, to.x, to.y);
  if (target?.color === piece.color || target?.type === 'king') return null;
  if (!movementMatches(pieces, piece, to, target)) return null;

  const next = pieces
    .filter((candidate) => candidate.id !== pieceId && candidate.id !== target?.id)
    .map((candidate) => ({ ...candidate }));
  next.push({ ...piece, x: to.x, y: to.y });
  if (isInCheck(next, piece.color)) return null;
  return { pieces: next, capturedPiece: target ? { ...target } : null };
}

export function hasLegalMove(pieces, color) {
  for (const piece of pieces) {
    if (piece.color !== color) continue;
    for (let y = 0; y <= 9; y++) {
      for (let x = 0; x <= 8; x++) {
        if (applyLegalMove(pieces, piece.id, { x, y })) return true;
      }
    }
  }
  return false;
}

export function getTurnStatus(pieces, color) {
  const inCheck = isInCheck(pieces, color);
  const canMove = hasLegalMove(pieces, color);
  return {
    inCheck,
    hasLegalMove: canMove,
    winner: canMove ? null : color === 'red' ? 'black' : 'red',
    reason: canMove ? null : inCheck ? 'checkmate' : 'no-legal-moves',
  };
}
