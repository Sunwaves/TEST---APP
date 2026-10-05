import type { Prisma } from "@prisma/client";

/** Case-insensitive client search across name, phone and email. */
export function clientSearch(q: string | undefined): Prisma.ClientWhereInput {
  if (!q) return {};
  const match = { contains: q, mode: "insensitive" as const };
  return { OR: [{ name: match }, { phone: match }, { email: match }] };
}
