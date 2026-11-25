import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { ZodType } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

type Context = { supabase: SupabaseClient; user: User };

async function baseContext(): Promise<Context> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new HttpError(503, "Supabase is not configured.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new HttpError(401, "Sign in required.");
  return { supabase, user };
}

export const requireUser = baseContext;

export async function requireAdmin(): Promise<Context> {
  const context = await baseContext();
  const { data, error } = await context.supabase.rpc("is_administrator");
  if (error || data !== true) throw new HttpError(403, "Administrator access required.");
  return context;
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path.join(".");
    throw new HttpError(400, first ? `${field ? `${field}: ` : ""}${first.message}` : "Invalid request.", parsed.error.flatten());
  }
  return parsed.data;
}

const STATUS_RULES: [RegExp, number][] = [
  [/sign in required/i, 401],
  [/not authorized|only the|administrator/i, 403],
  [/not found|not available/i, 404],
  [/must|invalid|does not|exceeds|only http|may only|characters/i, 422],
];

/** Converts a Postgres/RPC error into an HTTP error with a safe, user-facing message. */
export function dbError(error: { message: string; code?: string }, fallback = "Request could not be completed."): HttpError {
  if (error.code === "23505") return new HttpError(409, "That value is already taken.");
  if (error.code === "23514") return new HttpError(422, "One of the values is not allowed.");
  if (error.code === "42501") return new HttpError(403, "You do not have permission to do that.");
  // P0001 = RAISE EXCEPTION in our SQL functions; those messages are written for players.
  if (error.code === "P0001") {
    const status = STATUS_RULES.find(([pattern]) => pattern.test(error.message))?.[1] ?? 409;
    return new HttpError(status, error.message);
  }
  console.error("[db]", error.code, error.message);
  return new HttpError(500, fallback);
}

export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message, details: error.details }, error.status);
      console.error("[api]", error);
      return json({ error: "Unexpected server error." }, 500);
    }
  };
}

export type RouteParams = { params: Promise<{ id: string }> };
