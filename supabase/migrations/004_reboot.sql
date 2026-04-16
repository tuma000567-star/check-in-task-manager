-- 2026-04-15: リブート機能用のカラム追加
-- is_active は既存カラムを流用（false = リブート済み）

ALTER TABLE devices ADD COLUMN IF NOT EXISTS rebooted_at timestamptz;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS reboot_count integer not null default 0;
