import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== LATEST META LEADS ===');
  const metaLeads = await prisma.lead.findMany({
    where: { source: 'META' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      client: {
        select: { id: true, name: true, primaryContactEmail: true }
      }
    }
  });
  console.log(JSON.stringify(metaLeads, null, 2));

  console.log('=== ALL CLIENTS ===');
  const clients = await prisma.client.findMany({
    select: { id: true, name: true, primaryContactEmail: true }
  });
  console.log(JSON.stringify(clients, null, 2));

  console.log('=== LATEST WEBHOOK LOGS ===');
  const webhooks = await prisma.webhookLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  console.log(JSON.stringify(webhooks, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
