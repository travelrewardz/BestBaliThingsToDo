import { prisma } from "@/lib/prisma";

/** Aggregations for admin & supplier dashboards. */

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export type DateRange = { from: Date; to: Date };

export function rangeFor(filter: string): DateRange {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23, 59, 59, 999);
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  switch (filter) {
    case "today":
      return { from: startOfDay, to: endOfDay };
    case "yesterday": {
      const from = daysAgo(1);
      const to = new Date(from);
      to.setUTCHours(23, 59, 59, 999);
      return { from, to };
    }
    case "7d":
      return { from: daysAgo(6), to: endOfDay };
    case "30d":
      return { from: daysAgo(29), to: endOfDay };
    case "3m":
      return { from: daysAgo(89), to: endOfDay };
    case "6m":
      return { from: daysAgo(179), to: endOfDay };
    case "12m":
      return { from: daysAgo(364), to: endOfDay };
    default:
      return { from: daysAgo(29), to: endOfDay };
  }
}

const PAID_STATUSES = ["PAID", "CONFIRMED", "COMPLETED"];

export async function adminDashboardStats() {
  const startToday = (() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  })();
  const startMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

  const [
    totalBookings,
    todayBookings,
    upcomingBookings,
    totalCustomers,
    totalSuppliers,
    pendingSuppliers,
    activeTours,
    pendingTours,
    paidAgg,
    cancelledCount,
    refundRequested,
    pendingPayouts,
    monthPaid,
    topTours,
    topSuppliers,
    newCustomers7d,
    events7d,
  ] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.count({ where: { createdAt: { gte: startToday } } }),
    prisma.booking.count({
      where: {
        tourDate: { gte: startToday },
        status: { in: ["PAID", "CONFIRMED", "SUPPLIER_CONFIRMATION_REQUIRED", "AWAITING_PAYMENT"] },
      },
    }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.supplier.count(),
    prisma.supplier.count({ where: { status: "PENDING" } }),
    prisma.product.count({ where: { status: "PUBLISHED" } }),
    prisma.product.count({ where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } } }),
    prisma.booking.aggregate({
      where: { status: { in: PAID_STATUSES } },
      _sum: { totalCents: true, commissionCents: true, supplierEarningsCents: true },
      _count: true,
    }),
    prisma.booking.count({ where: { status: { in: ["CANCELLED", "REFUNDED", "REFUND_REQUESTED"] } } }),
    prisma.booking.count({ where: { status: { in: ["REFUND_REQUESTED", "REFUNDED"] } } }),
    prisma.payout.aggregate({
      where: { status: { in: ["PENDING", "APPROVED"] } },
      _sum: { amountCents: true },
    }),
    prisma.booking.aggregate({
      where: { status: { in: PAID_STATUSES }, createdAt: { gte: startMonth } },
      _sum: { totalCents: true, commissionCents: true },
    }),
    prisma.product.groupBy({
      by: ["id", "name", "slug"],
      where: { status: "PUBLISHED" },
      _sum: { bookingCount: true },
      orderBy: { _sum: { bookingCount: "desc" } },
      take: 5,
    }),
    prisma.supplier.findMany({
      orderBy: { totalRevenueCents: "desc" },
      take: 5,
      select: { id: true, companyName: true, slug: true, totalRevenueCents: true },
    }),
    prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: daysAgo(6) } } }),
    prisma.analyticsEvent.count({ where: { createdAt: { gte: daysAgo(6) } } }),
  ]);

  // 30-day booking trend (bookings per day)
  const trendRaw = await prisma.booking.groupBy({
    by: ["createdAt"],
    where: { createdAt: { gte: daysAgo(29) } },
    _count: { _all: true },
  });
  const trend = Array.from({ length: 30 }, (_, i) => {
    const day = daysAgo(29 - i);
    const key = day.toISOString().slice(0, 10);
    const row = trendRaw.find(
      (r) => r.createdAt.toISOString().slice(0, 10) === key
    );
    return { date: key, count: row?._count._all ?? 0 };
  });

  const gross = paidAgg._sum.totalCents ?? 0;
  const platformCommission = paidAgg._sum.commissionCents ?? 0;
  const supplierEarnings = paidAgg._sum.supplierEarningsCents ?? 0;
  const avgBooking = paidAgg._count ? Math.round(gross / paidAgg._count) : 0;
  const conversion = events7d > 0 ? Math.min(100, (paidAgg._count / events7d) * 100) : 0;

  return {
    totalBookings,
    todayBookings,
    upcomingBookings,
    totalCustomers,
    newCustomers7d,
    totalSuppliers,
    pendingSuppliers,
    activeTours,
    pendingTours,
    grossRevenueCents: gross,
    platformCommissionCents: platformCommission,
    supplierEarningsCents: supplierEarnings,
    monthRevenueCents: monthPaid._sum.totalCents ?? 0,
    monthCommissionCents: monthPaid._sum.commissionCents ?? 0,
    cancelledCount,
    refundRequested,
    pendingPayoutCents: pendingPayouts._sum.amountCents ?? 0,
    avgBookingCents: avgBooking,
    conversionRate: Math.round(conversion * 10) / 10,
    topTours: topTours.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      bookings: t._sum.bookingCount ?? 0,
    })),
    topSuppliers: topSuppliers.map((s) => ({
      id: s.id,
      name: s.companyName,
      revenueCents: s.totalRevenueCents,
    })),
    trend,
  };
}

export async function supplierDashboardStats(supplierId: string) {
  const startToday = (() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  })();
  const startMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

  const [totalBookings, upcoming, paidAgg, monthAgg, pendingPayout, paidPayout, products, reviews, openTicketsCount] =
    await Promise.all([
      prisma.booking.count({ where: { supplierId } }),
      prisma.booking.count({
        where: {
          supplierId,
          tourDate: { gte: startToday },
          status: { in: ["PAID", "CONFIRMED", "SUPPLIER_CONFIRMATION_REQUIRED"] },
        },
      }),
      prisma.booking.aggregate({
        where: { supplierId, status: { in: PAID_STATUSES } },
        _sum: { totalCents: true, supplierEarningsCents: true },
        _count: true,
      }),
      prisma.booking.aggregate({
        where: { supplierId, status: { in: PAID_STATUSES }, createdAt: { gte: startMonth } },
        _sum: { totalCents: true, supplierEarningsCents: true },
      }),
      prisma.commission.aggregate({
        where: {
          supplierId,
          payoutId: null,
          booking: { status: { in: PAID_STATUSES } },
        },
        _sum: { supplierCents: true },
      }),
      prisma.payout.aggregate({
        where: { supplierId, status: { in: ["APPROVED", "PAID"] } },
        _sum: { amountCents: true },
      }),
      prisma.product.groupBy({
        by: ["status"],
        where: { supplierId },
        _count: true,
      }),
      prisma.review.aggregate({
        where: { product: { supplierId }, status: "APPROVED" },
        _avg: { rating: true },
        _count: true,
      }),
      prisma.commission.count({
        where: { supplierId, payoutId: null, booking: { status: { in: PAID_STATUSES } } },
      }),
    ]);

  return {
    totalBookings,
    upcomingBookings: upcoming,
    totalSalesCents: paidAgg._sum.totalCents ?? 0,
    netEarningsCents: paidAgg._sum.supplierEarningsCents ?? 0,
    monthSalesCents: monthAgg._sum.totalCents ?? 0,
    monthEarningsCents: monthAgg._sum.supplierEarningsCents ?? 0,
    pendingPayoutCents: pendingPayout._sum.supplierCents ?? 0,
    paidPayoutCents: paidPayout._sum.amountCents ?? 0,
    unsettledCommissions: openTicketsCount,
    productCounts: Object.fromEntries(products.map((p) => [p.status, p._count])),
    ratingAvg: reviews._avg.rating ?? 0,
    ratingCount: reviews._count,
  };
}

/** Analytics for Admin → Analytics: gross value, top products, funnel counts. */
export async function analyticsSummary(range: DateRange) {
  const rangeFilter = { gte: range.from, lte: range.to };
  const where = { createdAt: rangeFilter };
  const [bookings, paid, customers, views, searches, checkouts] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.aggregate({
      where: { ...where, status: { in: PAID_STATUSES } },
      _sum: { totalCents: true, commissionCents: true, supplierEarningsCents: true },
      _count: true,
    }),
    prisma.user.count({ where: { role: "CUSTOMER", createdAt: rangeFilter } }),
    prisma.analyticsEvent.count({ where: { name: "product_view", createdAt: rangeFilter } }),
    prisma.analyticsEvent.count({ where: { name: "search", createdAt: rangeFilter } }),
    prisma.analyticsEvent.count({ where: { name: "checkout", createdAt: rangeFilter } }),
  ]);
  const paidCount = paid._count ?? 0;
  const gross = paid._sum?.totalCents ?? 0;
  const commission = paid._sum?.commissionCents ?? 0;
  const supplierEarnings = paid._sum?.supplierEarningsCents ?? 0;
  const denominator = checkouts > 0 ? checkouts : views;
  const conversion = denominator > 0 ? (paidCount / denominator) * 100 : 0;
  return {
    grossBookingValueCents: gross,
    netRevenueCents: commission,
    supplierPayoutCents: supplierEarnings,
    commissionCents: commission,
    bookings: bookings,
    paidBookings: paidCount,
    avgBookingCents: paidCount ? Math.round(gross / paidCount) : 0,
    newCustomers: customers,
    productViews: views,
    searches,
    checkouts,
    conversionRate: Math.round(conversion * 10) / 10,
  };
}
