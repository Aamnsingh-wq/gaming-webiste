import { z } from "zod";
import { gameSlugSchema, httpUrl, slugSchema, uuidSchema } from "@/lib/validation";

const isoDate = z.string().datetime({ offset: true });
const time = (value: string) => new Date(value).getTime();

const tournamentFields = z.object({
  gameSlug: gameSlugSchema,
  slug: slugSchema,
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().max(5000).default(""),
  format: z.enum(["single_elimination", "double_elimination", "round_robin", "points"]),
  registrationOpensAt: isoDate,
  registrationClosesAt: isoDate,
  startsAt: isoDate,
  capacity: z.number().int().min(2).max(4096),
  teamSize: z.number().int().min(1).max(100).default(1),
  prizeLabel: z.string().trim().min(1).max(100).default("Community points"),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#00e5ff"),
  bannerUrl: httpUrl.nullable().optional(),
});

// Compare as instants, not strings: "…00Z" vs "…00.000Z" sort incorrectly as text.
const datesOrdered = (value: { registrationOpensAt?: string; registrationClosesAt?: string; startsAt?: string }) =>
  !value.registrationOpensAt || !value.registrationClosesAt || !value.startsAt ||
  (time(value.registrationOpensAt) < time(value.registrationClosesAt) && time(value.registrationClosesAt) <= time(value.startsAt));

const dateMessage = { message: "Registration must open before it closes, and close no later than the start time.", path: ["registrationClosesAt"] };

export const tournamentInputSchema = tournamentFields.refine(datesOrdered, dateMessage);

export const tournamentUpdateSchema = tournamentFields
  .omit({ gameSlug: true, slug: true })
  .partial()
  .extend({ status: z.enum(["draft", "registration_open", "upcoming", "live", "completed", "cancelled"]).optional() })
  .refine(datesOrdered, dateMessage)
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update." });

export const matchResultInputSchema = z.object({
  winnerRegistrationId: uuidSchema,
  result: z.record(z.string(), z.unknown()).default({}),
  evidenceUrl: httpUrl.optional(),
});
