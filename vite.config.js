import { defineConfig } from 'vite';
import { readServerConfig, readTlsOptions } from './src/server/config.js';

const config = readServerConfig();
const https = readTlsOptions(config);

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: `${https ? 'https' : 'http'}://localhost:${config.port}`, secure: false },
      '/ws': { target: `${https ? 'wss' : 'ws'}://localhost:${config.port}`, ws: true, secure: false },
      '/health': { target: `${https ? 'https' : 'http'}://localhost:${config.port}`, secure: false },
    },
    ...(https && { https }),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
