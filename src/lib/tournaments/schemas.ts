import { z } from "zod";

export const tournamentInputSchema = z.object({
  gameId: z.string().uuid(),
  slug: z.string().min(3).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(3).max(100),
  description: z.string().max(5000).default(""),
  format: z.enum(["single_elimination", "double_elimination", "round_robin", "points"]),
  registrationOpensAt: z.string().datetime(),
  registrationClosesAt: z.string().datetime(),
  startsAt: z.string().datetime(),
  capacity: z.number().int().min(2).max(4096),
  teamSize: z.number().int().min(1).max(100).default(1),
  prizeLabel: z.string().trim().min(1).max(100).default("Community points"),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#c7ff4a"),
}).refine((value) => value.registrationOpensAt < value.registrationClosesAt && value.registrationClosesAt <= value.startsAt, {
  message: "Registration dates must be ordered before the tournament starts.",
});

export const matchResultInputSchema = z.object({
  winnerRegistrationId: z.string().uuid(),
  result: z.record(z.string(), z.unknown()),
  evidenceUrl: z.string().url().max(2048).optional(),
});