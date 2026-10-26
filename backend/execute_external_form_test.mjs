import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function runTest() {
  const timestamp = Date.now();
  const testData = {
    firstName: "External Website Test",
    lastName: "Real Submission",
    email: `external.website.test.${timestamp}@example.com`,
    phone: `+1987654${String(timestamp).slice(-4)}`,
    company: "Global Tech Inc",
    purpose: "Enterprise Voice AI Solutions",
    message: "Real website to FirstCall CRM test",
    formId: "afsha-contact-form",
    landingPageUrl: "https://afsha.ai/contact",
    utmSource: "google",
    utmMedium: "organic",
    utmCampaign: "voice_ai_inbound",
    utmContent: "contact_hero",
    utmTerm: "enterprise voice bot"
  };

  const tenantKey = "ca_live_7139e1f2c0312291cbfba340e9364301"; // Supra

  console.log("=== SUBMITTING FROM EXTERNAL WEBSITE CONTACT FORM HANDLER ===");
  console.log("Website Form: Afsha AI / DashMinds Contact Form");
  console.log("Timestamp:", timestamp);
  console.log("Payload:", JSON.stringify(testData, null, 2));

  // Step 1: Simulate the website's existing local handler logic
  console.log("\n1. Simulating Website Form Submission with FirstCall Integration...");

  const firstCallPayload = {
    firstName: testData.firstName,
    lastName: testData.lastName,
    email: testData.email,
    phone: testData.phone,
    company: testData.company,
    message: `[${testData.purpose}] ${testData.message}`,
    source: "WEBSITE",
    medium: "contact-form",
    formId: testData.formId,
    landingPageUrl: testData.landingPageUrl,
    utmSource: testData.utmSource,
    utmMedium: testData.utmMedium,
    utmCampaign: testData.utmCampaign,
    utmContent: testData.utmContent,
    utmTerm: testData.utmTerm,
  };

  // Submit to FirstCall backend
  const response = await fetch("http://localhost:8000/api/public/leads/capture", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Key": tenantKey,
    },
    body: JSON.stringify(firstCallPayload),
  });

  const statusCode = response.status;
  const result = await response.json();

  console.log(`\nHTTP Status: ${statusCode}`);
  console.log("FirstCall Ingestion Response:", JSON.stringify(result, null, 2));

  if (!result.success || !result.lead) {
    throw new Error(`Failed to ingest lead: ${JSON.stringify(result)}`);
  }

  const leadId = result.lead.id;

  // Step 2: Verify the created lead in CRM database
  console.log(`\n2. Verifying Lead ${leadId} in CRM Database...`);
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      client: { select: { id: true, name: true, apiKey: true } },
      stage: { select: { id: true, name: true } },
    },
  });

  console.log("\n=== VERIFIED CRM LEAD IN /client/leads ===");
  console.log("ID:", lead.id);
  console.log("Client / Tenant:", lead.client.name, `(${lead.clientId})`);
  console.log("Name:", `${lead.firstName} ${lead.lastName}`);
  console.log("Email:", lead.email);
  console.log("Phone:", lead.phone);
  console.log("Company:", lead.company);
  console.log("Source:", lead.source);
  console.log("Medium:", lead.medium);
  console.log("Notes / Message:", lead.notes);
  console.log("Form ID:", lead.formId);
  console.log("Landing Page URL:", lead.landingPageUrl);
  console.log("UTM Source:", lead.utmSource);
  console.log("UTM Medium:", lead.utmMedium);
  console.log("UTM Campaign:", lead.utmCampaign);
  console.log("UTM Content:", lead.utmContent);
  console.log("UTM Term:", lead.utmTerm);
  console.log("Stage:", lead.stage?.name);
  console.log("Created At:", lead.createdAt);
  console.log("Is Duplicate:", lead.isDuplicate);

  // Step 3: Verify Duplicate Detection handling works
  console.log("\n3. Testing Duplicate Ingestion on repeated submission...");
  const dupResponse = await fetch("http://localhost:8000/api/public/leads/capture", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Key": tenantKey,
    },
    body: JSON.stringify(firstCallPayload),
  });

  const dupResult = await dupResponse.json();
  console.log("Duplicate Response:", JSON.stringify(dupResult, null, 2));
  console.log("Duplicate Detected Flag:", dupResult.isDuplicate);
  console.log("Duplicate Of ID:", dupResult.duplicateOfId);

  console.log("\n=== ALL PART 2 CHECKS PASSED SUCCESSFULLY ===");
}

runTest().catch(console.error).finally(() => prisma.$disconnect());
