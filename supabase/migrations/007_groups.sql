-- 2026-04-16: 端末グループ分けカラム追加
-- group_name は任意のテキスト。同じ文字列の端末を同一グループとして扱う。
ALTER TABLE devices ADD COLUMN IF NOT EXISTS group_name text;
