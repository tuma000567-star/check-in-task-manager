# チェックイン管理 (check-in-task-manager)

TikTok チェックイン＆日次タスク管理アプリ。React + Vite + Supabase で構築、Vercel にデプロイ。

## セットアップ

### 1. 依存インストール

```bash
npm install
```

### 2. Supabase プロジェクト作成

1. https://supabase.com でプロジェクトを新規作成
2. `supabase/schema.sql` の内容を SQL Editor に貼り付けて実行
3. Project Settings → API から URL と anon key を取得

### 3. 環境変数設定

`.env` をリポジトリ直下に作成:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 4. 開発起動

```bash
npm run dev
```

http://localhost:5173 を開く。

## デプロイ（Vercel）

```bash
vercel deploy --prod
```

またはダッシュボードから GitHub リポジトリをインポート。環境変数 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を必ず設定すること。

## 画面

- `/` ホーム（端末一覧、日次タスク、チェックイン記録）
- `/device/:id` 端末詳細（経過日数、カレンダー、ログ、招待履歴）
- `/stats` 統計・分析（達成率、招待タイミング分析）

## チェックイン日数ロジック

- `current_checkin_day` は DB に保存せず、`checkin_logs` から動的計算。
- 最後の `error` ログの翌日を起点に、今日との差分で現在日数を求める（最大 14）。
