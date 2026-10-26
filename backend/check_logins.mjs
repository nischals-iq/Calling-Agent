import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const logins = await prisma.auditLog.findMany({
    where: { action: { contains: 'LOGIN' } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      client: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true, role: true } }
    }
  });
  console.log(JSON.stringify(logins, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
