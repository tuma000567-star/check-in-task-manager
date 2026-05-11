# Supabase バックアップ 2026-04-29

旧プロジェクト: `etlcdeshhpbdggugqznt` (check-in-task-manager)

## 含まれる内容

| ファイル | 件数 | 備考 |
|---|---|---|
| `devices.json` | 26 | 全端末（リブート済み含む） |
| `checkin_logs.json` | 240 | 全チェックインログ |
| `checkin_cycles.json` | 66 | 全サイクル履歴 |
| `daily_tasks.json` | 155 | 日次タスク |
| `invitations.json` | 0 | 招待履歴（なし） |
| `event_names.json` | 5 | イベント名プリセット |
| `auth_users.json` | 1 | 認証ユーザー（password除く） |
| `_summary.json` | - | エクスポート全体サマリ |
| `restore.mjs` | - | 新プロジェクトへの一括INSERTスクリプト |

## 復元手順

### 1. 新Supabaseプロジェクト作成
- https://supabase.com → New Project
- 名前: 任意 / リージョン: ap-northeast-1（東京）
- DBパスワード: 任意

### 2. スキーマ適用（順番厳守）
新プロジェクトの SQL Editor で順に貼り付けて Run:

1. `../../supabase/schema.sql` （初期4テーブル + RLS）
2. `../../supabase/migrations/001_event_names_and_video_minutes.sql`
3. `../../supabase/migrations/002_checkin_cycles.sql`
4. `../../supabase/migrations/003_parent_name.sql`
5. `../../supabase/migrations/004_reboot.sql`
6. `../../supabase/migrations/005_auth_rls.sql`
7. `../../supabase/migrations/006_balance.sql`
8. `../../supabase/migrations/007_groups.sql`

### 3. データ復元
- 新プロジェクトの URL と service_role key を取得
- `restore.mjs` の `NEW_URL` / `NEW_SRK` を書き換え
- 実行: `node restore.mjs`

### 4. 認証ユーザー再作成
パスワードはバックアップに含まれていません。新規設定が必要：
```bash
curl -X POST \
  -H "apikey: <NEW_SRK>" \
  -H "Authorization: Bearer <NEW_SRK>" \
  -H "Content-Type: application/json" \
  -d '{"email":"tuma000567@gmail.com","password":"adminadmin","email_confirm":true}' \
  https://YOUR-NEW.supabase.co/auth/v1/admin/users
```

### 5. Vercel環境変数を更新
```
VITE_SUPABASE_URL=新プロジェクトのURL
VITE_SUPABASE_ANON_KEY=新プロジェクトのanon key
```

更新後、Vercelで再デプロイすれば完全復元。

## Supabaseプロジェクト削除手順

1. https://supabase.com/dashboard/project/etlcdeshhpbdggugqznt/settings/general
2. 一番下「Danger Zone」→「Delete project」
3. プロジェクト名を入力して確定

**注意**: 削除後はデータの復元不可能。このバックアップが唯一の手段になります。
