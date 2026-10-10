import { handle, requireApiUser } from "@/lib/api";
import { subscribe, userChannel } from "@/lib/sse";

/**
 * GET /api/notifications/stream — SSE channel for the signed-in user.
 * The bell subscribes here; notify() broadcasts to user:<id> on create.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req);
    const stream = subscribe(userChannel(user.id));
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  });
}
