-- 2026-04-15: サイクル機能追加
-- 注記: 001 マイグレーション適用後に実行すること。

CREATE TABLE IF NOT EXISTS checkin_cycles (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  cycle_number integer not null default 1,
  start_date date not null default current_date,
  end_date date,
  completed boolean default false,
  notes text,
  created_at timestamptz default now()
);

ALTER TABLE checkin_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all" ON checkin_cycles;
CREATE POLICY "allow all" ON checkin_cycles
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE checkin_logs
  ADD COLUMN IF NOT EXISTS cycle_id uuid references checkin_cycles(id) on delete set null;

-- 既存の端末に対してサイクル1を自動生成（未生成のものだけ）
INSERT INTO checkin_cycles (device_id, cycle_number, start_date)
SELECT d.id, 1, d.checkin_start_date
FROM devices d
WHERE NOT EXISTS (
  SELECT 1 FROM checkin_cycles c WHERE c.device_id = d.id
);
