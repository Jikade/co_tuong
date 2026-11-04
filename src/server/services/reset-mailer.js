import nodemailer from 'nodemailer';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// SMTP acceptance is not proof that the recipient inbox received the message.
// One bounded attempt sequence per request, one token and Message-ID per sequence.
export function createResetMailer(config) {
  const transport = config.provider === 'smtp' ? nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.secure, requireTLS: config.requireTLS,
    auth: config.auth, connectionTimeout: config.timeoutMs, greetingTimeout: config.timeoutMs,
    socketTimeout: config.timeoutMs, logger: false, debug: false,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true, ...(config.caFile ? { ca: readFileSync(config.caFile) } : {}) },
    disableFileAccess: true, disableUrlAccess: true,
  }) : null;
  return {
    async verify() {
      if (!transport) throw new Error('SMTP provider is not enabled.');
      try { await transport.verify(); return { smtp: 'ready' }; }
      catch { throw new Error('SMTP verification failed. Check configuration and server availability.'); }
    },
    async deliverReset(delivery) {
      if (!transport) {
        await mkdir(config.outbox, { recursive: true });
        await writeFile(path.join(config.outbox, `${randomUUID()}.json`), JSON.stringify({ ...delivery, createdAt: Date.now() }), { mode: 0o600 });
        return;
      }
      const resetUrl = new URL(config.publicUrl);
      resetUrl.searchParams.set('reset', delivery.token);
      const messageId = `<${randomUUID()}@cotuong.local>`;
      for (let attempt = 1; attempt <= config.attempts; attempt++) {
        try {
          const result = await transport.sendMail({ from: config.from, to: delivery.email, messageId,
            subject: 'Co Tuong - Password reset',
            text: `Reset your Co Tuong password using this link within 15 minutes:\n${resetUrl.href}\nIf you did not request this, ignore this message.`,
          });
          if (!result.accepted?.length || result.rejected?.length) throw Object.assign(new Error('Recipient rejected'), { responseCode: 550 });
          return;
        } catch (error) {
          const transient = (error.responseCode >= 400 && error.responseCode < 500)
            || ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN'].includes(error.code);
          if (!transient || attempt === config.attempts) throw new Error('Reset email delivery failed.');
          await delay(Math.min(10000, config.retryMs * 2 ** (attempt - 1)));
        }
      }
    },
  };
}
