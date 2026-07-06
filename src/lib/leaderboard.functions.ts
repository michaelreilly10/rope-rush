import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";

export type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  created_at: string;
};

// Minimum milliseconds required per meter of score. The game advances at a
// bounded rate, so submissions faster than this are implausible and rejected.
const MIN_MS_PER_METER = 40;
// Maximum session lifetime (2 hours) to prevent replay of very old tokens.
const MAX_SESSION_AGE_MS = 2 * 60 * 60 * 1000;
// Minimum session age to prevent instantaneous score submissions.
const MIN_SESSION_AGE_MS = 500;

function getSigningSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Signing secret not configured");
  return secret;
}

function signToken(payload: { sid: string; iat: number }): string {
  const body = `${payload.sid}.${payload.iat}`;
  const sig = createHmac("sha256", getSigningSecret()).update(body).digest("hex");
  return `${body}.${sig}`;
}

function verifyToken(token: string): { sid: string; iat: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [sid, iatStr, sig] = parts;
  if (!sid || !iatStr || !sig) return null;
  const iat = Number(iatStr);
  if (!Number.isFinite(iat)) return null;
  const expected = createHmac("sha256", getSigningSecret())
    .update(`${sid}.${iat}`)
    .digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return { sid, iat };
}

export const startGameSession = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ token: string }> => {
    const sid = randomBytes(12).toString("hex");
    const iat = Date.now();
    return { token: signToken({ sid, iat }) };
  },
);

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
  score: z.number().int().min(1).max(100000),
  token: z.string().min(10).max(256),
});

export const submitScore = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(
    async ({ data }): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
      const parsed = verifyToken(data.token);
      if (!parsed) {
        return { ok: false, error: "Invalid session" };
      }
      const age = Date.now() - parsed.iat;
      if (age < MIN_SESSION_AGE_MS || age > MAX_SESSION_AGE_MS) {
        return { ok: false, error: "Session expired" };
      }
      // Reject implausibly fast scores: the run must have lasted long enough
      // for the reported distance at the game's maximum plausible pace.
      if (age < data.score * MIN_MS_PER_METER) {
        return { ok: false, error: "Score rejected" };
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin
        .from("leaderboard_scores")
        .insert({ name: data.name, score: data.score, session_id: parsed.sid })
        .select("id")
        .single();
      if (error || !row) {
        console.error("submitScore error:", error);
        return { ok: false, error: "Failed to submit score" };
      }
      return { ok: true, id: row.id };
    },
  );

const deleteSchema = z.object({
  id: z.string().uuid(),
  token: z.string().min(10).max(256),
});

export const deleteScoreForContinue = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(
    async ({ data }): Promise<{ ok: boolean }> => {
      const parsed = verifyToken(data.token);
      if (!parsed) return { ok: false };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("leaderboard_scores")
        .delete()
        .eq("id", data.id)
        .eq("session_id", parsed.sid);
      if (error) {
        console.error("deleteScoreForContinue error:", error);
        return { ok: false };
      }
      return { ok: true };
    },
  );

