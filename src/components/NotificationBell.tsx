"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Noti = {
  id: string;
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Noti[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let source: EventSource | null = null;
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        setItems(data.items || []);
        setUnread((data.items || []).filter((n: Noti) => !n.readAt).length);
      })
      .catch(() => undefined);

    try {
      source = new EventSource("/api/notifications/stream");
      source.addEventListener("notification", (e) => {
        try {
          const payload = JSON.parse((e as MessageEvent).data);
          setItems((prev) => [payload, ...prev].slice(0, 20));
          setUnread((n) => n + 1);
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* SSE unsupported — polling via fetch above is enough */
    }
    return () => source?.close();
  }, []);

  async function markRead() {
    setUnread(0);
    try {
      await fetch("/api/notifications", { method: "PATCH" });
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications (${unread} unread)`}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void markRead();
        }}
        className="relative rounded-xl border border-slate-200 p-2 text-slate-700 hover:border-brand-300"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sunset-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-800">
            Notifications
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-500">You&apos;re all caught up 🎉</p>
            )}
            {items.map((n) => (
              <Link
                key={n.id}
                href={n.link || "#"}
                onClick={() => setOpen(false)}
                className={`block border-b border-slate-50 px-4 py-3 hover:bg-brand-50 ${
                  n.readAt ? "opacity-70" : ""
                }`}
              >
                <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
