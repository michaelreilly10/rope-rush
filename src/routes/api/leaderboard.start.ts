import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, withCors } from "@/lib/cors";
import { startSession } from "@/lib/leaderboard.server";

export const Route = createFileRoute("/api/leaderboard/start")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      },
      POST: async () => {
        try {
          const { token } = await startSession();
          return withCors(Response.json({ token }));
        } catch (error) {
          console.error("leaderboard start error:", error);
          return withCors(Response.json({ error: "Failed to start session" }, { status: 500 }));
        }
      },
    },
  },
});
