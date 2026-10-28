import { createGameServer } from '../server.js';
import { createMemoryPersistence } from '../src/server/persistence/memory-persistence.js';
const server = createGameServer({ host: '127.0.0.1', port: 3107, persistence: createMemoryPersistence(), countdownMs: 100, turnSeconds: 120 });
await server.listen();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close().then(() => process.exit(0)));
