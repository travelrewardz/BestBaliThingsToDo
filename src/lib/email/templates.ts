/**
 * HTML email templates — branded for Bali Things To Do.
 * All templates render to { subject, html } and are sent (or queued to the
 * EmailOutbox table when SMTP is not configured) by src/lib/email.ts.
 */

const BRAND = {
  name: "Bali Things To Do",
  tagline: "Discover the best tours, activities, adventures and experiences in Bali.",
  primary: "#0F766E", // deep teal
  accent: "#F97316", // sunset orange
  dark: "#134E4A",
  sand: "#FFF7ED",
  text: "#334155",
  muted: "#64748B",
};

export type TemplateName =
  | "welcome"
  | "verifyEmail"
  | "passwordReset"
  | "bookingConfirmation"
  | "paymentConfirmation"
  | "supplierBookingNotification"
  | "bookingCancelledCustomer"
  | "bookingCancelledSupplier"
  | "refundProcessed"
  | "tourReminder"
  | "reviewRequest"
  | "supplierApproved"
  | "supplierRejected"
  | "productApproved"
  | "productRejected"
  | "productChangesRequested"
  | "payoutProcessed"
  | "supportReply";

type Vars = Record<string, string | number | null | undefined | false>;

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="border-radius:8px;background:${BRAND.accent}">
    <a href="${esc(url)}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:700;font-family:Arial,sans-serif;border-radius:8px">${esc(label)}</a>
  </td></tr></table>`;
}

function row(label: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return `<tr><td style="padding:8px 0;color:${BRAND.muted};font-family:Arial,sans-serif;font-size:14px">${esc(
    label
  )}</td><td style="padding:8px 0;color:${BRAND.text};font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-align:right">${esc(
    value
  )}</td></tr>`;
}

function detailsTable(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:8px 20px;margin:16px 0">${rows}</table>`;
}

function section(title: string, inner: string): string {
  return `<h2 style="font-family:Arial,sans-serif;font-size:18px;color:${BRAND.dark};margin:28px 0 8px">${esc(
    title
  )}</h2>${inner}`;
}

function paragraph(text: string): string {
  return `<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:${BRAND.text};margin:8px 0">${text}</p>`;
}

function baseLayout(opts: {
  title: string;
  preheader: string;
  body: string;
  appUrl: string;
}): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.sand}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.sand};padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 16px 16px">
  <a href="${esc(opts.appUrl)}" style="text-decoration:none;font-family:Arial,sans-serif">
    <span style="font-size:22px;font-weight:800;color:${BRAND.primary}">🌴 ${esc(BRAND.name)}</span>
  </a>
</td></tr>
<tr><td style="background:#ffffff;border-radius:16px;border:1px solid #E2E8F0;padding:28px 28px 8px">
${opts.body}
</td></tr>
<tr><td style="padding:20px 16px;text-align:center;font-family:Arial,sans-serif;font-size:12px;color:${BRAND.muted}">
  ${esc(BRAND.name)} — ${esc(BRAND.tagline)}<br/>
  ${esc(opts.appUrl)} · This email was sent to you because you have an account or booking with us.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function renderTemplate(
  name: TemplateName,
  vars: Vars,
  appUrl: string
): { subject: string; html: string } {
  const v = (k: string) => String(vars[k] ?? "");
  let subject = "";
  let body = "";

  switch (name) {
    case "welcome":
      subject = `Welcome to ${BRAND.name} 🌴`;
      body =
        paragraph(`Hi <strong>${esc(v("name"))}</strong>,`) +
        paragraph(
          `Thanks for joining <strong>${BRAND.name}</strong>. Discover Bali's best tours, activities and adventures — book in minutes, pay securely, and get instant confirmation.`
        ) +
        button("Explore Bali experiences", `${appUrl}/search`) +
        section(
          "Your account",
          detailsTable(
            row("Email", vars.email) + row("Password", "•••••••• (you set this)")
          )
        ) +
        paragraph(
          `Need help? Just reply to this email or use the contact form on our website.`
        );
      break;

    case "verifyEmail":
      subject = `Confirm your email address`;
      body =
        paragraph(`Hi <strong>${esc(v("name"))}</strong>,`) +
        paragraph(`Please confirm your email address to activate your account.`) +
        button("Confirm email", `${appUrl}/verify-email?token=${esc(v("token"))}`) +
        paragraph(`This link expires in 24 hours.`);
      break;

    case "passwordReset":
      subject = `Reset your ${BRAND.name} password`;
      body =
        paragraph(`Hi <strong>${esc(v("name"))}</strong>,`) +
        paragraph(`We received a request to reset your password.`) +
        button("Reset password", `${appUrl}/reset-password?token=${esc(v("token"))}`) +
        paragraph(
          `If you didn't request this, you can safely ignore this email — your password will not change. The link expires in 60 minutes.`
        );
      break;

    case "bookingConfirmation":
      subject = `Booking confirmed — ${v("reference")} · ${v("productName")}`;
      body =
        paragraph(`Hi <strong>${esc(v("customerName"))}</strong>,`) +
        paragraph(
          `Your booking is confirmed. We've sent a copy to your supplier — please show your voucher on the day.`
        ) +
        detailsTable(
          row("Booking number", vars.reference) +
            row("Tour", vars.productName) +
            row("Date", vars.tourDate) +
            row("Time", vars.tourTime) +
            row("Travelers", vars.travelers) +
            row("Pickup location", vars.pickupLocation) +
            row("Supplier", vars.supplierName) +
            row("Amount paid", vars.total) +
            row("Status", vars.status) +
            row("Cancellation policy", vars.cancellationPolicy)
        ) +
        button("View booking", `${appUrl}/account/bookings`) +
        button("Download voucher", `${appUrl}/voucher/${esc(v("reference"))}`) +
        paragraph(
          `Questions? <a href="${appUrl}/support" style="color:${BRAND.primary}">Contact support</a> or message the supplier on WhatsApp.`
        );
      break;

    case "paymentConfirmation":
      subject = `Payment received — ${v("reference")}`;
      body =
        paragraph(`Hi <strong>${esc(v("customerName"))}</strong>,`) +
        paragraph(`We've received your payment. Nothing else to do — you're all set.`) +
        detailsTable(
          row("Booking number", vars.reference) +
            row("Tour", vars.productName) +
            row("Date", vars.tourDate) +
            row("Amount paid", vars.total) +
            row("Payment method", vars.provider) +
            row("Status", "Paid")
        ) +
        button("View booking", `${appUrl}/account/bookings`);
      break;

    case "supplierBookingNotification":
      subject = `New booking ${v("reference")} — ${v("productName")}`;
      body =
        paragraph(`You have a new booking!`) +
        detailsTable(
          row("Booking number", vars.reference) +
            row("Tour", vars.productName) +
            row("Date", vars.tourDate) +
            row("Time", vars.tourTime) +
            row("Travelers", vars.travelers) +
            row("Pickup location", vars.pickupLocation) +
            row("Customer", vars.customerName) +
            row("Special requests", vars.specialRequests) +
            row("Your earnings", vars.supplierEarnings) +
            row("Status", vars.status)
        ) +
        button("Open supplier dashboard", `${appUrl}/supplier/bookings`) +
        paragraph(
          `Please confirm availability and reply to any special requests as soon as possible.`
        );
      break;

    case "bookingCancelledCustomer":
      subject = `Booking cancelled — ${v("reference")}`;
      body =
        paragraph(`Hi <strong>${esc(v("customerName"))}</strong>,`) +
        paragraph(
          `Your booking <strong>${esc(v("reference"))}</strong> for <strong>${esc(
            v("productName")
          )}</strong> on ${esc(v("tourDate"))} has been cancelled.${
            vars.refundNote ? " " + esc(String(vars.refundNote)) : ""
          }`
        ) +
        button("View booking", `${appUrl}/account/bookings`);
      break;

    case "bookingCancelledSupplier":
      subject = `Booking cancelled — ${v("reference")}`;
      body =
        paragraph(
          `Booking <strong>${esc(v("reference"))}</strong> (${esc(
            v("productName")
          )}, ${esc(v("tourDate"))}) has been cancelled by the customer or platform. Capacity has been released.`
        ) +
        button("Open dashboard", `${appUrl}/supplier/bookings`);
      break;

    case "refundProcessed":
      subject = `Refund processed — ${v("reference")}`;
      body =
        paragraph(`Hi <strong>${esc(v("customerName"))}</strong>,`) +
        paragraph(
          `Your refund of <strong>${esc(v("amount"))}</strong> for booking <strong>${esc(
            v("reference")
          )}</strong> has been processed. Depending on your bank it may take 5–10 business days to appear.`
        );
      break;

    case "tourReminder":
      subject = `Tomorrow: ${v("productName")} (${v("reference")})`;
      body =
        paragraph(`Hi <strong>${esc(v("customerName"))}</strong>,`) +
        paragraph(
          `A quick reminder — your tour is coming up. Please be ready 10 minutes before pickup time.`
        ) +
        detailsTable(
          row("Tour", vars.productName) +
            row("Date", vars.tourDate) +
            row("Time", vars.tourTime) +
            row("Pickup location", vars.pickupLocation) +
            row("Supplier", vars.supplierName) +
            row("WhatsApp", vars.supplierWhatsapp)
        ) +
        button("View voucher", `${appUrl}/voucher/${esc(v("reference"))}`);
      break;

    case "reviewRequest":
      subject = `How was ${v("productName")}?`;
      body =
        paragraph(`Hi <strong>${esc(v("customerName"))}</strong>,`) +
        paragraph(
          `Thanks for booking with ${BRAND.name}! If you enjoyed your experience, a short review helps other travelers (and our local suppliers) a lot.`
        ) +
        button("Leave a review", `${appUrl}/account/reviews?booking=${esc(v("reference"))}`);
      break;

    case "supplierApproved":
      subject = `Your supplier account is approved ✅`;
      body =
        paragraph(`Hi <strong>${esc(v("name"))}</strong>,`) +
        paragraph(
          `Great news — your supplier account has been approved. You can now create tours, set availability and receive bookings.`
        ) +
        button("Open supplier dashboard", `${appUrl}/supplier/dashboard`);
      break;

    case "supplierRejected":
      subject = `Supplier application update`;
      body =
        paragraph(`Hi <strong>${esc(v("name"))}</strong>,`) +
        paragraph(
          `Unfortunately we couldn't approve your supplier application at this time.${
            vars.reason ? "<br/>Reason: " + esc(String(vars.reason)) : ""
          } You can update your documents and re-apply from your dashboard.`
        );
      break;

    case "productApproved":
      subject = `Your tour "${v("name")}" is approved 🎉`;
      body =
        paragraph(`Hi <strong>${esc(v("name"))}</strong>,`) +
        paragraph(
          `Your tour <strong>${esc(v("name"))}</strong> has been reviewed and approved. It is now published and bookable on ${BRAND.name}.`
        ) +
        button("View tour", `${appUrl}/trip/${esc(v("slug"))}`);
      break;

    case "productRejected":
      subject = `Tour submission update — ${v("name")}`;
      body =
        paragraph(`Hi <strong>${esc(v("name"))}</strong>,`) +
        paragraph(
          `Your tour <strong>${esc(v("name"))}</strong> was not approved.${
            vars.note ? "<br/>Reviewer note: " + esc(String(vars.note)) : ""
          }`
        ) +
        button("Open dashboard", `${appUrl}/supplier/products`);
      break;

    case "productChangesRequested":
      subject = `Changes requested — ${v("name")}`;
      body =
        paragraph(`Hi <strong>${esc(v("name"))}</strong>,`) +
        paragraph(
          `Our team reviewed <strong>${esc(v("name"))}</strong> and requested a few changes before approval.${
            vars.note ? "<br/>Note: " + esc(String(vars.note)) : ""
          }`
        ) +
        button("Review changes", `${appUrl}/supplier/products`);
      break;

    case "payoutProcessed":
      subject = `Payout processed — ${v("amount")}`;
      body =
        paragraph(`Hi <strong>${esc(v("name"))}</strong>,`) +
        paragraph(
          `Your payout of <strong>${esc(v("amount"))}</strong> has been processed.${
            vars.reference ? " Reference: " + esc(String(vars.reference)) : ""
          }`
        ) +
        button("View payouts", `${appUrl}/supplier/payouts`);
      break;

    case "supportReply":
      subject = `Re: ${v("subject")} [${v("reference")}]`;
      body =
        paragraph(`Hi <strong>${esc(v("name"))}</strong>,`) +
        paragraph(String(vars.body || "")) +
        button("View ticket", `${appUrl}/support/${esc(v("reference"))}`);
      break;
  }

  const html = baseLayout({
    title: subject,
    preheader: subject,
    body,
    appUrl,
  });
  return { subject, html };
}
