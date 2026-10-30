import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/Calling-agent';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function run() {
  const hash = await bcrypt.hash('Password@123', 10);
  await prisma.user.updateMany({
    where: { email: 'don@gmail.com' },
    data: { passwordHash: hash },
  });
  console.log('SUCCESS_UPDATED_PASSWORD');
  await prisma.$disconnect();
}
run();
