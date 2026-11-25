"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type Feedback = { tone: "success" | "error" | "info"; text: string } | null;

/** Sends a JSON request; never throws, always resolves to { ok, data, error }. */
export async function apiRequest<T = Record<string, unknown>>(url: string, method: string, body?: unknown) {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    return { ok: response.ok, status: response.status, data, error: response.ok ? null : data.error || `Request failed (${response.status}).` };
  } catch {
    return { ok: false, status: 0, data: {} as T & { error?: string }, error: "Network error — check your connection and try again." };
  }
}

/**
 * Wraps a mutation with busy state, feedback and a router refresh on success,
 * so server-rendered lists update without a manual reload.
 */
export function useApi() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [refreshing, startTransition] = useTransition();

  const run = useCallback(async <T = Record<string, unknown>>(url: string, method: string, body?: unknown, success?: string | ((data: T) => string)) => {
    setBusy(true);
    setFeedback(null);
    const result = await apiRequest<T>(url, method, body);
    setBusy(false);
    if (result.ok) {
      if (success) setFeedback({ tone: "success", text: typeof success === "function" ? success(result.data) : success });
      startTransition(() => router.refresh());
    } else {
      setFeedback({ tone: "error", text: result.error ?? "Something went wrong." });
    }
    return result;
  }, [router]);

  return { run, busy: busy || refreshing, feedback, setFeedback };
}
