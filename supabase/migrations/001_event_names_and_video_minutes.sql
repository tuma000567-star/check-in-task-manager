-- 2026-04-15: 招待イベント名プリセット管理 + 動画視聴分数
-- 注記: 初期スキーマ (schema.sql) 適用後に追加で実行すること。

CREATE TABLE IF NOT EXISTS event_names (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

INSERT INTO event_names (name) VALUES
  ('通常'),('QR'),('ホームラン'),('猫二人招待'),('即時3000　3000')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE event_names ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all" ON event_names;
CREATE POLICY "allow all" ON event_names
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS video_minutes integer;
