export const env = {
  get databaseUrl(): string {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    return process.env.DATABASE_URL;
  },
  get appUrl(): string {
    return process.env.APP_URL || "http://localhost:3000";
  },
  get authSecret(): string {
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("AUTH_SECRET must be set in production");
      }
      return "dev-only-insecure-secret-change-me";
    }
    return secret;
  },
  get smtpHost(): string {
    return process.env.SMTP_HOST || "";
  },
  get stripeSecretKey(): string {
    return process.env.STRIPE_SECRET_KEY || "";
  },
};
