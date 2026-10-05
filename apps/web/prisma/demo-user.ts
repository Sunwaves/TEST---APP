// Demo owner login (demo@goldie.test / demo1234), used by the seed script.
// Run directly to add the login to an existing database without touching its data:
//   npx tsx prisma/demo-user.ts
import { PrismaClient } from "@prisma/client";
import { DEMO_EMAIL } from "../src/lib/accounts";
import { hashPassword } from "../src/lib/auth";

export const DEMO_PASSWORD = "demo1234";

export async function ensureDemoUser(prisma: PrismaClient, businessId: string) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { businessId, passwordHash },
    create: { email: DEMO_EMAIL, name: "Demo Owner", passwordHash, businessId },
  });
  await prisma.business.update({ where: { id: businessId }, data: { notifyEmail: DEMO_EMAIL } });
}

if (process.argv[1]?.endsWith("demo-user.ts")) {
  const prisma = new PrismaClient();
  prisma.business
    .findFirst({ orderBy: { createdAt: "asc" } })
    .then(async (business) => {
      if (!business) throw new Error("No salon in the database yet. Run the seed first.");
      await ensureDemoUser(prisma, business.id);
      console.log(`Demo login added to "${business.name}": ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
