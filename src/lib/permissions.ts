/**
 * Permission catalogue — seeded into the Permission table and used by
 * role guards throughout the app. "*" grants everything (super admin).
 */
export type PermissionDef = { code: string; label: string; group: string };

export const PERMISSIONS: PermissionDef[] = [
  // Admin
  { code: "admin.dashboard.view", label: "View admin dashboard", group: "Admin" },
  { code: "admin.analytics.view", label: "View analytics", group: "Admin" },
  { code: "admin.supplier.manage", label: "Manage suppliers", group: "Admin" },
  { code: "admin.product.manage", label: "Approve / reject products", group: "Admin" },
  { code: "admin.booking.manage", label: "Manage bookings", group: "Admin" },
  { code: "admin.customer.manage", label: "Manage customers", group: "Admin" },
  { code: "admin.payment.manage", label: "Manage payments & refunds", group: "Admin" },
  { code: "admin.payout.manage", label: "Manage supplier payouts", group: "Admin" },
  { code: "admin.review.moderate", label: "Moderate reviews", group: "Admin" },
  { code: "admin.coupon.manage", label: "Manage coupons & promotions", group: "Admin" },
  { code: "admin.cms.manage", label: "Manage CMS content", group: "Admin" },
  { code: "admin.seo.manage", label: "Manage SEO settings", group: "Admin" },
  { code: "admin.settings.manage", label: "Manage platform settings", group: "Admin" },
  { code: "admin.audit.view", label: "View audit logs", group: "Admin" },
  { code: "admin.support.manage", label: "Manage support tickets", group: "Admin" },
  { code: "admin.media.manage", label: "Manage media library", group: "Admin" },
  { code: "admin.catalog.manage", label: "Manage categories & destinations", group: "Admin" },

  // Supplier
  { code: "supplier.dashboard.view", label: "View supplier dashboard", group: "Supplier" },
  { code: "supplier.profile.edit", label: "Edit supplier profile", group: "Supplier" },
  { code: "supplier.product.create", label: "Create products", group: "Supplier" },
  { code: "supplier.product.edit", label: "Edit own products", group: "Supplier" },
  { code: "supplier.product.submit", label: "Submit products for approval", group: "Supplier" },
  { code: "supplier.booking.manage", label: "Manage own bookings", group: "Supplier" },
  { code: "supplier.availability.edit", label: "Edit availability & pricing", group: "Supplier" },
  { code: "supplier.payout.view", label: "View own payouts & earnings", group: "Supplier" },
  { code: "supplier.review.view", label: "View reviews for own products", group: "Supplier" },

  // Customer
  { code: "customer.booking.create", label: "Create bookings", group: "Customer" },
  { code: "customer.booking.view", label: "View own bookings", group: "Customer" },
  { code: "customer.booking.cancel", label: "Cancel own bookings", group: "Customer" },
  { code: "customer.review.create", label: "Write reviews", group: "Customer" },
  { code: "customer.favorite.manage", label: "Manage favorites", group: "Customer" },
  { code: "customer.profile.edit", label: "Edit own profile", group: "Customer" },
];

/** Role → permission codes granted on seed. */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["*"],
  supplier: [
    "supplier.dashboard.view",
    "supplier.profile.edit",
    "supplier.product.create",
    "supplier.product.edit",
    "supplier.product.submit",
    "supplier.booking.manage",
    "supplier.availability.edit",
    "supplier.payout.view",
    "supplier.review.view",
    "customer.booking.view",
    "customer.review.create",
    "customer.favorite.manage",
    "customer.profile.edit",
  ],
  customer: [
    "customer.booking.create",
    "customer.booking.view",
    "customer.booking.cancel",
    "customer.review.create",
    "customer.favorite.manage",
    "customer.profile.edit",
  ],
};
