import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const metaLeads = await prisma.lead.findMany({
    where: { source: 'META' },
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: { id: true, name: true, primaryContactEmail: true } },
      campaign: true
    }
  });

  const allLogs = await prisma.webhookLog.findMany({
    where: { channel: 'META' },
    orderBy: { createdAt: 'desc' }
  });

  for (const l of metaLeads) {
    console.log(`\n======================================================`);
    console.log(`LEAD ID:    ${l.id}`);
    console.log(`NAME:       ${l.firstName} ${l.lastName || ''}`);
    console.log(`EMAIL:      ${l.email}`);
    console.log(`PHONE:      ${l.phone}`);
    console.log(`CLIENT:     ${l.client?.name} (${l.clientId})`);
    console.log(`SOURCE:     ${l.source}`);
    console.log(`FORM ID:    ${l.formId}`);
    console.log(`CAMPAIGN:   ${l.campaignName} (ID: ${l.campaignId})`);
    console.log(`AD ID:      ${l.adId}`);
    console.log(`NOTES:      ${l.notes}`);
    console.log(`CUSTOM:     `, JSON.stringify(l.customFields));
    console.log(`CREATED AT: ${l.createdAt.toISOString()}`);

    // Match log
    const matchingLog = allLogs.find(log => {
      const p = log.payload || {};
      if (p.ingestedLeadId === l.id) return true;
      const leadTime = l.createdAt.getTime();
      const logTime = log.createdAt.getTime();
      return Math.abs(leadTime - logTime) < 3000;
    });

    if (matchingLog) {
      console.log(`\n--- MATCHING WEBHOOK LOG ---`);
      console.log(`WEBHOOK ID:    ${matchingLog.id}`);
      console.log(`CLIENT ID:     ${matchingLog.clientId}`);
      console.log(`STATUS:        ${matchingLog.status}`);
      console.log(`EVENT TYPE:    ${matchingLog.eventType}`);
      console.log(`CREATED AT:    ${matchingLog.createdAt.toISOString()}`);
      console.log(`PAYLOAD:       `, JSON.stringify(matchingLog.payload, null, 2));
    } else {
      console.log(`--- NO MATCHING WEBHOOK LOG ---`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
