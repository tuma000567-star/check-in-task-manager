import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { buildCalendar, calculateCurrentDay } from '../utils/checkin.js';
import { daysBetween, formatDateJa, todayIso } from '../utils/dates.js';
import {
  getCurrentCycleForDate,
  rebuildCyclesAfterLogChange,
} from '../utils/cycles.js';
import AddInvitationModal from '../components/AddInvitationModal.jsx';
import EditDeviceModal from '../components/EditDeviceModal.jsx';

export default function DeviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [logs, setLogs] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [allDevices, setAllDevices] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [tab, setTab] = useState('checkin');
  const [showInvite, setShowInvite] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [editingLogId, setEditingLogId] = useState(null);
  const [togglingLog, setTogglingLog] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    if (!supabase) return;
    try {
      const [devRes, logRes, invRes, allRes] = await Promise.all([
        supabase.from('devices').select('*').eq('id', id).single(),
        supabase.from('checkin_logs').select('*').eq('device_id', id).order('log_date'),
        supabase.from('invitations').select('*').eq('parent_device_id', id).order('invitation_date', { ascending: false }),
        supabase.from('devices').select('*').order('name'),
      ]);
      if (devRes.error) throw devRes.error;
      setDevice(devRes.data);
      setLogs(logRes.data || []);
      setInvitations(invRes.data || []);
      setAllDevices(allRes.data || []);

      const cycleRes = await supabase
        .from('checkin_cycles')
        .select('*')
        .eq('device_id', id)
        .order('cycle_number');
      if (!cycleRes.error) setCycles(cycleRes.data || []);
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const currentCycle = useMemo(() => getCurrentCycleForDate(cycles), [cycles]);

  const cycleStartDate = currentCycle?.start_date || null;

  const daysSinceBirth = useMemo(() => {
    if (!device) return 0;
    return daysBetween(device.birth_date, new Date()) + 1;
  }, [device]);

  const calendar = useMemo(() => {
    if (!device) return { cells: [], currentDay: 1 };
    return buildCalendar(device, logs, cycleStartDate);
  }, [device, logs, cycleStartDate]);

  const currentDay = useMemo(() => {
    if (!device) return 1;
    return calculateCurrentDay(device, logs, cycleStartDate);
  }, [device, logs, cycleStartDate]);

  const inviteStats = useMemo(() => {
    const total = invitations.length;
    const success = invitations.filter((i) => i.result === 'success').length;
    const rate = total ? Math.round((success / total) * 100) : 0;
    return { total, success, rate };
  }, [invitations]);

  const cycleRows = useMemo(() => {
    return [...cycles]
      .sort((a, b) => b.cycle_number - a.cycle_number)
      .map((c) => {
        const cycleLogs = logs.filter((l) => {
          if (l.cycle_id) return l.cycle_id === c.id;
          const d = new Date(l.log_date);
          const start = new Date(c.start_date);
          const end = c.end_date ? new Date(c.end_date) : new Date();
          return d >= start && d <= end;
        });
        const success = cycleLogs.filter((l) => l.status === 'success').length;
        const rate = cycleLogs.length
          ? Math.round((success / cycleLogs.length) * 100)
          : 0;
        const maxDay = cycleLogs.reduce(
          (m, l) => Math.max(m, l.day_number || 0),
          0
        );
        const finished = maxDay >= 14;
        return {
          ...c,
          logCount: cycleLogs.length,
          successCount: success,
          rate,
          maxDay,
          finished,
        };
      });
  }, [cycles, logs]);

  async function handleDelete() {
    if (!supabase || deleting) return;
    if (!confirm(`「${device.name}」を削除しますか？関連するチェックインログ・サイクル・招待履歴・日次タスクも全て削除されます。`)) return;
    if (!confirm('本当に削除しますか？この操作は取り消せません')) return;
    setDeleting(true);
    try {
      const { error: delErr } = await supabase
        .from('devices')
        .delete()
        .eq('id', id);
      if (delErr) throw delErr;
      navigate('/');
    } catch (e) {
      alert('削除失敗: ' + e.message);
      setDeleting(false);
    }
  }

  async function handleReboot() {
    if (!supabase || rebooting) return;
    if (!confirm(`${device.name} をリブートしますか？チェックイン記録はリセットされ、ホームから非表示になります。`)) return;
    if (!confirm('本当にリブートしますか？再登録するまで表示されません。')) return;
    setRebooting(true);
    try {
      const { error: upErr } = await supabase
        .from('devices')
        .update({
          is_active: false,
          rebooted_at: new Date().toISOString(),
          reboot_count: (device.reboot_count || 0) + 1,
        })
        .eq('id', id);
      if (upErr) throw upErr;
      navigate('/');
    } catch (e) {
      alert('リブート失敗: ' + e.message);
      setRebooting(false);
    }
  }

  async function toggleLogStatus(log, newStatus) {
    if (!supabase || togglingLog) return;
    if (log.status === newStatus) {
      setEditingLogId(null);
      return;
    }
    const label = newStatus === 'success' ? '成功' : 'エラー';
    if (!confirm(`${formatDateJa(log.log_date)} のログを「${label}」に変更しますか？`)) {
      return;
    }
    setTogglingLog(true);
    try {
      const { error: upErr } = await supabase
        .from('checkin_logs')
        .update({ status: newStatus })
        .eq('id', log.id);
      if (upErr) throw upErr;
      await rebuildCyclesAfterLogChange(id);
      setEditingLogId(null);
      await load();
    } catch (e) {
      alert('更新失敗: ' + e.message);
    } finally {
      setTogglingLog(false);
    }
  }

  async function handleRestart() {
    if (!supabase || restarting) return;
    if (!confirm('再スタートしますか？')) return;
    if (!confirm('本当に実行しますか？この操作は取り消せません')) return;
    setRestarting(true);
    const today = todayIso();
    try {
      if (currentCycle) {
        const { error: upErr } = await supabase
          .from('checkin_cycles')
          .update({ end_date: today, completed: true })
          .eq('id', currentCycle.id);
        if (upErr) throw upErr;
      }
      const nextNumber = (currentCycle?.cycle_number || 0) + 1;
      const { error: insErr } = await supabase.from('checkin_cycles').insert({
        device_id: id,
        cycle_number: nextNumber,
        start_date: today,
        completed: false,
      });
      if (insErr) throw insErr;
      const { error: devErr } = await supabase
        .from('devices')
        .update({ checkin_start_date: today, current_checkin_day: 1 })
        .eq('id', id);
      if (devErr) throw devErr;
      await load();
    } catch (e) {
      alert('再スタート失敗: ' + e.message);
    } finally {
      setRestarting(false);
    }
  }

  if (!device) {
    return (
      <div className="page">
        <Link to="/" className="back">← 戻る</Link>
        <div className="loading">{error || '読み込み中...'}</div>
      </div>
    );
  }

  return (
    <div className="page detail">
      <Link to="/" className="back">← 戻る</Link>
      <div className="detail-header">
        <h1 className="detail-name">{device.name}</h1>
        {currentCycle && (
          <div className="cycle-badge current">第{currentCycle.cycle_number}サイクル</div>
        )}
        {device.is_active === false && (
          <div className="rebooted-badge large">🔄 リブート済み</div>
        )}
      </div>

      {device.is_active === false && (
        <div className="rebooted-banner">
          この端末はリブート済みです（累計 {device.reboot_count || 0} 回）。ホームから非表示になっています。
          {device.rebooted_at && (
            <div className="rebooted-at">最終リブート: {formatDateJa(device.rebooted_at)}</div>
          )}
        </div>
      )}

      <div className="detail-actions">
        <button
          type="button"
          className="btn ghost small"
          onClick={() => setShowEdit(true)}
          disabled={deleting || rebooting}
        >
          ✏️ 編集
        </button>
        <button
          type="button"
          className="btn warn small"
          onClick={handleReboot}
          disabled={deleting || rebooting || device.is_active === false}
        >
          🔄 {rebooting ? '処理中...' : 'リブート'}
        </button>
        <button
          type="button"
          className="btn danger small"
          onClick={handleDelete}
          disabled={deleting || rebooting}
        >
          🗑 {deleting ? '削除中...' : '削除'}
        </button>
      </div>

      <div className="info-grid">
        <div className="info-item">
          <div className="info-label">生まれた方法</div>
          <div className="info-val">{device.birth_method}</div>
        </div>
        <div className="info-item">
          <div className="info-label">親端末</div>
          <div className="info-val">
            {(() => {
              const parentDev = allDevices.find((d) => d.id === device.parent_id);
              return parentDev?.name || device.parent_name || '—';
            })()}
          </div>
        </div>
        <div className="info-item">
          <div className="info-label">誕生日</div>
          <div className="info-val">{formatDateJa(device.birth_date)}</div>
        </div>
        <div className="info-item">
          <div className="info-label">グループ</div>
          <div className="info-val">{device.group_name || '—'}</div>
        </div>
        <div className="info-item">
          <div className="info-label">残高</div>
          <div className={'info-val ' + ((device.balance || 0) > 0 ? 'balance-gold' : '')}>
            ¥{(device.balance || 0).toLocaleString()}
          </div>
        </div>
        <div className="info-item full">
          <div className="info-label">誕生からの経過</div>
          <div className="info-val big-days">
            {daysSinceBirth}<span>日目</span>
          </div>
        </div>
        <div className="info-item">
          <div className="info-label">現在</div>
          <div className="info-val">Day {currentDay}</div>
        </div>
        <div className="info-item">
          <div className="info-label">サイクル開始</div>
          <div className="info-val">
            {currentCycle ? formatDateJa(currentCycle.start_date) : '-'}
          </div>
        </div>
      </div>

      <button
        className="btn restart full"
        onClick={handleRestart}
        disabled={restarting}
      >
        🔄 {restarting ? '処理中...' : '再スタート'}
      </button>

      <div className="tabs">
        <button className={tab === 'checkin' ? 'active' : ''} onClick={() => setTab('checkin')}>
          チェックイン
        </button>
        <button className={tab === 'cycles' ? 'active' : ''} onClick={() => setTab('cycles')}>
          サイクル履歴
        </button>
        <button className={tab === 'invite' ? 'active' : ''} onClick={() => setTab('invite')}>
          招待履歴
        </button>
      </div>

      {tab === 'checkin' && (
        <>
          <section>
            <h3 className="section-title">カレンダー（現在のサイクル）</h3>
            <div className="calendar">
              {calendar.cells.map((c) => (
                <div
                  key={c.day}
                  className={'cal-cell ' + c.status}
                  title={`Day ${c.day}: ${c.date}`}
                >
                  <div className="cal-day">{c.day}</div>
                  <div className="cal-status">
                    {c.status === 'success' ? '✅' : c.status === 'error' ? '❌' : c.status === 'today' ? '⏳' : ''}
                  </div>
                </div>
              ))}
            </div>
            <div className="legend">
              <span className="lg success">成功</span>
              <span className="lg error">エラー</span>
              <span className="lg today">今日</span>
              <span className="lg future">未実施</span>
            </div>
          </section>

          <section>
            <h3 className="section-title">過去ログ（タップで編集）</h3>
            <ul className="log-list">
              {logs.length === 0 && <li className="empty-row">まだログがありません</li>}
              {[...logs].reverse().map((l) => (
                <li key={l.id} className={'log-row editable ' + l.status}>
                  <button
                    type="button"
                    className="log-summary"
                    onClick={() => setEditingLogId(editingLogId === l.id ? null : l.id)}
                    disabled={togglingLog}
                  >
                    <span>{formatDateJa(l.log_date)}</span>
                    <span>Day {l.day_number}</span>
                    <span>{l.status === 'success' ? '✅ 成功' : '❌ エラー'}</span>
                  </button>
                  {editingLogId === l.id && (
                    <div className="log-actions">
                      <button
                        type="button"
                        className="btn success small"
                        disabled={togglingLog || l.status === 'success'}
                        onClick={() => toggleLogStatus(l, 'success')}
                      >
                        ✅ 成功に変更
                      </button>
                      <button
                        type="button"
                        className="btn danger small"
                        disabled={togglingLog || l.status === 'error'}
                        onClick={() => toggleLogStatus(l, 'error')}
                      >
                        ❌ エラーに変更
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {tab === 'cycles' && (
        <section>
          <h3 className="section-title">サイクル履歴</h3>
          <ul className="cycle-list">
            {cycleRows.length === 0 && (
              <li className="empty-row">サイクル情報がありません</li>
            )}
            {cycleRows.map((c) => (
              <li
                key={c.id}
                className={'cycle-row ' + (c.completed ? 'done' : 'active')}
              >
                <div className="cycle-row-head">
                  <strong>第{c.cycle_number}サイクル</strong>
                  <span className={'cycle-status ' + (c.finished ? 'finished' : c.completed ? 'incomplete' : 'in-progress')}>
                    {c.finished ? '完走' : c.completed ? '未完走' : '進行中'}
                  </span>
                </div>
                <div className="cycle-row-body">
                  <span>
                    {formatDateJa(c.start_date)} 〜 {c.end_date ? formatDateJa(c.end_date) : '進行中'}
                  </span>
                  <span>到達 Day {c.maxDay || 0}</span>
                  <span>
                    成功 {c.successCount}/{c.logCount}（{c.rate}%）
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'invite' && (
        <>
          <div className="invite-head">
            <div className="invite-stat">
              招待 <strong>{inviteStats.total}</strong> 件 / 成功{' '}
              <strong>{inviteStats.success}</strong> 件 / 成功率{' '}
              <strong>{inviteStats.rate}%</strong>
            </div>
            <button className="btn primary" onClick={() => setShowInvite(true)}>
              ＋ 招待追加
            </button>
          </div>
          <ul className="invite-list">
            {invitations.length === 0 && <li className="empty-row">まだ招待履歴がありません</li>}
            {invitations.map((i) => {
              const child = allDevices.find((d) => d.id === i.child_device_id);
              return (
                <li key={i.id} className={'invite-row ' + i.result}>
                  <div className="inv-main">
                    <strong>{i.event_name}</strong>
                    <span className="inv-date">{formatDateJa(i.invitation_date)}</span>
                  </div>
                  <div className="inv-sub">
                    <span>子端末: {child ? child.name : '未紐付'}</span>
                    <span>結果: {i.result}</span>
                    {i.child_checkin_day_at_invitation != null && (
                      <span>招待時Day {i.child_checkin_day_at_invitation}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {showInvite && (
            <AddInvitationModal
              parentDevice={device}
              allDevices={allDevices}
              allLogs={logs}
              onClose={() => setShowInvite(false)}
              onSaved={() => {
                setShowInvite(false);
                load();
              }}
            />
          )}
        </>
      )}

      {showEdit && (
        <EditDeviceModal
          device={device}
          allDevices={allDevices}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            load();
          }}
        />
      )}
    </div>
  );
}
