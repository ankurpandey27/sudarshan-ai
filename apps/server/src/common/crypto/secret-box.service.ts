import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PREFIX = 'enc:v1:';

/** AES-256-GCM for API keys at rest. The key file stays in the data dir, so a copied database alone does not expose keys. */
@Injectable()
export class SecretBoxService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.key = this.loadKey(config.getOrThrow<string>('paths.secretKey'));
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
  }

  decrypt(value: string): string {
    if (!value.startsWith(PREFIX)) return value;
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  }

  private loadKey(file: string): Buffer {
    if (existsSync(file)) return Buffer.from(readFileSync(file, 'utf8').trim(), 'base64');
    mkdirSync(dirname(file), { recursive: true });
    const key = randomBytes(32);
    writeFileSync(file, key.toString('base64'), { mode: 0o600 });
    try {
      chmodSync(file, 0o600);
    } catch {
      // Windows ignores POSIX modes; the file lives under the user's profile.
    }
    return key;
  }
}
