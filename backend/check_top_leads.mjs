import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const latestLeads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: {
      client: { select: { id: true, name: true, primaryContactEmail: true } }
    }
  });
  console.log('TOP_3_LEADS:', JSON.stringify(latestLeads.map(l => ({
    id: l.id,
    name: `${l.firstName} ${l.lastName || ''}`,
    email: l.email,
    source: l.source,
    clientId: l.clientId,
    clientName: l.client?.name,
    createdAt: l.createdAt
  })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
