import 'dotenv/config';
import { PrismaService } from './src/prisma/prisma.service.js';
import { ChannelType } from '@prisma/client';

const prisma = new PrismaService();

async function main() {
  await prisma.onModuleInit();

  // 1. Isolate GT3 with dummy mock values so it never intercepts real Meta webhooks
  const gt3 = await prisma.integration.findFirst({
    where: { client: { name: 'GT3' }, channel: ChannelType.META },
  });
  if (gt3) {
    console.log('Updating GT3 to isolated mock metadata...');
    await prisma.integration.update({
      where: { id: gt3.id },
      data: {
        metadata: {
          pageId: 'mock_gt3_page_001',
          pageName: 'Mock GT3 Page',
          formId: 'mock_gt3_form_001',
          leadFormId: 'mock_gt3_form_001',
          formName: 'Mock GT3 Form',
          pageSubscribed: false,
        },
      },
    });
    console.log('GT3 updated to isolated mock data.');
  }

  // 2. Ensure Supra has the real Meta Page ID and real Form ID
  const supra = await prisma.integration.findFirst({
    where: { client: { name: 'Supra' }, channel: ChannelType.META },
    include: { client: true },
  });
  if (supra) {
    console.log('Updating Supra with real Page 1378772271983872 and Form 1737279657374383...');
    const currentMeta = (supra.metadata as Record<string, any>) || {};
    await prisma.integration.update({
      where: { id: supra.id },
      data: {
        metadata: {
          ...currentMeta,
          pageId: '1378772271983872',
          pageName: 'Skyline Demo',
          formId: '1737279657374383',
          leadFormId: '1737279657374383',
          formName: 'Property Enquiry Form',
          pageSubscribed: true,
          subscribedFields: ['leadgen'],
        },
      },
    });
    console.log('Supra updated successfully.');
  }

  // 3. Confirm both integrations
  const all = await prisma.integration.findMany({
    where: { channel: ChannelType.META },
    include: { client: true },
  });
  console.log('\n=== CURRENT META INTEGRATIONS ===');
  for (const i of all) {
    console.log(`Client: ${i.client.name} (${i.clientId}) -> Page: ${(i.metadata as any)?.pageId}, Form: ${(i.metadata as any)?.formId}`);
  }
}

main().finally(() => prisma.onModuleDestroy());
