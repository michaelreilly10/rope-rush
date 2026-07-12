import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CORS_HEADERS, withCors } from "@/lib/cors";
import { deleteScoreForContinue, deleteSchema } from "@/lib/leaderboard.server";

export const Route = createFileRoute("/api/leaderboard/continue")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      },
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const parsed = deleteSchema.safeParse(body);
          if (!parsed.success) {
            return withCors(
              Response.json({ ok: false, error: parsed.error.message }, { status: 400 }),
            );
          }
          const result = await deleteScoreForContinue(parsed.data);
          return withCors(Response.json(result));
        } catch (error) {
          console.error("leaderboard continue error:", error);
          return withCors(
            Response.json({ ok: false, error: "Failed to delete score" }, { status: 500 }),
          );
        }
      },
    },
  },
});
