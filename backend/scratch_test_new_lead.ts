import 'dotenv/config';
import { PrismaService } from './src/prisma/prisma.service.js';

const prisma = new PrismaService();

async function main() {
  await prisma.onModuleInit();

  const testEventId = `meta_leadgen_test_${Date.now()}`;
  const testEmail = `rohan.kapoor.${Date.now()}@example.com`;

  const webhookPayload = {
    object: 'page',
    entry: [
      {
        id: '1378772271983872',
        time: Math.floor(Date.now() / 1000),
        changes: [
          {
            field: 'leadgen',
            value: {
              ad_id: 'ad_meta_live_test_01',
              form_id: '1737279657374383',
              leadgen_id: testEventId,
              page_id: '1378772271983872',
              created_time: Math.floor(Date.now() / 1000),
              field_data: [
                { name: 'first_name', values: ['Rohan'] },
                { name: 'last_name', values: ['Kapoor'] },
                { name: 'email', values: [testEmail] },
                { name: 'phone_number', values: ['+919876543210'] },
                { name: 'company_name', values: ['Kapoor Ventures'] },
              ],
            },
          },
        ],
      },
    ],
  };

  console.log('--- 1. Sending Webhook for Page 1378772271983872 ---');
  const res = await fetch('http://localhost:8000/api/webhooks/meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookPayload),
  });

  const resJson = await res.json();
  console.log('Webhook Response HTTP Status:', res.status);
  console.log('Webhook Response Body:', resJson);

  if (res.status !== 200 || !resJson.leadId) {
    throw new Error(`Webhook failed: ${JSON.stringify(resJson)}`);
  }

  console.log('\n--- 2. Inspecting Newly Created Lead ---');
  const createdLead = await prisma.lead.findUnique({
    where: { id: resJson.leadId },
    include: { client: true },
  });

  console.log('Created Lead ID:', createdLead?.id);
  console.log('Created Lead Name:', `${createdLead?.firstName} ${createdLead?.lastName}`);
  console.log('Created Lead Client ID:', createdLead?.clientId);
  console.log('Created Lead Client Name:', createdLead?.client.name);

  const supraClientId = 'ece818d0-950c-480a-8873-00484c8f7ba9';
  const gt3ClientId = '45ac13b1-ca29-48ee-b3e9-110a134d2bbe';

  const matchesSupra = createdLead?.clientId === supraClientId;
  const isUnderGT3 = createdLead?.clientId === gt3ClientId;

  console.log(`\nVerified only under Supra (${supraClientId}):`, matchesSupra);
  console.log(`Not under GT3 (${gt3ClientId}):`, !isUnderGT3);

  console.log('\n--- 3. Checking Aarav Singhania (Untouched) ---');
  const aarav = await prisma.lead.findFirst({
    where: { firstName: 'Aarav', lastName: 'Singhania' },
    include: { client: true },
  });
  console.log(`Aarav Client ID: ${aarav?.clientId} (${aarav?.client.name}) - Unmodified.`);

  console.log('\n--- 4. Testing Tenant Isolation / Rejection on Unknown Page ---');
  const unknownPageRes = await fetch('http://localhost:8000/api/webhooks/meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object: 'page',
      entry: [
        {
          id: '999999999999999',
          changes: [
            {
              field: 'leadgen',
              value: {
                page_id: '999999999999999',
                leadgen_id: 'meta_unknown_page_001',
              },
            },
          ],
        },
      ],
    }),
  });
  console.log('Unknown Page Webhook HTTP Status:', unknownPageRes.status);
  const unknownJson = await unknownPageRes.json();
  console.log('Unknown Page Webhook Response:', unknownJson);
  console.log('Strict rejection verified (status 400):', unknownPageRes.status === 400);
}

main().finally(() => prisma.onModuleDestroy());
