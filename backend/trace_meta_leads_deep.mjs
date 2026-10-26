import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('================ 1. TARGET META LEADS ================');
  const leads = await prisma.lead.findMany({
    where: { source: 'META' },
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: { id: true, name: true, primaryContactEmail: true } },
      campaign: true,
      stage: true
    }
  });
  console.log(JSON.stringify(leads, null, 2));

  console.log('\n================ 2. MATCHING WEBHOOK LOGS ================');
  const webhookLogs = await prisma.webhookLog.findMany({
    where: { channel: 'META' },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(webhookLogs, null, 2));

  console.log('\n================ 3. ALL META INTEGRATIONS ================');
  const integrations = await prisma.integration.findMany({
    where: { channel: 'META' },
    include: {
      client: { select: { id: true, name: true, primaryContactEmail: true } }
    }
  });
  console.log(JSON.stringify(integrations.map(i => ({
    id: i.id,
    clientId: i.clientId,
    clientName: i.client.name,
    status: i.status,
    metadata: i.metadata,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    lastSyncedAt: i.lastSyncedAt
  })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
