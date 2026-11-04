import { randomBytes, scrypt as scryptCallback, pbkdf2 as pbkdf2Callback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback), pbkdf2 = promisify(pbkdf2Callback);

function legacyParts(stored) {
  if (typeof stored !== 'string' || stored.length > 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(stored)) return null;
  const b = Buffer.from(stored, 'base64');
  if (b.toString('base64') !== stored) return null;
  if (b[0] === 0 && b.length === 49) return { format: 'aspnet-v2', salt: b.subarray(1, 17), expected: b.subarray(17), iterations: 1000, digest: 'sha1' };
  if (b[0] !== 1 || b.length < 45) return null;
  const prf = b.readUInt32BE(1), iterations = b.readUInt32BE(5), saltLength = b.readUInt32BE(9);
  const digest = ['sha1', 'sha256', 'sha512'][prf];
  // Bound work for corrupted/untrusted persisted hashes. Review higher-cost legacy
  // deployments explicitly rather than allowing arbitrary KDF work in a login.
  if (!digest || iterations < 1 || iterations > 1000000 || saltLength < 16 || saltLength > 128
      || b.length - 13 - saltLength < 16 || b.length - 13 - saltLength > 128) return null;
  return { format: 'aspnet-v3', salt: b.subarray(13, 13 + saltLength), expected: b.subarray(13 + saltLength), iterations, digest };
}
export function passwordFormat(stored) {
  if (typeof stored === 'string' && /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored)) return 'scrypt';
  return legacyParts(stored)?.format ?? 'unsupported';
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await scrypt(password, salt, 64)).toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128) return false;
  if (passwordFormat(stored) === 'scrypt') {
    const [, salt, hex] = stored.split('$');
    return timingSafeEqual(await scrypt(password, salt, 64), Buffer.from(hex, 'hex'));
  }
  const p = legacyParts(stored);
  if (!p) return false;
  const actual = await pbkdf2(password, p.salt, p.iterations, p.expected.length, p.digest);
  return timingSafeEqual(actual, p.expected);
}
