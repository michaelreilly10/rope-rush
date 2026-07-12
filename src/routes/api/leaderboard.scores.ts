import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CORS_HEADERS, withCors } from "@/lib/cors";
import { getTopScores, submitScore, submitSchema } from "@/lib/leaderboard.server";

export const Route = createFileRoute("/api/leaderboard/scores")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      },
      GET: async () => {
        try {
          const { entries } = await getTopScores();
          return withCors(Response.json({ entries }));
        } catch (error) {
          console.error("leaderboard scores GET error:", error);
          return withCors(Response.json({ entries: [] }, { status: 500 }));
        }
      },
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const parsed = submitSchema.safeParse(body);
          if (!parsed.success) {
            return withCors(
              Response.json({ ok: false, error: parsed.error.message }, { status: 400 }),
            );
          }
          const result = await submitScore(parsed.data);
          return withCors(Response.json(result));
        } catch (error) {
          console.error("leaderboard scores POST error:", error);
          return withCors(
            Response.json({ ok: false, error: "Failed to submit score" }, { status: 500 }),
          );
        }
      },
    },
  },
});
