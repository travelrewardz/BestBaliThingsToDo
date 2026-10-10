import type { BadgeTone } from "@/lib/supplier";


/** Nav + section definition for the admin sidebar. */
export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Overview", icon: "📊" },
  { href: "/admin/tours", label: "Tours", icon: "🏝️" },
  { href: "/admin/destinations", label: "Destinations", icon: "📍" },
  { href: "/admin/availability", label: "Availability", icon: "🗓️" },
  { href: "/admin/customers", label: "Customers", icon: "👥" },
  { href: "/admin/bookings", label: "Bookings", icon: "🎟️" },
  { href: "/admin/suppliers", label: "Suppliers", icon: "🧑‍🌾" },
  { href: "/admin/agents", label: "Agents", icon: "🤝" },
  { href: "/admin/reviews", label: "Reviews", icon: "⭐" },
  { href: "/admin/analysis", label: "Analysis", icon: "📈" },
  { href: "/admin/cms", label: "CMS", icon: "📝" },
  { href: "/admin/reports", label: "Reports", icon: "🧾" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
] as const;

export function reviewStatusTone(status: string): BadgeTone {
  switch (status) {
    case "APPROVED":
      return "green";
    case "PENDING":
      return "amber";
    case "FLAGGED":
      return "red";
    case "HIDDEN":
      return "neutral";
    default:
      return "neutral";
  }
}

export function agentStatusTone(status: string): BadgeTone {
  switch (status) {
    case "ACTIVE":
      return "green";
    case "PENDING":
      return "amber";
    case "SUSPENDED":
      return "red";
    default:
      return "neutral";
  }
}

export function userStatusTone(status: string): BadgeTone {
  switch (status) {
    case "ACTIVE":
      return "green";
    case "PENDING":
      return "amber";
    case "SUSPENDED":
      return "red";
    default:
      return "neutral";
  }
}

export const AGENT_STATUSES = ["ACTIVE", "PENDING", "SUSPENDED"] as const;
export const USER_STATUSES = ["ACTIVE", "PENDING", "SUSPENDED"] as const;

/** Product statuses an admin can move a tour to. */
export const TOUR_ADMIN_STATUSES = [
  "PUBLISHED",
  "APPROVED",
  "CHANGES_REQUESTED",
  "REJECTED",
  "UNPUBLISHED",
  "IN_REVIEW",
] as const;

/** Parse ?page= with a sane bounds check. */
export function pageParam(raw: string | undefined, perPage: number, total: number): number {
  const page = Math.max(1, Math.floor(Number(raw) || 1));
  const pages = Math.max(1, Math.ceil(total / perPage));
  return Math.min(page, pages);
}

export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Makassar" }).format(new Date(d)) : "—";

export const fmtDateTime = (d: Date | string | null | undefined) =>
  d
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Makassar",
      }).format(new Date(d))
    : "—";
