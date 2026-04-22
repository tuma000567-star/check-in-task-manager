-- 2026-04-16: 端末残高カラム追加
ALTER TABLE devices ADD COLUMN IF NOT EXISTS balance integer not null default 0;
