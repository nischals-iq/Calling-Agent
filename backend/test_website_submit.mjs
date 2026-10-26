import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const timestamp = Date.now();
  const testPayload = {
    firstName: "Website Test Lead",
    lastName: "Integration",
    email: `website.test.${timestamp}@example.com`,
    phone: `+1987654${String(timestamp).slice(-4)}`,
    company: "Acme Web Solutions",
    message: "Website integration test submission via external form",
    source: "WEBSITE",
    medium: "contact-form",
    formId: "main-contact-form-v1",
    landingPageUrl: "https://example.com/contact-us",
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "spring_inbound_2026",
    utmContent: "cta_button_top",
    utmTerm: "b2b calling software"
  };

  const tenantKey = "ca_live_7139e1f2c0312291cbfba340e9364301"; // Supra

  console.log("Submitting test lead to http://localhost:8000/api/public/leads/capture ...");
  console.log("Payload:", JSON.stringify(testPayload, null, 2));

  const response = await fetch("http://localhost:8000/api/public/leads/capture", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Key": tenantKey,
    },
    body: JSON.stringify(testPayload),
  });

  const statusCode = response.status;
  const responseData = await response.json();

  console.log(`\nHTTP Status: ${statusCode}`);
  console.log("Response Data:", JSON.stringify(responseData, null, 2));

  if (!responseData.success && !responseData.lead) {
    console.error("Submission failed!");
    return;
  }

  const createdLeadId = responseData.lead?.id || responseData.id;
  console.log(`\nVerifying lead ${createdLeadId} in database...`);

  const leadInDb = await prisma.lead.findUnique({
    where: { id: createdLeadId },
    include: {
      client: { select: { id: true, name: true } },
      stage: { select: { id: true, name: true } },
    },
  });

  console.log("\n--- CRM Lead Verification in DB ---");
  console.log("Lead ID:", leadInDb.id);
  console.log("Tenant:", leadInDb.client.name, `(${leadInDb.clientId})`);
  console.log("Name:", `${leadInDb.firstName} ${leadInDb.lastName}`);
  console.log("Email:", leadInDb.email);
  console.log("Phone:", leadInDb.phone);
  console.log("Company:", leadInDb.company);
  console.log("Source:", leadInDb.source);
  console.log("Medium:", leadInDb.medium);
  console.log("Notes/Message:", leadInDb.notes);
  console.log("Form ID:", leadInDb.formId);
  console.log("Landing Page URL:", leadInDb.landingPageUrl);
  console.log("UTM Source:", leadInDb.utmSource);
  console.log("UTM Medium:", leadInDb.utmMedium);
  console.log("UTM Campaign:", leadInDb.utmCampaign);
  console.log("UTM Content:", leadInDb.utmContent);
  console.log("UTM Term:", leadInDb.utmTerm);
  console.log("Created At:", leadInDb.createdAt);
  console.log("Is Duplicate:", leadInDb.isDuplicate);
}

main().catch(console.error).finally(() => prisma.$disconnect());
