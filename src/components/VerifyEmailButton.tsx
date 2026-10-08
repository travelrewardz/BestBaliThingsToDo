"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Alert } from "@/components/ui";

export function VerifyEmailButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function verify() {
    setState("loading");
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok) setState("done");
      else {
        setState("error");
        setMessage(data?.error?.message || "Verification failed");
      }
    } catch {
      setState("error");
      setMessage("Network error");
    }
  }

  if (state === "done") {
    return (
      <div className="space-y-3">
        <Alert tone="success">Your email is verified — welcome aboard! 🎉</Alert>
        <Link href="/account" className="inline-flex w-full items-center justify-center rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
          Go to my account
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {state === "error" && <Alert tone="error">{message}</Alert>}
      <Button onClick={verify} disabled={state === "loading" || !token} className="w-full">
        {state === "loading" ? "Verifying…" : "Verify my email"}
      </Button>
      {!token && <p className="text-xs text-slate-500">Missing token — open the link from your email.</p>}
    </div>
  );
}
