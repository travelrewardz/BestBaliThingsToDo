import { handle, ApiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rangeFor } from "@/lib/dashboard";

const PAID = ["PAID", "CONFIRMED", "COMPLETED"] as const;

/** RFC-4180 escaping (quotes, commas, newlines). */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(cell).join(",")];
  for (const row of rows) lines.push(row.map(cell).join(","));
  // BOM so Excel opens UTF-8 correctly.
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * GET /api/admin/reports/export?range=30d&table=bookings|monthly|suppliers
 * CSV downloads for the Reports section (admin only).
 */
export async function GET(req: Request) {
  return handle(req, async (req) => {
    await requireApiUser(req, { roles: ["ADMIN"] });

    const url = new URL(req.url);
    const range = url.searchParams.get("range") ?? "3m";
    const table = url.searchParams.get("table") ?? "bookings";
    const { from, to } = rangeFor(range);

    if (table === "bookings") {
      const bookings = await prisma.booking.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: [{ createdAt: "desc" }],
        select: {
          reference: true,
          productName: true,
          supplier: { select: { companyName: true } },
          customerName: true,
          customerEmail: true,
          tourDate: true,
          totalTravelers: true,
          status: true,
          totalCents: true,
          commissionCents: true,
          supplierEarningsCents: true,
          currency: true,
          createdAt: true,
        },
      });
      const rows = bookings.map((b) => [
        b.reference,
        b.productName,
        b.supplier.companyName,
        b.customerName,
        b.customerEmail,
        b.tourDate.toISOString().slice(0, 10),
        b.totalTravelers,
        b.status,
        (b.totalCents / 100).toFixed(2),
        (b.commissionCents / 100).toFixed(2),
        (b.supplierEarningsCents / 100).toFixed(2),
        b.currency,
        b.createdAt.toISOString().slice(0, 10),
      ]);
      return csvResponse(
        `bookings-${range}.csv`,
        toCsv(
          ["Reference", "Tour", "Supplier", "Customer", "Email", "Tour date", "Pax", "Status", "Gross", "Commission", "Supplier payout", "Currency", "Created"],
          rows
        )
      );
    }

    if (table === "monthly") {
      const bookings = await prisma.booking.findMany({
        where: { status: { in: [...PAID] }, createdAt: { gte: from, lte: to } },
        select: { createdAt: true, totalCents: true, commissionCents: true, supplierEarningsCents: true },
      });
      const byMonth = new Map<string, { bookings: number; gross: number; commission: number; supplier: number }>();
      for (const b of bookings) {
        const key = b.createdAt.toISOString().slice(0, 7);
        const row = byMonth.get(key) ?? { bookings: 0, gross: 0, commission: 0, supplier: 0 };
        row.bookings += 1;
        row.gross += b.totalCents;
        row.commission += b.commissionCents;
        row.supplier += b.supplierEarningsCents;
        byMonth.set(key, row);
      }
      const rows = [...byMonth.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([month, r]) => [month, r.bookings, (r.gross / 100).toFixed(2), (r.commission / 100).toFixed(2), (r.supplier / 100).toFixed(2), "USD"]);
      return csvResponse(
        `monthly-summary-${range}.csv`,
        toCsv(["Month", "Paid bookings", "Gross", "Commission", "Supplier payouts", "Currency"], rows)
      );
    }

    throw new ApiError(400, "Unknown export table", "bad_request");
  });
}
