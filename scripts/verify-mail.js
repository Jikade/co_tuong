import { readMailConfig } from '../src/server/config.js';
import { createResetMailer } from '../src/server/services/reset-mailer.js';
try { console.log(await createResetMailer(readMailConfig()).verify()); }
catch { console.error('SMTP verification failed. Check MAIL_PROVIDER and SMTP configuration; no message was sent.'); process.exitCode = 1; }
