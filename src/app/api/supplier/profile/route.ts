import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  companyName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(5).max(30),
  whatsapp: z.string().trim().max(30).optional(),
  website: z.string().trim().max(200).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(60).optional(),
  description: z.string().trim().max(2000).optional(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase()),
});

/** Empty strings become undefined so optional columns keep their value. */
const orUndefined = (v: string | undefined) => (v ? v : undefined);

/** PATCH /api/supplier/profile — update the signed-in supplier's company profile. */
export async function PATCH(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { roles: ["SUPPLIER"] });
    if (!user.supplierId) throw new ApiError(403, "No supplier profile on this account", "no_supplier");

    const body = await parseJson(req, schema);

    const supplier = await prisma.supplier.update({
      where: { id: user.supplierId },
      data: {
        companyName: body.companyName,
        email: body.email.trim().toLowerCase(),
        phone: body.phone,
        whatsapp: orUndefined(body.whatsapp),
        website: orUndefined(body.website),
        address: orUndefined(body.address),
        city: orUndefined(body.city),
        description: orUndefined(body.description),
        currency: body.currency,
      },
      select: { id: true, companyName: true, email: true, status: true, currency: true },
    });

    await audit({
      user,
      action: "supplier.profile.update",
      entityType: "Supplier",
      entityId: supplier.id,
      summary: `${user.name} updated the supplier profile (${supplier.companyName}).`,
    });

    return jsonOk({ supplier });
  });
}
