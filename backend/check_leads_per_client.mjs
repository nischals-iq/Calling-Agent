import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      leads: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          source: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  for (const c of clients) {
    if (c.leads.length > 0) {
      console.log(`\n=== CLIENT: ${c.name} (${c.id}) | LEADS COUNT: ${c.leads.length} ===`);
      console.log(JSON.stringify(c.leads.slice(0, 3), null, 2));
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
