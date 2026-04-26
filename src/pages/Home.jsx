import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { todayIso, formatDateJa } from '../utils/dates.js';
import { getCurrentCycleForDate } from '../utils/cycles.js';
import { useInterval } from '../hooks/useInterval.js';
import DeviceCard from '../components/DeviceCard.jsx';
import AddDeviceModal from '../components/AddDeviceModal.jsx';

const FILTER_MODES = {
  all: { label: '全て', short: '全て' },
  success: { label: '本日成功のみ', short: '本日成功' },
  error: { label: 'エラーのみ', short: 'エラー' },
  pending: { label: '未チェックのみ', short: '未チェック' },
};

const SCROLL_STORAGE_KEY = 'home-scroll-y';
const AUTO_REFRESH_MS = 30 * 1000;

function shallowListEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (!x || !y) return false;
    if (x.id !== y.id) return false;
    const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
    for (const k of keys) {
      if (x[k] !== y[k]) return false;
    }
  }
  return true;
}

function formatClock(date) {
  if (!date) return '--:--:--';
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function Home() {
  const [devices, setDevices] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [includeRebooted, setIncludeRebooted] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tabVisible, setTabVisible] = useState(
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'
  );
  const restoredRef = useRef(false);
  const bgRefreshingRef = useRef(false);

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
        supabase.from('devices').select('*').order('created_at'),
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
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const silentRefresh = useCallback(async () => {
    if (!supabase) return;
    if (bgRefreshingRef.current) return;
    bgRefreshingRef.current = true;
    try {
      const [devRes, logRes, taskRes, cycleRes] = await Promise.all([
        supabase.from('devices').select('*').order('created_at'),
        supabase.from('checkin_logs').select('*').order('log_date'),
        supabase.from('daily_tasks').select('*').eq('task_date', today),
        supabase.from('checkin_cycles').select('*').order('cycle_number'),
      ]);
      if (devRes.error || logRes.error || taskRes.error) return;
      setDevices((prev) => {
        const next = devRes.data || [];
        return shallowListEqual(prev, next) ? prev : next;
      });
      setLogs((prev) => {
        const next = logRes.data || [];
        return shallowListEqual(prev, next) ? prev : next;
      });
      setTasks((prev) => {
        const next = taskRes.data || [];
        return shallowListEqual(prev, next) ? prev : next;
      });
      if (!cycleRes.error) {
        setCycles((prev) => {
          const next = cycleRes.data || [];
          return shallowListEqual(prev, next) ? prev : next;
        });
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.warn('Silent refresh failed:', e);
    } finally {
      bgRefreshingRef.current = false;
    }
  }, [today]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      const visible = document.visibilityState !== 'hidden';
      setTabVisible(visible);
      if (visible) {
        silentRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [silentRefresh]);

  useInterval(
    () => {
      if (!loading) silentRefresh();
    },
    tabVisible ? AUTO_REFRESH_MS : null
  );

  useEffect(() => {
    if (restoredRef.current) return;
    if (loading) return;
    if (devices.length === 0) {
      restoredRef.current = true;
      return;
    }
    const saved = window.sessionStorage.getItem(SCROLL_STORAGE_KEY);
    if (saved) {
      const y = parseInt(saved, 10);
      if (!Number.isNaN(y) && y > 0) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo(0, y);
          });
        });
      }
    }
    restoredRef.current = true;
  }, [loading, devices.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saveScroll = () => {
      window.sessionStorage.setItem(
        SCROLL_STORAGE_KEY,
        String(window.scrollY || window.pageYOffset || 0)
      );
    };
    window.addEventListener('beforeunload', saveScroll);
    return () => {
      saveScroll();
      window.removeEventListener('beforeunload', saveScroll);
    };
  }, []);

  const taskByDevice = useMemo(() => {
    const m = {};
    for (const t of tasks) m[t.device_id] = t;
    return m;
  }, [tasks]);

  const activeDevices = useMemo(
    () => devices.filter((d) => d.is_active !== false),
    [devices]
  );

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
    const total = activeDevices.length;
    let successCount = 0;
    let errorCount = 0;
    for (const d of activeDevices) {
      const todayLog = logs.find(
        (l) => l.device_id === d.id && l.log_date === today
      );
      if (!todayLog) continue;
      if (todayLog.status === 'success') successCount += 1;
      else if (todayLog.status === 'error') errorCount += 1;
    }
    const pendingCount = total - successCount - errorCount;
    const rate = total ? Math.round((successCount / total) * 100) : 0;
    const rebootedCount = devices.length - total;
    const totalBalance = activeDevices.reduce((s, d) => s + (d.balance || 0), 0);
    return { total, successCount, errorCount, pendingCount, rate, rebootedCount, totalBalance };
  }, [activeDevices, devices, logs, today]);

  const statusByDevice = useMemo(() => {
    const m = {};
    for (const d of devices) {
      const log = logs.find(
        (l) => l.device_id === d.id && l.log_date === today
      );
      m[d.id] = log?.status || 'pending';
    }
    return m;
  }, [devices, logs, today]);

  const groupList = useMemo(() => {
    const counts = new Map();
    let unassigned = 0;
    for (const d of devices) {
      if (d.is_active === false && !includeRebooted) continue;
      const g = d.group_name?.trim();
      if (g) counts.set(g, (counts.get(g) || 0) + 1);
      else unassigned += 1;
    }
    const arr = Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'ja'))
      .map(([name, count]) => ({ name, count }));
    return { groups: arr, unassigned };
  }, [devices, includeRebooted]);

  const visibleDevices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return devices.filter((d) => {
      if (!includeRebooted && d.is_active === false) return false;
      if (filterMode !== 'all') {
        if (d.is_active === false) return false;
        if (statusByDevice[d.id] !== filterMode) return false;
      }
      if (groupFilter !== 'all') {
        const dg = d.group_name?.trim() || null;
        if (groupFilter === '__none__') {
          if (dg) return false;
        } else if (dg !== groupFilter) {
          return false;
        }
      }
      if (!q) return true;
      if (d.name?.toLowerCase().includes(q)) return true;
      if (d.birth_method?.toLowerCase().includes(q)) return true;
      if (d.parent_name?.toLowerCase().includes(q)) return true;
      if (d.group_name?.toLowerCase().includes(q)) return true;
      if (d.notes?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [devices, searchQuery, filterMode, statusByDevice, includeRebooted, groupFilter]);

  return (
    <div className="page home">
      <header className="home-header">
        <div className="date-big">{formatDateJa(new Date())}</div>
        <div className="subtitle">チェックイン管理</div>
        <div className="last-updated" aria-live="polite">
          <span className={'sync-dot ' + (tabVisible ? 'live' : 'paused')} />
          最終更新: {formatClock(lastUpdated)}
          {!tabVisible && ' (一時停止)'}
        </div>
      </header>

      {error && <div className="error-box">エラー: {error}</div>}

      {!loading && devices.length > 0 && (
        <>
          <div className="home-stats">
            <button
              type="button"
              className={'hstat total filter-card ' + (filterMode === 'all' ? 'active' : '')}
              onClick={() => setFilterMode('all')}
            >
              <div className="hstat-num">{homeStats.total}</div>
              <div className="hstat-lbl">合計台数</div>
            </button>
            <button
              type="button"
              className={'hstat success filter-card ' + (filterMode === 'success' ? 'active' : '')}
              onClick={() => setFilterMode('success')}
            >
              <div className="hstat-num">{homeStats.successCount}</div>
              <div className="hstat-lbl">本日成功</div>
            </button>
            <button
              type="button"
              className={'hstat error filter-card ' + (filterMode === 'error' ? 'active' : '')}
              onClick={() => setFilterMode('error')}
            >
              <div className="hstat-num">{homeStats.errorCount}</div>
              <div className="hstat-lbl">エラー</div>
            </button>
            <button
              type="button"
              className={'hstat pending filter-card ' + (filterMode === 'pending' ? 'active' : '')}
              onClick={() => setFilterMode('pending')}
            >
              <div className="hstat-num">{homeStats.pendingCount}</div>
              <div className="hstat-lbl">未チェック</div>
            </button>
            <div className="hstat rate readonly">
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
          <label className="reboot-toggle">
            <input
              type="checkbox"
              checked={includeRebooted}
              onChange={(e) => setIncludeRebooted(e.target.checked)}
            />
            <span>リブート済みを含む{homeStats.rebootedCount > 0 ? `（${homeStats.rebootedCount}台）` : ''}</span>
          </label>

          {(groupList.groups.length > 0 || groupList.unassigned > 0) && (
            <div className="group-chips">
              <button
                type="button"
                className={'chip ' + (groupFilter === 'all' ? 'active' : '')}
                onClick={() => setGroupFilter('all')}
              >
                全て
              </button>
              {groupList.groups.map((g) => (
                <button
                  key={g.name}
                  type="button"
                  className={'chip ' + (groupFilter === g.name ? 'active' : '')}
                  onClick={() => setGroupFilter(g.name)}
                >
                  {g.name}<span className="chip-count">{g.count}</span>
                </button>
              ))}
              {groupList.unassigned > 0 && (
                <button
                  type="button"
                  className={'chip none ' + (groupFilter === '__none__' ? 'active' : '')}
                  onClick={() => setGroupFilter('__none__')}
                >
                  未設定<span className="chip-count">{groupList.unassigned}</span>
                </button>
              )}
            </div>
          )}

          {filterMode !== 'all' && (
            <div className="filter-badge">
              <span>{FILTER_MODES[filterMode].label}（{visibleDevices.length}件）</span>
              <button
                type="button"
                className="filter-badge-clear"
                onClick={() => setFilterMode('all')}
                aria-label="フィルター解除"
              >
                ×
              </button>
            </div>
          )}
          {filterMode === 'all' && searchQuery && (
            <div className="search-result">{visibleDevices.length} 件ヒット</div>
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
      ) : visibleDevices.length === 0 ? (
        <div className="empty">
          <p>該当する端末がありません</p>
          <p className="hint">
            {filterMode !== 'all' ? 'フィルターを変えてみてください' : '検索条件を変えてみてください'}
          </p>
        </div>
      ) : (
        <div className="device-list">
          {visibleDevices.map((d) => (
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
