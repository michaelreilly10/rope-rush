ALTER TABLE public.leaderboard_scores ADD COLUMN IF NOT EXISTS session_id text;
CREATE INDEX IF NOT EXISTS idx_leaderboard_scores_session_id ON public.leaderboard_scores(session_id);