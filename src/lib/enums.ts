/**
 * Central definition of all status fields and their allowed values.
 * SQLite does not support Prisma enums, so statuses are strings that are
 * validated with these constants (and with zod on the API boundary).
 */

export const USER_ROLES = ["ADMIN", "SUPPLIER", "CUSTOMER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "PENDING", "SUSPENDED"] as const;

export const SUPPLIER_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
  "ACTIVE",
  "INACTIVE",
] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export const PRODUCT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "REJECTED",
  "APPROVED",
  "PUBLISHED",
  "UNPUBLISHED",
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const BOOKING_STATUSES = [
  "PENDING",
  "AWAITING_PAYMENT",
  "PAID",
  "CONFIRMED",
  "SUPPLIER_CONFIRMATION_REQUIRED",
  "COMPLETED",
  "CANCELLED",
  "REFUND_REQUESTED",
  "REFUNDED",
  "NO_SHOW",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "REFUNDED",
  "REFUNDING",
] as const;

export const PAYMENT_PROVIDERS = [
  "STRIPE",
  "PAYPAL",
  "MIDTRANS",
  "XENDIT",
  "BANK_TRANSFER",
  "MANUAL",
  "CASH",
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const REVIEW_STATUSES = ["PENDING", "APPROVED", "HIDDEN", "FLAGGED"] as const;
export const PAYOUT_STATUSES = ["PENDING", "APPROVED", "PAID", "REJECTED"] as const;
export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
] as const;

export const NOTIFICATION_TYPES = [
  "BOOKING_RECEIVED",
  "PAYMENT_RECEIVED",
  "BOOKING_CONFIRMED",
  "BOOKING_CANCELLED",
  "TOUR_REMINDER",
  "REVIEW_REMINDER",
  "REFUND_NOTIFICATION",
  "NEW_BOOKING",
  "NEW_CUSTOMER",
  "PRODUCT_APPROVED",
  "PRODUCT_REJECTED",
  "PRODUCT_CHANGES_REQUESTED",
  "PAYOUT_NOTIFICATION",
  "NEW_SUPPLIER",
  "NEW_PRODUCT",
  "SUPPLIER_APPROVED",
  "SUPPLIER_REJECTED",
  "NEW_REVIEW",
  "REFUND_REQUEST",
  "GENERAL",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  AWAITING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  CONFIRMED: "Confirmed",
  SUPPLIER_CONFIRMATION_REQUIRED: "Supplier confirmation required",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUND_REQUESTED: "Refund requested",
  REFUNDED: "Refunded",
  NO_SHOW: "No-show",
};

export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In review",
  CHANGES_REQUESTED: "Changes requested",
  REJECTED: "Rejected",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  UNPUBLISHED: "Unpublished",
};

export const SUPPLIER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};
