
CREATE TABLE public.leaderboard_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 1000000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leaderboard_scores_score ON public.leaderboard_scores (score DESC, created_at ASC);

GRANT SELECT ON public.leaderboard_scores TO anon, authenticated;
GRANT ALL ON public.leaderboard_scores TO service_role;

ALTER TABLE public.leaderboard_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view leaderboard scores"
  ON public.leaderboard_scores FOR SELECT
  TO anon, authenticated
  USING (true);
