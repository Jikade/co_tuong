const types = new Set(['king', 'advisor', 'elephant', 'horse', 'rook', 'cannon', 'pawn']);
function validPieces(pieces) {
  return Array.isArray(pieces) && pieces.length >= 2 && pieces.length <= 32
    && pieces.every((p) => p && typeof p.id === 'string' && types.has(p.type) && ['red', 'black'].includes(p.color)
      && Number.isInteger(p.x) && p.x >= 0 && p.x <= 8 && Number.isInteger(p.y) && p.y >= 0 && p.y <= 9)
    && new Set(pieces.map((p) => p.id)).size === pieces.length
    && new Set(pieces.map((p) => `${p.x},${p.y}`)).size === pieces.length
    && ['red', 'black'].every((side) => pieces.filter((p) => p.type === 'king' && p.color === side).length === 1);
}
export function assertActiveSnapshot(match) {
  if (!match || !['playing', 'paused'].includes(match.status)) return;
  if (typeof match.id !== 'string' || typeof match.redPlayerId !== 'string' || typeof match.blackPlayerId !== 'string'
      || match.redPlayerId === match.blackPlayerId || !['red', 'black'].includes(match.currentSide)
      || !validPieces(match.pieces) || !validPieces(match.initialPieces)
      || !Array.isArray(match.history) || !Array.isArray(match.capturedPieces)) {
    throw new Error('Invalid persisted match snapshot. Restore valid saved data before restarting; no new board was created.');
  }
}
