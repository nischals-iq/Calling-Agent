import 'dotenv/config';
import { PrismaClient, UserRole, SubscriptionPlan, ClientStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database for Module 1...');

  // 1. Seed Platform Admin
  const adminEmail = 'admin@dashmindsiq.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Admin@123456', salt);

  const adminPermissions = [
    'clients:read',
    'clients:write',
    'clients:delete',
    'plans:read',
    'plans:write',
    'admin_users:read',
    'admin_users:write',
    'audit_logs:read',
    'dashboard:read',
    'settings:manage',
  ];

  if (!existingAdmin) {
    const admin = await prisma.user.create({
      data: {
        name: 'Platform Administrator',
        email: adminEmail,
        passwordHash,
        role: UserRole.PLATFORM_ADMIN,
        isActive: true,
        permissions: adminPermissions,
        mobile: '+91 9876543210',
      },
    });
    console.log(`Created Platform Admin: ${admin.email} (Password: Admin@123456)`);
  } else {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        passwordHash,
        role: UserRole.PLATFORM_ADMIN,
        isActive: true,
        permissions: adminPermissions,
      },
    });
    console.log(`Updated Platform Admin: ${adminEmail} (Password: Admin@123456)`);
  }

  // 2. Seed a sample client if none exists for instant verification
  const clientCount = await prisma.client.count();
  if (clientCount === 0) {
    const defaultStages = [
      { name: 'New', order: 1, color: '#3B82F6', probability: 10, isWon: false, isLost: false },
      { name: 'Contacted', order: 2, color: '#8B5CF6', probability: 25, isWon: false, isLost: false },
      { name: 'Qualified', order: 3, color: '#EC4899', probability: 40, isWon: false, isLost: false },
      { name: 'Demo/Meeting', order: 4, color: '#EAB308', probability: 60, isWon: false, isLost: false },
      { name: 'Proposal', order: 5, color: '#F97316', probability: 75, isWon: false, isLost: false },
      { name: 'Negotiation', order: 6, color: '#06B6D4', probability: 90, isWon: false, isLost: false },
      { name: 'Won', order: 7, color: '#10B981', probability: 100, isWon: true, isLost: false },
      { name: 'Lost', order: 8, color: '#EF4444', probability: 0, isWon: false, isLost: true },
    ];

    const sampleClient = await prisma.client.create({
      data: {
        name: 'Acme Real Estate Corp',
        businessCategory: 'Real Estate & Properties',
        primaryContactName: 'Rajesh Sharma',
        primaryContactEmail: 'rajesh@acmerealestate.com',
        primaryContactPhone: '+91 9811122334',
        companyAddress: 'Suite 401, Tech Park, Bangalore',
        country: 'India',
        timezone: 'Asia/Kolkata',
        status: ClientStatus.ACTIVE,
        plan: SubscriptionPlan.PRO,
        settings: {
          leadSources: ['META', 'GOOGLE', 'WEBSITE'],
          notificationRules: {
            emailOnNewLead: true,
            whatsappOnNewLead: true,
            dailySummaryEmail: true,
          },
        },
        leadStages: {
          create: defaultStages,
        },
      },
    });

    const clientAdminPasswordHash = await bcrypt.hash('ClientAdmin@123', salt);
    await prisma.user.create({
      data: {
        clientId: sampleClient.id,
        name: 'Rajesh Sharma',
        email: 'rajesh@acmerealestate.com',
        passwordHash: clientAdminPasswordHash,
        role: UserRole.CLIENT_ADMIN,
        isActive: true,
        permissions: ['dashboard:read', 'leads:read', 'leads:write'],
      },
    });

    await prisma.auditLog.create({
      data: {
        clientId: sampleClient.id,
        action: 'CLIENT_CREATED',
        resource: 'Client',
        resourceId: sampleClient.id,
        details: { name: sampleClient.name, seeded: true },
      },
    });

    console.log(`Seeded Demo Client: ${sampleClient.name}`);
  }

  // 3. Ensure Client Users & Teams for Acme Real Estate Corp
  const acmeClient = await prisma.client.findFirst({
    where: { name: { contains: 'Acme', mode: 'insensitive' } },
  });

  if (acmeClient) {
    const acmePasswordHash = await bcrypt.hash('Client@123', salt);

    // Seed Teams
    let salesTeam = await prisma.team.findFirst({
      where: { clientId: acmeClient.id, name: 'Enterprise Sales Alpha' },
    });
    if (!salesTeam) {
      salesTeam = await prisma.team.create({
        data: {
          clientId: acmeClient.id,
          name: 'Enterprise Sales Alpha',
          description: 'High-value property deals and corporate outreach',
          type: 'SALES',
          isActive: true,
        },
      });
      console.log('Seeded Team: Enterprise Sales Alpha');
    }

    let mktTeam = await prisma.team.findFirst({
      where: { clientId: acmeClient.id, name: 'Growth Marketing Squad' },
    });
    if (!mktTeam) {
      mktTeam = await prisma.team.create({
        data: {
          clientId: acmeClient.id,
          name: 'Growth Marketing Squad',
          description: 'Ad campaign attribution and lead generation',
          type: 'MARKETING',
          isActive: true,
        },
      });
      console.log('Seeded Team: Growth Marketing Squad');
    }

    // Seed Users for all roles
    const demoUsers = [
      {
        name: 'Vikram Malhotra',
        email: 'vikram.manager@acmerealestate.com',
        role: UserRole.SALES_MANAGER,
        teamId: salesTeam.id,
        mobile: '+91 9822233445',
      },
      {
        name: 'Ananya Roy',
        email: 'ananya.sales@acmerealestate.com',
        role: UserRole.SALES_EXECUTIVE,
        teamId: salesTeam.id,
        mobile: '+91 9833344556',
      },
      {
        name: 'Karan Mehra',
        email: 'karan.marketing@acmerealestate.com',
        role: UserRole.MARKETING_USER,
        teamId: mktTeam.id,
        mobile: '+91 9844455667',
      },
      {
        name: 'Priya Sen',
        email: 'priya.viewer@acmerealestate.com',
        role: UserRole.VIEWER,
        teamId: null,
        mobile: '+91 9855566778',
      },
    ];

    for (const u of demoUsers) {
      const exists = await prisma.user.findUnique({ where: { email: u.email } });
      if (!exists) {
        await prisma.user.create({
          data: {
            clientId: acmeClient.id,
            name: u.name,
            email: u.email,
            mobile: u.mobile,
            passwordHash: acmePasswordHash,
            role: u.role,
            teamId: u.teamId,
            isActive: true,
            preferences: { emailAlerts: true, dailyDigest: true },
          },
        });
        console.log(`Seeded User: ${u.email} (${u.role})`);
      }
    }

    // Set manager for sales team
    const mgr = await prisma.user.findUnique({ where: { email: 'vikram.manager@acmerealestate.com' } });
    if (mgr) {
      await prisma.team.update({
        where: { id: salesTeam.id },
        data: { managerId: mgr.id },
      });
    }
  }

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
