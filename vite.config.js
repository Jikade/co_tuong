import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const tlsCertFile = process.env.TLS_CERT_FILE;
const tlsKeyFile = process.env.TLS_KEY_FILE;
if (Boolean(tlsCertFile) !== Boolean(tlsKeyFile)) {
  throw new Error('Set both TLS_CERT_FILE and TLS_KEY_FILE to enable HTTPS.');
}

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    host: true,
    ...(tlsCertFile && {
      https: {
        cert: readFileSync(tlsCertFile),
        key: readFileSync(tlsKeyFile),
      },
    }),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
