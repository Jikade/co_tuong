import concurrently from 'concurrently';

// Use the package's public entrypoint; all children inherit the loaded .env.
const { result } = concurrently([
  { name: 'server', command: 'node server.js' },
  { name: 'vite', command: 'vite --host 0.0.0.0' },
], { killOthersOn: ['failure', 'success'] });

try { await result; }
catch { process.exitCode = 1; }
