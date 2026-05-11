// 新Supabaseプロジェクトへの復元スクリプト
// 使い方:
//   1. 新プロジェクト作成 → Settings → API で URL と service_role key を取得
//   2. 下の NEW_URL / NEW_SRK を書き換え
//   3. 新プロジェクトの SQL Editor で schema.sql + migrations/001..007 を順に実行
//   4. node restore.mjs を実行

import { readFileSync } from 'fs';

const NEW_URL = 'https://YOUR-NEW-PROJECT.supabase.co';
const NEW_SRK = 'YOUR-NEW-SERVICE-ROLE-KEY';

const TABLES = ['event_names', 'devices', 'checkin_cycles', 'checkin_logs', 'daily_tasks', 'invitations'];

async function insertRows(table, rows) {
  if (rows.length === 0) return { count: 0 };
  // バルクインサート（最大1000件ずつ）
  const chunks = [];
  for (let i = 0; i < rows.length; i += 500) chunks.push(rows.slice(i, i + 500));
  let total = 0;
  for (const chunk of chunks) {
    const r = await fetch(`${NEW_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: NEW_SRK,
        Authorization: `Bearer ${NEW_SRK}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(chunk),
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
    total += chunk.length;
  }
  return { count: total };
}

for (const t of TABLES) {
  try {
    const rows = JSON.parse(readFileSync(`./${t}.json`, 'utf8'));
    const res = await insertRows(t, rows);
    console.log(`✓ ${t}: ${res.count} rows restored`);
  } catch (e) {
    console.log(`✗ ${t}: ${e.message}`);
  }
}

console.log('\n認証ユーザーは以下のコマンドで個別に作成:');
console.log('curl -X POST -H "apikey: <SRK>" -H "Authorization: Bearer <SRK>" -H "Content-Type: application/json" \\');
console.log('  -d \'{"email":"...","password":"...","email_confirm":true}\' \\');
console.log(`  ${NEW_URL}/auth/v1/admin/users`);
