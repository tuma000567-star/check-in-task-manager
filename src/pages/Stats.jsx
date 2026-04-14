import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const DAY_BUCKETS = [
  { label: 'Day 1-3', min: 1, max: 3 },
  { label: 'Day 4-6', min: 4, max: 6 },
  { label: 'Day 7-9', min: 7, max: 9 },
  { label: 'Day 10-12', min: 10, max: 12 },
  { label: 'Day 13-14', min: 13, max: 14 },
];

export default function Stats() {
  const [devices, setDevices] = useState([]);
  const [logs, setLogs] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      try {
        const [dev, log, inv] = await Promise.all([
          supabase.from('devices').select('*'),
          supabase.from('checkin_logs').select('*'),
          supabase.from('invitations').select('*'),
        ]);
        if (dev.error) throw dev.error;
        if (log.error) throw log.error;
        if (inv.error) throw inv.error;
        setDevices(dev.data || []);
        setLogs(log.data || []);
        setInvitations(inv.data || []);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const checkinRate = useMemo(() => {
    const success = logs.filter((l) => l.status === 'success').length;
    const total = logs.length;
    return {
      total,
      success,
      rate: total ? Math.round((success / total) * 100) : 0,
    };
  }, [logs]);

  const inviteStats = useMemo(() => {
    const total = invitations.length;
    const success = invitations.filter((i) => i.result === 'success').length;
    const failure = invitations.filter((i) => i.result === 'failure').length;
    const pending = invitations.filter((i) => i.result === 'pending').length;
    const resolved = success + failure;
    return {
      total,
      success,
      failure,
      pending,
      rate: resolved ? Math.round((success / resolved) * 100) : 0,
    };
  }, [invitations]);

  const bucketAnalysis = useMemo(() => {
    const rows = DAY_BUCKETS.map((b) => {
      const inBucket = invitations.filter(
        (i) =>
          i.child_checkin_day_at_invitation != null &&
          i.child_checkin_day_at_invitation >= b.min &&
          i.child_checkin_day_at_invitation <= b.max &&
          (i.result === 'success' || i.result === 'failure')
      );
      const success = inBucket.filter((i) => i.result === 'success').length;
      const total = inBucket.length;
      return {
        label: b.label,
        total,
        success,
        rate: total ? Math.round((success / total) * 100) : null,
      };
    });
    let best = null;
    for (const r of rows) {
      if (r.rate == null) continue;
      if (!best || r.rate > best.rate) best = r;
    }
    return { rows, best };
  }, [invitations]);

  return (
    <div className="page stats">
      <h1 className="page-title">統計・分析</h1>
      {error && <div className="error-box">エラー: {error}</div>}
      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-box">
              <div className="stat-label">端末数</div>
              <div className="stat-num">{devices.length}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">チェックイン達成率</div>
              <div className="stat-num">{checkinRate.rate}<span className="pct">%</span></div>
              <div className="stat-sub">{checkinRate.success} / {checkinRate.total}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">招待成功率</div>
              <div className="stat-num">{inviteStats.rate}<span className="pct">%</span></div>
              <div className="stat-sub">成功 {inviteStats.success} / 失敗 {inviteStats.failure} / 保留 {inviteStats.pending}</div>
            </div>
          </div>

          <h2 className="section-title">招待タイミング分析</h2>
          <p className="hint">子端末のチェックイン日数帯ごとの招待成功率</p>
          <table className="bucket-table">
            <thead>
              <tr>
                <th>日数帯</th>
                <th>件数</th>
                <th>成功</th>
                <th>成功率</th>
              </tr>
            </thead>
            <tbody>
              {bucketAnalysis.rows.map((r) => (
                <tr
                  key={r.label}
                  className={bucketAnalysis.best && bucketAnalysis.best.label === r.label ? 'highlight' : ''}
                >
                  <td>{r.label}</td>
                  <td>{r.total}</td>
                  <td>{r.success}</td>
                  <td>{r.rate == null ? '-' : `${r.rate}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {bucketAnalysis.best && (
            <div className="best-hint">
              ⭐ <strong>{bucketAnalysis.best.label}</strong> が最も成功しやすい帯です（{bucketAnalysis.best.rate}%）
            </div>
          )}
        </>
      )}
    </div>
  );
}
