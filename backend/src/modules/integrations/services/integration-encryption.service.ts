import { Injectable, Logger } from '@nestjs/common';
import crypto from 'crypto';

@Injectable()
export class IntegrationEncryptionService {
  private readonly logger = new Logger(IntegrationEncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    // Read from env or fall back to a deterministic 32-byte hash in development
    const rawKey = process.env.INTEGRATION_ENCRYPTION_KEY || 'calling_agent_crm_default_secure_vault_key_2026';
    this.key = crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts plaintext string using AES-256-GCM.
   * Output format: iv:authTag:ciphertext (hex encoded)
   */
  encrypt(text: string): string {
    if (!text || typeof text !== 'string') return text;
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${tag}:${encrypted}`;
    } catch (err: any) {
      this.logger.error(`Encryption failure: ${err.message}`);
      throw new Error('Failed to encrypt secret credential');
    }
  }

  /**
   * Decrypts AES-256-GCM ciphertext.
   */
  decrypt(encryptedPayload: string): string {
    if (!encryptedPayload || typeof encryptedPayload !== 'string') return encryptedPayload;
    if (!encryptedPayload.includes(':')) {
      // If unencrypted legacy string or already plain, return as is
      return encryptedPayload;
    }

    const candidateKeys = [this.key];
    const fallbackKey = crypto.createHash('sha256').update('calling_agent_crm_default_secure_vault_key_2026').digest();
    if (!fallbackKey.equals(this.key)) {
      candidateKeys.push(fallbackKey);
    }

    for (const key of candidateKeys) {
      try {
        const parts = encryptedPayload.split(':');
        if (parts.length !== 3) return encryptedPayload;
        const [ivHex, tagHex, encryptedText] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch {
        // Try next candidate key
      }
    }

    this.logger.error('Decryption failure: Unable to authenticate ciphertext with configured keys');
    return encryptedPayload; // Fallback gracefully if corrupted or plaintext
  }

  /**
   * Masks a sensitive string for safe UI / API delivery.
   * e.g. "my_secret_token_12345" -> "••••••••2345"
   */
  mask(val?: string | null): string {
    if (!val || typeof val !== 'string') return '';
    const clean = val.trim();
    if (clean.length <= 4) {
      return '••••••••';
    }
    return `••••••••${clean.slice(-4)}`;
  }

  /**
   * Checks if an input value is already masked by frontend.
   */
  isMasked(val?: string | null): boolean {
    if (!val) return false;
    return val.startsWith('••••••••') || val.startsWith('********');
  }

  /**
   * Encrypts sensitive keys inside a credentials object while leaving others intact.
   */
  encryptCredentials(credentials: Record<string, any>, sensitiveKeys: string[]): Record<string, any> {
    if (!credentials) return {};
    const result: Record<string, any> = { ...credentials };
    for (const key of sensitiveKeys) {
      if (result[key] && typeof result[key] === 'string' && !this.isMasked(result[key])) {
        result[key] = this.encrypt(result[key]);
      }
    }
    return result;
  }

  /**
   * Decrypts and masks sensitive keys for frontend delivery.
   */
  maskCredentials(credentials: Record<string, any>, sensitiveKeys: string[]): Record<string, any> {
    if (!credentials) return {};
    const result: Record<string, any> = { ...credentials };
    for (const key of sensitiveKeys) {
      if (result[key] && typeof result[key] === 'string') {
        const decrypted = this.decrypt(result[key]);
        result[key] = this.mask(decrypted);
      }
    }
    return result;
  }

  /**
   * Decrypts all sensitive keys for internal provider communication.
   */
  decryptCredentials(credentials: Record<string, any>, sensitiveKeys: string[]): Record<string, any> {
    if (!credentials) return {};
    const result: Record<string, any> = { ...credentials };
    for (const key of sensitiveKeys) {
      if (result[key] && typeof result[key] === 'string') {
        result[key] = this.decrypt(result[key]);
      }
    }
    return result;
  }
}
