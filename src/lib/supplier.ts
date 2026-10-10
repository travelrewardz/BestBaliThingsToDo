import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type BadgeTone = "neutral" | "green" | "red" | "amber" | "blue" | "brand";

/** Badge tone for a Supplier.status value. */
export function supplierStatusTone(status: string): BadgeTone {
  switch (status) {
    case "ACTIVE":
    case "APPROVED":
      return "green";
    case "PENDING":
      return "amber";
    case "SUSPENDED":
    case "REJECTED":
      return "red";
    default:
      return "neutral";
  }
}

/** Badge tone for a Product.status value. */
export function productStatusTone(status: string): BadgeTone {
  switch (status) {
    case "PUBLISHED":
    case "APPROVED":
      return "green";
    case "SUBMITTED":
    case "IN_REVIEW":
      return "blue";
    case "CHANGES_REQUESTED":
      return "amber";
    case "REJECTED":
      return "red";
    default:
      return "neutral";
  }
}

/** Badge tone for a Booking.status value. */
export function bookingStatusTone(status: string): BadgeTone {
  switch (status) {
    case "PAID":
    case "CONFIRMED":
      return "green";
    case "SUPPLIER_CONFIRMATION_REQUIRED":
      return "blue";
    case "PENDING":
    case "AWAITING_PAYMENT":
    case "REFUND_REQUESTED":
      return "amber";
    case "CANCELLED":
    case "REFUNDED":
    case "NO_SHOW":
      return "red";
    case "COMPLETED":
      return "brand";
    default:
      return "neutral";
  }
}

/** "SUPPLIER_CONFIRMATION_REQUIRED" → "Supplier Confirmation Required". */
export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Server-component guard for every page inside the supplier panel.
 * Redirects to the login page when signed out and to the storefront
 * (or back to /supplier, which renders the "no profile" state) otherwise.
 */
export async function requireSupplierPanel() {
  const user = await getSessionUser();
  if (!user) redirect("/supplier/login");
  if (user.role === "ADMIN") redirect("/admin");
  if (user.role !== "SUPPLIER") redirect("/");
  if (!user.supplierId) redirect("/supplier");

  const supplier = await prisma.supplier.findUnique({ where: { id: user.supplierId } });
  if (!supplier) redirect("/supplier");
  return { user, supplier };
}
