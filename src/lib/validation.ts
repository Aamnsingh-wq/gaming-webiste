import { z } from "zod";
import { GAME_SLUGS } from "@/lib/games";

/** Accepts only http(s) URLs so stored links can never become `javascript:` hrefs. */
export const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "Only http(s) links are allowed.");

/** Same as httpUrl but returns null for null/undefined/blank — for "clear this field" inputs. */
export const optionalHttpUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  httpUrl.nullable().optional(),
).transform((value) => value ?? null);

export function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

export const usernameSchema = z.string().trim().regex(/^[A-Za-z0-9_]{3,24}$/, "3-24 letters, numbers, or underscores.");
export const slugSchema = z.string().trim().min(3).max(48).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and dashes only.");
export const gameSlugSchema = z.enum(GAME_SLUGS);
export const uuidSchema = z.string().uuid();

/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
