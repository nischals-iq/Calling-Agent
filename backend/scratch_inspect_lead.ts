import 'dotenv/config';
import { PrismaService } from './src/prisma/prisma.service.js';

const prisma = new PrismaService();

async function main() {
  await prisma.onModuleInit();

  console.log('=== LEAD: Aarav Singhania ===');
  const leads = await prisma.lead.findMany({
    where: {
      firstName: { contains: 'Aarav' },
    },
    include: {
      client: true,
      campaign: true,
    },
  });
  console.log(JSON.stringify(leads, null, 2));

  console.log('\n=== RECENT WEBHOOK LOGS ===');
  const logs = await prisma.webhookLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(JSON.stringify(logs, null, 2));

  console.log('\n=== ALL META INTEGRATIONS ===');
  const integrations = await prisma.integration.findMany({
    where: { channel: 'META' },
    include: { client: true },
  });
  console.log(
    JSON.stringify(
      integrations.map((i) => ({
        id: i.id,
        clientId: i.clientId,
        clientName: i.client.name,
        status: i.status,
        metadata: i.metadata,
        updatedAt: i.updatedAt,
      })),
      null,
      2
    )
  );

  console.log('\n=== ALL FORMS / CAMPAIGNS ===');
  const campaigns = await prisma.campaign.findMany({
    where: { source: 'META' },
    include: { client: true },
  });
  console.log(
    JSON.stringify(
      campaigns.map((c) => ({
        id: c.id,
        clientId: c.clientId,
        clientName: c.client.name,
        name: c.name,
        platformCampaignId: c.platformCampaignId,
      })),
      null,
      2
    )
  );
}

main().finally(() => prisma.onModuleDestroy());
