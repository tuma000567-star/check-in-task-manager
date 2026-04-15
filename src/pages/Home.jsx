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

  return (
    <div className="page home">
      <header className="home-header">
        <div className="date-big">{formatDateJa(new Date())}</div>
        <div className="subtitle">チェックイン管理</div>
      </header>

      {error && <div className="error-box">エラー: {error}</div>}

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : devices.length === 0 ? (
        <div className="empty">
          <p>端末がまだありません</p>
          <p className="hint">右下の「＋」から追加してください</p>
        </div>
      ) : (
        <div className="device-list">
          {devices.map((d) => (
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
