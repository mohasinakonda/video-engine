import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ConfigError } from './config';

/**
 * AES-256-GCM for OAuth tokens at rest. The key comes from YOUTUBE_TOKEN_ENCRYPTION_KEY
 * (32 bytes, base64) so a database dump alone can't reveal tokens.
 * Format: "v1:" + base64(iv[12] | authTag[16] | ciphertext).
 */

const VERSION = 'v1:';

function getKey(): Buffer {
  const raw = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new ConfigError('YOUTUBE_TOKEN_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new ConfigError('YOUTUBE_TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32).');
  }
  return key;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return VERSION + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function decryptToken(stored: string): string {
  if (!stored.startsWith(VERSION)) throw new Error('Unknown token format');
  const data = Buffer.from(stored.slice(VERSION.length), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}
