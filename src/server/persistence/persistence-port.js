export function assertPersistence(adapter) {
  const required = [
    ['rooms.loadAll', adapter?.rooms?.loadAll],
    ['rooms.saveAll', adapter?.rooms?.saveAll],
    ['matches.loadAll', adapter?.matches?.loadAll],
    ['matches.upsert', adapter?.matches?.upsert],
  ];
  const missing = required.filter(([, fn]) => typeof fn !== 'function').map(([name]) => name);
  if (missing.length) throw new TypeError(`Persistence adapter thiếu: ${missing.join(', ')}`);
  return adapter;
}
