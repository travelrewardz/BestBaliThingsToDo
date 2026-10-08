import { handle, jsonOk, ApiError, parseJson, rateLimit, getIp } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { notifyRole } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).regex(/[0-9]/),
  companyName: z.string().min(2).max(120),
  phone: z.string().min(5).max(30),
  whatsapp: z.string().max(30).optional(),
  website: z.string().max(200).optional(),
  city: z.string().max(60).optional(),
  description: z.string().max(2000).optional(),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(req: Request) {
  return handle(req, async (req) => {
    rateLimit(`supplier-register:${getIp(req)}`, 3, 60_000);
    const body = await parseJson(req, schema);

    const email = body.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, "An account with this email already exists", "exists");

    const supplierRole = await prisma.role.findUnique({ where: { name: "supplier" } });
    const baseSlug = slugify(body.companyName) || "supplier";
    let slug = baseSlug;
    for (let i = 2; await prisma.supplier.findUnique({ where: { slug } }); i++) {
      slug = `${baseSlug}-${i}`;
    }

    const user = await prisma.user.create({
      data: {
        email,
        name: body.name.trim(),
        phone: body.phone,
        passwordHash: await hashPassword(body.password),
        role: "SUPPLIER",
        roleId: supplierRole?.id ?? null,
        status: "ACTIVE",
      },
    });

    const supplier = await prisma.supplier.create({
      data: {
        userId: user.id,
        companyName: body.companyName.trim(),
        slug,
        description: body.description?.trim() || null,
        email,
        phone: body.phone,
        whatsapp: body.whatsapp || body.phone,
        website: body.website || null,
        city: body.city || null,
        status: "PENDING",
      },
    });

    await sendEmail({
      to: email,
      toUserId: user.id,
      template: "welcome",
      vars: { name: user.name, email },
    });
    await notifyRole("ADMIN", {
      type: "NEW_SUPPLIER",
      title: "New supplier application",
      body: `${supplier.companyName} applied to join the marketplace.`,
      link: `/admin/suppliers/${supplier.id}`,
    });
    await audit({
      user: {
        id: user.id,
        email: user.email,
        name: body.companyName,
        role: "SUPPLIER",
        roleId: user.roleId,
        status: user.status,
      },
      action: "SUPPLIER_APPLIED",
      entityType: "Supplier",
      entityId: supplier.id,
      summary: `${supplier.companyName} submitted a supplier application.`,
      ip: getIp(req),
    });

    await createSession(user.id, { ip: getIp(req), userAgent: req.headers.get("user-agent") });
    return jsonOk({ redirect: "/supplier" });
  });
}
