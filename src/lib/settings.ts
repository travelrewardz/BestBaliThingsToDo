import { prisma } from "@/lib/prisma";

/** Typed accessors for the Setting table (Admin → Settings). */

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? fallback;
}

export async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const v = await getSetting(key, "");
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function getBoolSetting(key: string, fallback = false): Promise<boolean> {
  const v = await getSetting(key, "");
  if (v === "") return fallback;
  return v === "true" || v === "1";
}

export async function getJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const v = await getSetting(key, "");
  if (!v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(
  key: string,
  value: string,
  meta?: { group?: string; label?: string; type?: string }
): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: {
      key,
      value,
      group: meta?.group ?? "general",
      label: meta?.label ?? key,
      type: meta?.type ?? "text",
    },
    update: { value },
  });
}

export const DEFAULT_SETTINGS: Array<{
  key: string;
  value: string;
  group: string;
  label: string;
  type: string;
}> = [
  { key: "site_name", value: "Bali Things To Do", group: "general", label: "Site name", type: "text" },
  { key: "contact_email", value: "hello@balithingstodo.net", group: "contact", label: "Contact email", type: "text" },
  { key: "contact_phone", value: "+62 812 3456 7890", group: "contact", label: "Contact phone", type: "text" },
  { key: "contact_whatsapp", value: "+6281234567890", group: "contact", label: "WhatsApp number", type: "text" },
  { key: "contact_address", value: "Jl. Raya Ubud, Bali, Indonesia", group: "contact", label: "Address", type: "text" },
  { key: "default_commission_bps", value: "1500", group: "commission", label: "Default platform commission (bps)", type: "number" },
  { key: "base_currency", value: "USD", group: "currency", label: "Base currency", type: "text" },
  {
    key: "currency_rates",
    value: JSON.stringify({ USD: 1, IDR: 15750, EUR: 0.92, GBP: 0.78, AUD: 1.52, SGD: 1.34, MYR: 4.45, CAD: 1.37 }),
    group: "currency",
    label: "Currency rates vs base",
    type: "json",
  },
  { key: "booking_lead_days_reminder", value: "1", group: "booking", label: "Send reminder N days before tour", type: "number" },
  { key: "auto_confirm_bookings", value: "true", group: "booking", label: "Auto-confirm paid bookings", type: "boolean" },
  { key: "payout_min_cents", value: "50000", group: "payout", label: "Minimum payout (cents)", type: "number" },
  { key: "maintenance_mode", value: "false", group: "general", label: "Maintenance mode", type: "boolean" },
];
