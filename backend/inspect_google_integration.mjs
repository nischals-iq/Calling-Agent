import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const integration = await prisma.integration.findFirst({
    where: { clientId: 'ece818d0-950c-480a-8873-00484c8f7ba9', channel: 'GOOGLE' }
  });

  console.log('GOOGLE INTEGRATION RECORD:');
  console.log('ID:', integration?.id);
  console.log('Status:', integration?.status);
  console.log('Metadata:', JSON.stringify(integration?.metadata, null, 2));
  console.log('Credentials keys:', Object.keys(integration?.credentials || {}));
  const creds = integration?.credentials || {};
  console.log('Creds customerId:', creds.customerId);
  console.log('Creds developerToken exists:', !!creds.developerToken);
  console.log('Creds clientId exists:', !!creds.clientId);
  console.log('Creds has refreshToken:', !!creds.refreshToken);
  console.log('Creds has accessToken:', !!creds.accessToken);
}

main().catch(console.error).finally(() => prisma.$disconnect());
