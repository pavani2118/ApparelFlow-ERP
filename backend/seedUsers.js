
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Creating ApparelFlow Demo Users...");

  const users = [
    {
      email: "supervisor@apparelflow.demo",
      fullName: "Cutting Supervisor",
      role: "cutting_supervisor",
      password: process.env.DEMO_SUPERVISOR_PASSWORD
    },
    {
      email: "verifier@apparelflow.demo",
      fullName: "Cutting Verifier",
      role: "cutting_verifier",
      password: process.env.DEMO_VERIFIER_PASSWORD
    },
    {
      email: "sewing@apparelflow.demo",
      fullName: "Sewing Supervisor",
      role: "sewing_supervisor",
      password: process.env.DEMO_SEWING_PASSWORD
    }
  ];

  for (const user of users) {
    if (!user.password || user.password.length < 12) {
      throw new Error(
        `Missing or short demo password for ${user.role}`
      );
    }
  }

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 12);

    await prisma.user.upsert({
      where: {
        email: user.email
      },
      update: {
        fullName: user.fullName,
        role: user.role,
        passwordHash: passwordHash
      },
      create: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        passwordHash: passwordHash
      }
    });

    console.log(`User created/updated: ${user.role}`);
  }

  console.log("Demo Users Seeding Completed!");
}

main()
  .catch((error) => {
    console.error("Failed to seed demo users:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
