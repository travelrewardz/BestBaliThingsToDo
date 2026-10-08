/**
 * Vitest setup — runs before each test file.
 * Loads .env so Prisma and the env helpers resolve (DATABASE_URL, AUTH_SECRET…).
 */
import { loadEnv } from "@/lib/env-loader";

loadEnv();
