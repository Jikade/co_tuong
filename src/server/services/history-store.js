import { MATCH_RESULT } from '../../shared/game/constants.js';

function sideOf(record, playerId) {
  if (record.players?.red?.id === playerId) return 'red';
  if (record.players?.black?.id === playerId) return 'black';
  return null;
}

function outcomeFor(record, playerId) {
  const outcome = record.result?.outcome;
  if (outcome === MATCH_RESULT.DRAW) return 'draw';
  if (outcome === MATCH_RESULT.VOIDED) return 'voided';
  const side = sideOf(record, playerId);
  if (!side) return outcome ?? 'unknown';
  return outcome === `${side}-win` ? 'win' : 'lose';
}

function summarize(record, playerId) {
  const side = sideOf(record, playerId);
  const opponent = side ? record.players[side === 'red' ? 'black' : 'red'] : null;
  return {
    id: record.id,
    roomCode: record.roomCode,
    roomName: record.roomName,
    mode: record.mode ?? 'online',
    side,
    opponentName: opponent?.name ?? '',
    outcome: outcomeFor(record, playerId),
    reason: record.result?.reason ?? null,
    startedAt: record.startedAt ?? null,
    endedAt: record.endedAt ?? null,
    durationMs: Math.max(0, (record.endedAt ?? 0) - (record.startedAt ?? 0)),
    moveCount: record.moves?.length ?? 0,
  };
}

export function createHistoryStore(matchRepository) {
  if (!matchRepository || typeof matchRepository.loadAll !== 'function'
      || typeof matchRepository.upsert !== 'function') {
    throw new TypeError('History store cần match repository loadAll/upsert.');
  }

  let records = [];
  let queue = Promise.resolve();

  function append(record) {
    const operation = queue.then(async () => {
      await matchRepository.upsert(record);
      const next = records.slice();
      const index = next.findIndex((item) => item.id === record.id);
      if (index >= 0) next[index] = record;
      else next.push(record);
      records = next;
      return record;
    });
    queue = operation.catch(() => {});
    return operation;
  }

  return {
    async load() {
      await queue;
      const loaded = await matchRepository.loadAll();
      records = Array.isArray(loaded) ? loaded : [];
      return records.length;
    },
    append,
    save: append,
    list(playerId) {
      return records
        .filter((record) => record.result && Number.isFinite(record.endedAt)
          && sideOf(record, playerId) !== null)
        .map((record) => summarize(record, playerId))
        .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
    },
    findActiveComputerMatch(playerId) {
      return records
        .filter((record) => record.mode === 'computer' && record.status === 'playing'
          && record.humanPlayerId === playerId)
        .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))[0] ?? null;
    },
    activeComputerMatches() {
      return records.filter((record) => record.mode === 'computer' && record.status === 'playing');
    },
    find(id) {
      return records.find((record) => record.id === id) ?? null;
    },
    get size() {
      return records.length;
    },
  };
}
