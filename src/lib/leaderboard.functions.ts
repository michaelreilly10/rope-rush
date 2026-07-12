import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  startSession,
  getTopScores as serverGetTopScores,
  submitScore as serverSubmitScore,
  deleteScoreForContinue as serverDeleteScoreForContinue,
  type LeaderboardEntry,
} from "./leaderboard.server";

export type { LeaderboardEntry };

const submitSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name required")
    .max(16, "Max 16 characters")
    .regex(/^[\p{L}\p{N} _.\-!?]+$/u, "Invalid characters"),
  score: z.number().int().min(1).max(100000),
  token: z.string().min(10).max(256),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
  token: z.string().min(10).max(256),
});

export const startGameSession = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ token: string }> => startSession(),
);

export const getTopScores = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ entries: LeaderboardEntry[] }> => serverGetTopScores(),
);

export const submitScore = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(
    async ({ data }): Promise<{ ok: true; id: string } | { ok: false; error: string }> =>
      serverSubmitScore(data),
  );

export const deleteScoreForContinue = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean }> => serverDeleteScoreForContinue(data));
