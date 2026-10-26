import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import crypto from 'crypto';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function decrypt(text) {
  if (!text) return null;
  const keyHex = process.env.INTEGRATION_ENCRYPTION_KEY || 'your_secure_32_byte_vault_encryption_key_here';
  const key = crypto.createHash('sha256').update(keyHex).digest();
  const parts = text.split(':');
  if (parts.length < 2) return text;
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[parts.length - 1], 'hex');
  const enc = Buffer.from(parts.slice(1, -1).join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

async function main() {
  const integration = await prisma.integration.findFirst({
    where: { clientId: 'ece818d0-950c-480a-8873-00484c8f7ba9', channel: 'GOOGLE' }
  });

  const creds = integration?.credentials || {};
  console.log('Decrypted developerToken exists:', !!decrypt(creds.developerToken));
  console.log('DeveloperToken prefix:', decrypt(creds.developerToken)?.slice(0, 4) + '...');
  console.log('Decrypted customerId:', creds.customerId);
  console.log('Decrypted accessToken prefix:', decrypt(creds.accessToken)?.slice(0, 10) + '...');
  console.log('Decrypted refreshToken exists:', !!decrypt(creds.refreshToken));
}

main().catch(console.error).finally(() => prisma.$disconnect());
