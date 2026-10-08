import { handle, jsonOk } from "@/lib/api";
import { resolveUserFromToken, tokenFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  return handle(req, async (req) => {
    const user = await resolveUserFromToken(tokenFromRequest(req));
    return jsonOk({ user });
  });
}
