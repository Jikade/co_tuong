import { assertPersistence } from './persistence-port.js';

function copy(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function createMemoryPersistence(seed = {}) {
  let rooms = copy(Array.isArray(seed.rooms) ? seed.rooms : []);
  let matches = copy(Array.isArray(seed.matches) ? seed.matches : []);
  let accounts = copy(seed.accounts ?? {});

  return assertPersistence({
    kind: 'memory',
    async init() {},
    accounts: {
      async load() { return copy(accounts); },
      async save(next) { accounts = copy(next); },
    },
    rooms: {
      async loadAll() {
        return copy(rooms);
      },
      async saveAll(nextRooms) {
        if (!Array.isArray(nextRooms)) throw new TypeError('rooms.saveAll cần một array.');
        rooms = copy(nextRooms);
      },
    },
    matches: {
      async loadAll() {
        return copy(matches);
      },
      async upsert(record) {
        if (!record?.id) throw new TypeError('Match phải có id.');
        const next = copy(record);
        const index = matches.findIndex((item) => item.id === next.id);
        if (index >= 0) matches[index] = next;
        else matches.push(next);
        return copy(next);
      },
    },
    async health() {
      return { ok: true, kind: 'memory' };
    },
    async close() {},
  });
}
