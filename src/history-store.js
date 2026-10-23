import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { MATCH_RESULT } from './constants.js';

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

export function createHistoryStore(filePath) {
  let records = [];
  let queue = Promise.resolve();

  async function persist(nextRecords) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryFile = `${filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryFile, JSON.stringify(nextRecords), 'utf8');
      await rename(temporaryFile, filePath);
    } catch (error) {
      await unlink(temporaryFile).catch(() => {});
      throw error;
    }
  }

  function append(record) {
    const operation = queue.then(async () => {
      const nextRecords = records.slice();
      const existing = nextRecords.findIndex((candidate) => candidate.id === record.id);
      if (existing >= 0) nextRecords[existing] = record;
      else nextRecords.push(record);
      await persist(nextRecords);
      records = nextRecords;
      return record;
    });
    // Keep later writes usable while returning this operation's failure to its caller.
    queue = operation.catch(() => {});
    return operation;
  }

  return {
    async load() {
      await queue;
      try {
        const contents = await readFile(filePath, 'utf8');
        const parsed = JSON.parse(contents);
        records = Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        records = [];
      }
      return records.length;
    },
    append,
    async save(record) {
      return append(record);
    },
    list(playerId) {
      return records
        .filter((record) => record.result && Number.isFinite(record.endedAt)
          && sideOf(record, playerId) !== null)
        .map((record) => summarize(record, playerId))
        .sort((first, second) => (second.endedAt ?? 0) - (first.endedAt ?? 0));
    },
    findActiveComputerMatch(playerId) {
      return records
        .filter((record) => record.mode === 'computer' && record.status === 'playing'
          && record.humanPlayerId === playerId)
        .sort((first, second) => (second.startedAt ?? 0) - (first.startedAt ?? 0))[0] ?? null;
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
