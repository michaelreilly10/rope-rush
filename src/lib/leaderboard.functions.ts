import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  startSession,
  getTopScores,
  submitScore,
  submitSchema,
  deleteScoreForContinue,
  deleteSchema,
  type LeaderboardEntry,
} from "./leaderboard.server";

export type { LeaderboardEntry };

export const startGameSession = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ token: string }> => startSession(),
);

export const getTopScores = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ entries: LeaderboardEntry[] }> => getTopScores(),
);

export const submitScore = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(
    async ({ data }): Promise<{ ok: true; id: string } | { ok: false; error: string }> =>
      submitScore(data),
  );

export const deleteScoreForContinue = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean }> => deleteScoreForContinue(data));
