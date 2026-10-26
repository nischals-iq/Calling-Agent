import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== LATEST 5 WEBHOOK LOGS ===');
  const webhooks = await prisma.webhookLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(webhooks, null, 2));

  console.log('\n=== LATEST 5 LEADS ===');
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      client: { select: { id: true, name: true } }
    }
  });
  console.log(JSON.stringify(leads.map(l => ({
    id: l.id,
    firstName: l.firstName,
    lastName: l.lastName,
    email: l.email,
    phone: l.phone,
    source: l.source,
    formId: l.formId,
    clientId: l.clientId,
    clientName: l.client?.name,
    createdAt: l.createdAt
  })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
