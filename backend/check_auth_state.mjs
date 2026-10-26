import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== USERS (ORDERED BY LAST LOGIN) ===');
  const users = await prisma.user.findMany({
    orderBy: { lastLoginAt: 'desc' },
    include: {
      client: { select: { id: true, name: true, primaryContactEmail: true } }
    }
  });
  console.log(JSON.stringify(users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    clientId: u.clientId,
    clientName: u.client?.name,
    lastLoginAt: u.lastLoginAt
  })), null, 2));

  console.log('=== AUDIT LOGS ===');
  const audits = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      client: { select: { id: true, name: true } },
      user: { select: { id: true, email: true, name: true } }
    }
  });
  console.log(JSON.stringify(audits, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
