import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  created_at: string;
};

export const getTopScores = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ entries: LeaderboardEntry[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("leaderboard_scores")
      .select("id, name, score, created_at")
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) {
      console.error("getTopScores error:", error);
      return { entries: [] };
    }
    return { entries: (data ?? []) as LeaderboardEntry[] };
  },
);

const submitSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name required")
    .max(16, "Max 16 characters")
    .regex(/^[\p{L}\p{N} _.\-!?]+$/u, "Invalid characters"),
  score: z.number().int().min(1).max(1000000),
});

export const submitScore = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(
    async ({ data }): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin
        .from("leaderboard_scores")
        .insert({ name: data.name, score: data.score })
        .select("id")
        .single();
      if (error || !row) {
        console.error("submitScore error:", error);
        return { ok: false, error: "Failed to submit score" };
      }
      return { ok: true, id: row.id };
    },
  );
