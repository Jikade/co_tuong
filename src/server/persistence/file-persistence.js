import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

// One atomic snapshot for local development; a failed write leaves the prior state intact.
export function createFilePersistence(filename = path.resolve('data/integration.json')) {
  let state = { rooms: [], matches: [], accounts: {} };
  let queue = Promise.resolve();
  function update(fn) {
    const operation = queue.then(async () => {
      const next = structuredClone(state);
      fn(next);
      await mkdir(path.dirname(filename), { recursive: true });
      const temporary = `${filename}.tmp`;
      await writeFile(temporary, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, filename);
      state = next;
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return {
    kind: 'file',
    async init() {
      try { state = { ...state, ...JSON.parse(await readFile(filename, 'utf8')) }; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    },
    rooms: { async loadAll() { return structuredClone(state.rooms); }, saveAll(rooms) { return update((s) => { s.rooms = rooms; }); } },
    matches: {
      async loadAll() { return structuredClone(state.matches); },
      async upsert(record) {
        await update((s) => { const i = s.matches.findIndex((m) => m.id === record.id); if (i < 0) s.matches.push(record); else s.matches[i] = record; });
        return record;
      },
    },
    accounts: { async load() { return structuredClone(state.accounts); }, save(accounts) { return update((s) => { s.accounts = accounts; }); } },
    async health() { return { ok: true, kind: 'file' }; },
    async close() { await queue; },
  };
}
