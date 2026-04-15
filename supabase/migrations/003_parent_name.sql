-- 2026-04-15: 親端末を手入力可能にするための列追加
-- parent_id (UUID FK) はそのまま残し、既存端末から選んだ場合に利用。
-- parent_name はプルダウンに無い親を手入力した場合に格納する。

ALTER TABLE devices ADD COLUMN IF NOT EXISTS parent_name text;
