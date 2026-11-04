import test from 'node:test';
import assert from 'node:assert/strict';
import { SMTPServer } from 'smtp-server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readMailConfig } from '../src/server/config.js';
import { createResetMailer } from '../src/server/services/reset-mailer.js';
import { createGameServer } from '../server.js';
import { createMemoryPersistence } from '../src/server/persistence/memory-persistence.js';
import { api, register } from './helpers/authenticated-game.js';
const certFile = new URL('./fixtures/smtp-cert.pem', import.meta.url), keyFile = new URL('./fixtures/smtp-key.pem', import.meta.url);
async function smtp(t, { fail = 0, failureCode = 451, secure = false, starttls = false, authenticate = false } = {}) {
  const messages = []; let attempts = 0;
  const server = new SMTPServer({ logger: false, secure,
    ...(secure || starttls ? { cert: readFileSync(certFile), key: readFileSync(keyFile) } : {}),
    disabledCommands: starttls || secure ? [] : ['STARTTLS'], allowInsecureAuth: true, authOptional: !authenticate,
    onAuth(auth, session, callback) { callback(auth.username === 'test-user' && auth.password === 'test-secret' ? null : Object.assign(new Error('Denied'), { responseCode: 535 }), { user: 'test-user' }); },
    onRcptTo(address, session, callback) { attempts++; callback(attempts <= fail ? Object.assign(new Error('Simulated failure'), { responseCode: failureCode }) : null); },
    onData(stream, session, callback) { let raw = ''; stream.on('data', (b) => { raw += b; }); stream.on('end', () => { messages.push({ raw, authenticated: Boolean(session.user) }); callback(); }); },
  });
  server.on('error', () => {});
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const config = readMailConfig({ MAIL_PROVIDER: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.server.address().port), MAIL_FROM: 'noreply@example.test', APP_PUBLIC_URL: 'https://chess.example.test/',
    SMTP_SECURE: String(secure), SMTP_REQUIRE_TLS: String(starttls), SMTP_TLS_CA_FILE: fileURLToPath(certFile),
    SMTP_USER: authenticate ? 'test-user' : '', SMTP_PASSWORD: authenticate ? 'test-secret' : '', SMTP_RETRY_MS: '1', SMTP_TIMEOUT_MS: '2000' });
  return { messages, config, attempts: () => attempts };
}
test('mail configuration validates TLS, credentials, URL, provider and retry bounds', () => {
  assert.equal(readMailConfig({}).provider, 'file');
  const base = { MAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.example.test', MAIL_FROM: 'noreply@example.test' };
  assert.equal(readMailConfig(base).requireTLS, true);
  for (const bad of [{ MAIL_PROVIDER: 'unknown' }, { APP_PUBLIC_URL: 'https://user:secret@example.test' }, { ...base, SMTP_REQUIRE_TLS: 'false' }, { ...base, SMTP_USER: 'partial' }, { ...base, SMTP_MAX_ATTEMPTS: '99' }, { ...base, MAIL_FROM: 'bad\naddress' }]) assert.throws(() => readMailConfig(bad));
});
for (const secure of [false, true]) test(`SMTP ${secure ? 'implicit TLS' : 'STARTTLS'} verifies certificate, authenticates and sends one reset link`, async (t) => {
  const s = await smtp(t, { secure, starttls: !secure, authenticate: true }); const mailer = createResetMailer(s.config);
  assert.deepEqual(await mailer.verify(), { smtp: 'ready' });
  await mailer.deliverReset({ email: 'recipient@example.test', token: 'one-use-test-token' });
  assert.equal(s.messages.length, 1); assert.ok(s.messages[0].authenticated);
  assert.match(s.messages[0].raw, /https:\/\/chess\.example\.test\/\?reset=one-use-test-token/);
});
test('SMTP retries transient rejection with one token and eventually delivers', async (t) => {
  const s = await smtp(t, { fail: 2 }); await createResetMailer(s.config).deliverReset({ email: 'recipient@example.test', token: 'retry-token' });
  assert.equal(s.attempts(), 3); assert.equal(s.messages.length, 1); assert.match(s.messages[0].raw, /retry-token/);
});
test('SMTP permanent failure has no retry and exposes no transport details', async (t) => {
  const s = await smtp(t, { fail: 100, failureCode: 550 });
  await assert.rejects(createResetMailer(s.config).deliverReset({ email: 'recipient@example.test', token: 'secret-token' }), { message: 'Reset email delivery failed.' });
  assert.equal(s.attempts(), 1); assert.equal(s.messages.length, 0);
});
test('SMTP enforces STARTTLS when the server does not advertise it', async (t) => {
  const s = await smtp(t); s.config.requireTLS = true;
  await assert.rejects(createResetMailer(s.config).verify(), /verification failed/); assert.equal(s.messages.length, 0);
});
test('real forgot-password HTTP route uses SMTP; one-use reset invalidates the old login', async (t) => {
  const s = await smtp(t, { starttls: true, authenticate: true }); const persistence = createMemoryPersistence();
  const server = createGameServer({ host: '127.0.0.1', port: 0, persistence, mailConfig: s.config }); t.after(() => server.close());
  const base = (await server.listen()).replace(/^ws/, 'http').replace(/\/ws$/, ''); const a = await register(base, 'smtpuser');
  const response = await api(base, '/api/auth/forgot-password', { method: 'POST', body: { email: a.email } });
  assert.equal(response.status, 200); assert.equal(s.messages.length, 1); assert.ok(s.messages[0].authenticated);
  // Decode MIME quoted-printable folding before reading the link, like a mail client.
  const decoded = s.messages[0].raw.replace(/=\r?\n/g, '').replace(/=3D/gi, '=');
  const token = decoded.match(/\?reset=([\w-]+)/)[1]; assert.equal(token.length, 43); assert.ok(!JSON.stringify(response.body).includes(token));
  const body = { token, password: 'NewMailPass123', confirmPassword: 'NewMailPass123' };
  assert.equal((await api(base, '/api/auth/reset-password', { method: 'POST', body })).status, 200);
  assert.equal((await api(base, '/api/auth/reset-password', { method: 'POST', body })).status, 400);
  assert.equal((await api(base, '/api/me', { cookie: a.cookie })).status, 401);
  assert.equal((await api(base, '/api/auth/login', { method: 'POST', body: { username: a.username, password: body.password } })).status, 200);
});
test('exhausted SMTP retries invalidate token, keep generic HTTP response and redact logs', async (t) => {
  const s = await smtp(t, { fail: 100 }); const persistence = createMemoryPersistence();
  const server = createGameServer({ host: '127.0.0.1', port: 0, persistence, mailConfig: s.config }); t.after(() => server.close());
  const base = (await server.listen()).replace(/^ws/, 'http').replace(/\/ws$/, ''); const a = await register(base, 'mailfail');
  const logs = []; t.mock.method(console, 'error', (...args) => logs.push(args.join(' ')));
  const known = await api(base, '/api/auth/forgot-password', { method: 'POST', body: { email: a.email } });
  const unknown = await api(base, '/api/auth/forgot-password', { method: 'POST', body: { email: 'unknown@example.test' } });
  assert.equal(known.status, 200); assert.deepEqual(known.body, unknown.body); assert.equal(s.attempts(), 3);
  assert.ok((await persistence.accounts.load()).resets.every((r) => r.usedAt));
  assert.deepEqual(logs, ['Password reset delivery failed.']);
});
