import { handle, jsonOk } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export async function POST(req: Request) {
  return handle(req, async () => {
    await destroySession();
    return jsonOk({ ok: true });
  });
}
