import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const recentLogs = await prisma.webhookLog.findMany({
    where: { channel: 'META' },
    orderBy: { createdAt: 'desc' },
    take: 12
  });

  console.log(`Found ${recentLogs.length} Meta webhook logs:`);
  for (const log of recentLogs) {
    console.log('----------------------------------------------------');
    console.log(`ID:         ${log.id}`);
    console.log(`CREATED AT: ${log.createdAt.toISOString()}`);
    console.log(`STATUS:     ${log.status}`);
    console.log(`ERROR:      ${log.error}`);
    console.log(`CLIENT ID:  ${log.clientId}`);
    console.log(`PAYLOAD:    `, JSON.stringify(log.payload, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
