// Gives a salon PRO for free (friends, partners, support), or takes it away.
//   npm run give-pro -- <owner email or salon address> <days | off>
// Examples:  npm run give-pro -- ana@example.com 365     npm run give-pro -- goldie-test-salon off
// Uses DATABASE_URL from apps/web/.env; to change the live site, run it with the live DATABASE_URL.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main(who: string | undefined, amount: string | undefined) {
  if (!who || !amount) throw new Error("Usage: npm run give-pro -- <owner email or salon address> <days | off>");

  const user = await db.user.findUnique({ where: { email: who.toLowerCase() } });
  const business = user
    ? await db.business.findUnique({ where: { id: user.businessId } })
    : await db.business.findUnique({ where: { slug: who } });
  if (!business) throw new Error(`No salon found for "${who}" (try the owner's email or the part after /book/).`);

  const days = amount === "off" ? 0 : Number(amount);
  if (!Number.isFinite(days) || days < 0) throw new Error('The second value must be a number of days or "off".');

  const proUntil = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
  await db.business.update({ where: { id: business.id }, data: { proUntil } });
  console.log(
    proUntil
      ? `${business.name} has PRO until ${proUntil.toDateString()}.`
      : `${business.name}: free PRO removed (a paid subscription, if any, is unaffected).`,
  );
}

main(process.argv[2], process.argv[3])
  .catch((err: Error) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
