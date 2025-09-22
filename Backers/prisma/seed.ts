import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@mmc.local';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const hashed = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin',
        password: hashed,
        role: Role.ADMIN,
      },
    });
    console.log('Seeded admin user:', adminEmail, 'password: admin123');
  } else {
    console.log('Admin already exists');
  }

  const resources = [
    { name: 'Lecture Room A', description: 'Projector + whiteboard', location: 'Building 1, 2F', qtyTotal: 1 },
    { name: 'Computer Lab 1', description: '30 seats', location: 'IT Building, 3F', qtyTotal: 30 },
    { name: 'School Van', description: '10-seater', location: 'Motorpool', qtyTotal: 1 },
  ];
  for (const r of resources) {
    await prisma.resource.upsert({
      where: { name: r.name },
      update: {},
      create: r,
    });
  }
  console.log('Seeded default resources');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
