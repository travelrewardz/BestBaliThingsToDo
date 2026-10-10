/**
 * Minimal in-process SSE hub.
 *
 * Channels:
 *   admin                 — all admin dashboards
 *   supplier:<supplierId> — one supplier's dashboards
 *   user:<userId>         — one user's notifications
 *
 * Single-instance by design; for multi-instance deployments replace
 * broadcast() with a Redis pub/sub fan-out (see docs/ARCHITECTURE.md).
 */

type Listener = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
};

const channels = new Map<string, Set<Listener>>();
let heartbeat: ReturnType<typeof setInterval> | null = null;

function ensureHeartbeat() {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    for (const set of channels.values()) {
      for (const l of set) {
        try {
          l.controller.enqueue(l.encoder.encode(": ping\n\n"));
        } catch {
          set.delete(l);
        }
      }
    }
  }, 25_000);
  // Do not keep the process alive just for heartbeats.
  (heartbeat as unknown as { unref?: () => void }).unref?.();
}

export function subscribe(channel: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let listener: Listener;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      listener = { controller, encoder };
      let set = channels.get(channel);
      if (!set) {
        set = new Set();
        channels.set(channel, set);
      }
      set.add(listener);
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ channel })}\n\n`)
      );
      ensureHeartbeat();
    },
    cancel() {
      const set = channels.get(channel);
      if (set && listener) {
        set.delete(listener);
        if (set.size === 0) channels.delete(channel);
      }
    },
  });

  return stream;
}

export function broadcast(channel: string, event: string, data: unknown): void {
  const set = channels.get(channel);
  if (!set || set.size === 0) return;
  const encoder = new TextEncoder();
  const payload = encoder.encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  );
  for (const l of set) {
    try {
      l.controller.enqueue(payload);
    } catch {
      set.delete(l);
    }
  }
}

export const adminChannel = "admin";
export const supplierChannel = (supplierId: string) => `supplier:${supplierId}`;
export const userChannel = (userId: string) => `user:${userId}`;

export function listenerCount(channel: string): number {
  return channels.get(channel)?.size ?? 0;
}
