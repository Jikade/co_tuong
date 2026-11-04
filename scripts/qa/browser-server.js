import { createGameServer } from '../../server.js';
import { createMemoryPersistence } from '../../src/server/persistence/memory-persistence.js';
process.env.MAIL_OUTBOX='artifacts/qa/browser-outbox';
const server=createGameServer({host:'127.0.0.1',port:3108,persistence:createMemoryPersistence(),computerMoveDelayMs:800});
await server.listen();
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close().then(()=>process.exit(0)));
