import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      status: "ok",
      service: "balithingstodo",
      time: new Date().toISOString(),
      db: "up",
    });
  } catch (err) {
    return Response.json(
      { status: "degraded", db: "down", error: String(err).slice(0, 200) },
      { status: 503 }
    );
  }
}
