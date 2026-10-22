import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
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

  function persist() {
    const contents = JSON.stringify(records);
    queue = queue.then(async () => {
      await mkdir(path.dirname(filePath), { recursive: true });
      const temporaryFile = `${filePath}.${randomUUID()}.tmp`;
      await writeFile(temporaryFile, contents, 'utf8');
      await rename(temporaryFile, filePath);
    });
    return queue.catch((error) => {
      console.error('Could not persist match history:', error);
    });
  }

  return {
    async load() {
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
    async append(record) {
      const existing = records.findIndex((candidate) => candidate.id === record.id);
      if (existing >= 0) records[existing] = record;
      else records.push(record);
      await persist();
      return record;
    },
    list(playerId) {
      return records
        .filter((record) => sideOf(record, playerId) !== null)
        .map((record) => summarize(record, playerId))
        .sort((first, second) => (second.endedAt ?? 0) - (first.endedAt ?? 0));
    },
    find(id) {
      return records.find((record) => record.id === id) ?? null;
    },
    get size() {
      return records.length;
    },
  };
}
