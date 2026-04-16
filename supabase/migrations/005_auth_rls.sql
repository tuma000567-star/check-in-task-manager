-- 2026-04-16: RLS を authenticated ユーザー限定に変更
-- anon アクセスを遮断し、ログイン済みユーザーのみ読み書き可能にする

DROP POLICY IF EXISTS "allow all" ON devices;
DROP POLICY IF EXISTS "allow all" ON checkin_logs;
DROP POLICY IF EXISTS "allow all" ON daily_tasks;
DROP POLICY IF EXISTS "allow all" ON invitations;
DROP POLICY IF EXISTS "allow all" ON checkin_cycles;
DROP POLICY IF EXISTS "allow all" ON event_names;

CREATE POLICY "authenticated only" ON devices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated only" ON checkin_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated only" ON daily_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated only" ON invitations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated only" ON checkin_cycles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated only" ON event_names FOR ALL TO authenticated USING (true) WITH CHECK (true);
