/**
 * Idempotent account creator for demo/staging credentials.
 * Run: node scripts/create-accounts.mjs
 *
 * Accounts (development only):
 *   Super Admin  portal@balithingstodo.net  / BTTD525@bttd
 *   Supplier     booking@balithingstodo.net / BTTD525@bttd
 *
 * Existing users with these emails get their password/role refreshed;
 * nothing else in the database is touched.
 */
import { loadEnv } from "../src/lib/env-loader.ts";

loadEnv();

const { PrismaClient } = await import("@prisma/client");
const bcrypt = await import("bcryptjs");

const prisma = new PrismaClient();
const ACCOUNTS = [
  {
    email: "portal@balithingstodo.net",
    password: "BTTD525@bttd",
    name: "Super Admin",
    role: "ADMIN",
    roleName: "admin",
    phone: "+62811000099",
  },
  {
    email: "booking@balithingstodo.net",
    password: "BTTD525@bttd",
    name: "Booking Desk",
    role: "SUPPLIER",
    roleName: "supplier",
    phone: "+62811000098",
    supplier: {
      companyName: "BTTD Booking Desk",
      slug: "bttd-booking-desk",
      city: "Ubud",
      description: "Demo supplier account for the BTTD booking desk.",
    },
  },
];

async function upsertAccount(a) {
  const role = await prisma.role.findUnique({ where: { name: a.roleName } });
  if (!role) throw new Error(`Role "${a.roleName}" not found — run db:seed first.`);

  const passwordHash = await bcrypt.hash(a.password, 10);
  const user = await prisma.user.upsert({
    where: { email: a.email },
    create: {
      email: a.email,
      passwordHash,
      name: a.name,
      role: a.role,
      roleId: role.id,
      phone: a.phone,
      emailVerifiedAt: new Date(),
      status: "ACTIVE",
    },
    update: {
      passwordHash,
      name: a.name,
      role: a.role,
      roleId: role.id,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  let supplierId = null;
  if (a.supplier) {
    const supplier = await prisma.supplier.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        companyName: a.supplier.companyName,
        slug: a.supplier.slug,
        description: a.supplier.description,
        city: a.supplier.city,
        country: "Indonesia",
        email: a.email,
        phone: a.phone,
        status: "ACTIVE",
        approvedAt: new Date(),
      },
      update: { status: "ACTIVE" },
    });
    supplierId = supplier.id;
  }

  console.log(`✓ ${a.role}  ${a.email}  (userId=${user.id}${supplierId ? `, supplierId=${supplierId}` : ""})`);
}

try {
  for (const a of ACCOUNTS) await upsertAccount(a);
} finally {
  await prisma.$disconnect();
}
