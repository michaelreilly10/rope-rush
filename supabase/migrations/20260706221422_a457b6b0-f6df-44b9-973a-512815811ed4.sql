CREATE POLICY "Block anonymous score inserts" ON public.leaderboard_scores FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Block score updates" ON public.leaderboard_scores FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Block score deletes" ON public.leaderboard_scores FOR DELETE TO anon, authenticated USING (false);