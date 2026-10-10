import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { logger, logError } from "@/lib/logger";
import { renderTemplate, type TemplateName } from "@/lib/email/templates";

export type SendVars = Record<string, string | number | null | undefined | false>;

/**
 * Sends a branded transactional email.
 * - With SMTP configured: sends via nodemailer.
 * - Without SMTP (development default): queues into EmailOutbox as QUEUED so
 *   every email is still inspectable in Admin → Settings → Email outbox.
 * Every send is recorded in EmailOutbox for auditability.
 */
export async function sendEmail(opts: {
  to: string;
  template: TemplateName;
  vars: SendVars;
  toUserId?: string | null;
}): Promise<{ id: string; status: string }> {
  const appUrl = env.appUrl;
  const { subject, html } = renderTemplate(opts.template, opts.vars, appUrl);

  const record = await prisma.emailOutbox.create({
    data: {
      toEmail: opts.to,
      toUserId: opts.toUserId ?? null,
      template: opts.template,
      subject,
      html,
      status: "QUEUED",
    },
  });

  if (!env.smtpHost) {
    logger.info("email queued (no SMTP configured)", {
      to: opts.to,
      template: opts.template,
      subject,
    });
    return { id: record.id, status: "QUEUED" };
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "Bali Things To Do <no-reply@balithingstodo.net>",
      to: opts.to,
      subject,
      html,
    });
    await prisma.emailOutbox.update({
      where: { id: record.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return { id: record.id, status: "SENT" };
  } catch (err) {
    logError(err, { template: opts.template, to: opts.to });
    await prisma.emailOutbox
      .update({
        where: { id: record.id },
        data: { status: "FAILED", error: String(err).slice(0, 500) },
      })
      .catch(() => undefined);
    return { id: record.id, status: "FAILED" };
  }
}

/** Convenience: email + in-app notification in one call. */
export async function notifyByEmail(opts: {
  userId: string;
  email: string;
  template: TemplateName;
  vars: SendVars;
}): Promise<void> {
  await sendEmail({
    to: opts.email,
    toUserId: opts.userId,
    template: opts.template,
    vars: opts.vars,
  });
}
