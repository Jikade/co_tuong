import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameServer } from './src/server/game-server.js';

export { createGameServer };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const gameServer = createGameServer();
  const address = await gameServer.listen();
  console.log(`Xiangqi WebSocket server listening at ${address}`);
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      gameServer.close().then(() => process.exit(0)).catch((error) => {
        console.error('Could not stop the game server cleanly:', error);
        process.exitCode = 1;
      });
    });
  }
}
