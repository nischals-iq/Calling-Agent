import 'dotenv/config';
import { PrismaService } from './src/prisma/prisma.service.js';
import { IntegrationEncryptionService } from './src/modules/integrations/services/integration-encryption.service.js';

const prisma = new PrismaService();
const encryption = new IntegrationEncryptionService();

async function main() {
  await prisma.onModuleInit();
  const pageId = '1378772271983872';

  const supra = await prisma.integration.findFirst({
    where: { client: { name: 'Supra' }, channel: 'META' },
    include: { client: true },
  });

  if (!supra) {
    console.error('Supra not found');
    return;
  }

  const creds = supra.credentials as Record<string, any>;
  const pageAccessToken = encryption.decrypt(creds.pageAccessToken);

  console.log('Querying Meta Graph API for leadgen forms on Page:', pageId);
  const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?access_token=${pageAccessToken}`);
  const data = await res.json();
  console.log('Leadgen forms response:', JSON.stringify(data, null, 2));
}

main().finally(() => prisma.onModuleDestroy());
