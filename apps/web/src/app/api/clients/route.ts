import { currentBusiness, handle, searchParamsObject } from "@/lib/api";
import { clientSearch } from "@/lib/clients";
import { prisma } from "@/lib/db";
import { clientInput } from "@/lib/validation";

export const GET = handle(async (req: Request) => {
  const business = await currentBusiness();
  const q = searchParamsObject(req.url).q?.trim();
  const clients = await prisma.client.findMany({
    where: {
      businessId: business.id,
      ...clientSearch(q),
    },
    orderBy: { name: "asc" },
  });
  return Response.json(clients);
});

export const POST = handle(async (req: Request) => {
  const business = await currentBusiness();
  const data = clientInput.parse(await req.json());
  const client = await prisma.client.create({ data: { ...data, businessId: business.id } });
  return Response.json(client, { status: 201 });
});
