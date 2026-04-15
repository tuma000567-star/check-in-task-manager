import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { todayIso, formatDateJa } from '../utils/dates.js';
import { getCurrentCycleForDate } from '../utils/cycles.js';
import DeviceCard from '../components/DeviceCard.jsx';
import AddDeviceModal from '../components/AddDeviceModal.jsx';

export default function Home() {
  const [devices, setDevices] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const today = todayIso();

  async function loadAll() {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [devRes, logRes, taskRes] = await Promise.all([
        supabase.from('devices').select('*').eq('is_active', true).order('created_at'),
        supabase.from('checkin_logs').select('*').order('log_date'),
        supabase.from('daily_tasks').select('*').eq('task_date', today),
      ]);
      if (devRes.error) throw devRes.error;
      if (logRes.error) throw logRes.error;
      if (taskRes.error) throw taskRes.error;
      setDevices(devRes.data || []);
      setLogs(logRes.data || []);
      setTasks(taskRes.data || []);

      const cycleRes = await supabase
        .from('checkin_cycles')
        .select('*')
        .order('cycle_number');
      if (!cycleRes.error) setCycles(cycleRes.data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const taskByDevice = useMemo(() => {
    const m = {};
    for (const t of tasks) m[t.device_id] = t;
    return m;
  }, [tasks]);

  const currentCycleByDevice = useMemo(() => {
    const byDevice = {};
    for (const c of cycles) {
      if (!byDevice[c.device_id]) byDevice[c.device_id] = [];
      byDevice[c.device_id].push(c);
    }
    const m = {};
    for (const d of devices) {
      m[d.id] = getCurrentCycleForDate(byDevice[d.id] || []);
    }
    return m;
  }, [cycles, devices]);

  const homeStats = useMemo(() => {
    const total = devices.length;
    let successCount = 0;
    let errorCount = 0;
    for (const d of devices) {
      const todayLog = logs.find(
        (l) => l.device_id === d.id && l.log_date === today
      );
      if (!todayLog) continue;
      if (todayLog.status === 'success') successCount += 1;
      else if (todayLog.status === 'error') errorCount += 1;
    }
    const pendingCount = total - successCount - errorCount;
    const rate = total ? Math.round((successCount / total) * 100) : 0;
    return { total, successCount, errorCount, pendingCount, rate };
  }, [devices, logs, today]);

  const filteredDevices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((d) => {
      if (d.name?.toLowerCase().includes(q)) return true;
      if (d.birth_method?.toLowerCase().includes(q)) return true;
      if (d.parent_name?.toLowerCase().includes(q)) return true;
      if (d.notes?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [devices, searchQuery]);

  return (
    <div className="page home">
      <header className="home-header">
        <div className="date-big">{formatDateJa(new Date())}</div>
        <div className="subtitle">チェックイン管理</div>
      </header>

      {error && <div className="error-box">エラー: {error}</div>}

      {!loading && devices.length > 0 && (
        <>
          <div className="home-stats">
            <div className="hstat total">
              <div className="hstat-num">{homeStats.total}</div>
              <div className="hstat-lbl">合計台数</div>
            </div>
            <div className="hstat success">
              <div className="hstat-num">{homeStats.successCount}</div>
              <div className="hstat-lbl">本日成功</div>
            </div>
            <div className="hstat error">
              <div className="hstat-num">{homeStats.errorCount}</div>
              <div className="hstat-lbl">エラー</div>
            </div>
            <div className="hstat rate">
              <div className="hstat-num">
                {homeStats.rate}<span className="hstat-pct">%</span>
              </div>
              <div className="hstat-lbl">達成率</div>
            </div>
          </div>

          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="search"
              placeholder="端末名・メモで検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="クリア"
              >
                ×
              </button>
            )}
          </div>

          {searchQuery && (
            <div className="search-result">
              {filteredDevices.length} 件ヒット
            </div>
          )}
        </>
      )}

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : devices.length === 0 ? (
        <div className="empty">
          <p>端末がまだありません</p>
          <p className="hint">右下の「＋」から追加してください</p>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="empty">
          <p>該当する端末がありません</p>
          <p className="hint">検索条件を変えてみてください</p>
        </div>
      ) : (
        <div className="device-list">
          {filteredDevices.map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              logs={logs}
              task={taskByDevice[d.id]}
              currentCycle={currentCycleByDevice[d.id]}
              onChange={loadAll}
            />
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setShowAdd(true)} aria-label="端末追加">
        ＋
      </button>

      {showAdd && (
        <AddDeviceModal
          devices={devices}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            loadAll();
          }}
        />
      )}
    </div>
  );
}
