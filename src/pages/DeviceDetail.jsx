import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { buildCalendar, calculateCurrentDay } from '../utils/checkin.js';
import { daysBetween, formatDateJa } from '../utils/dates.js';
import AddInvitationModal from '../components/AddInvitationModal.jsx';

export default function DeviceDetail() {
  const { id } = useParams();
  const [device, setDevice] = useState(null);
  const [logs, setLogs] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [allDevices, setAllDevices] = useState([]);
  const [tab, setTab] = useState('checkin');
  const [showInvite, setShowInvite] = useState(false);
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
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const daysSinceBirth = useMemo(() => {
    if (!device) return 0;
    return daysBetween(device.birth_date, new Date()) + 1;
  }, [device]);

  const calendar = useMemo(() => {
    if (!device) return { cells: [], currentDay: 1 };
    return buildCalendar(device, logs);
  }, [device, logs]);

  const currentDay = useMemo(() => {
    if (!device) return 1;
    return calculateCurrentDay(device, logs);
  }, [device, logs]);

  const inviteStats = useMemo(() => {
    const total = invitations.length;
    const success = invitations.filter((i) => i.result === 'success').length;
    const rate = total ? Math.round((success / total) * 100) : 0;
    return { total, success, rate };
  }, [invitations]);

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
      <h1 className="detail-name">{device.name}</h1>

      <div className="info-grid">
        <div className="info-item">
          <div className="info-label">生まれた方法</div>
          <div className="info-val">{device.birth_method}</div>
        </div>
        <div className="info-item">
          <div className="info-label">誕生日</div>
          <div className="info-val">{formatDateJa(device.birth_date)}</div>
        </div>
        <div className="info-item full">
          <div className="info-label">誕生からの経過</div>
          <div className="info-val big-days">{daysSinceBirth}<span>日目</span></div>
        </div>
        <div className="info-item">
          <div className="info-label">現在</div>
          <div className="info-val">Day {currentDay}</div>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'checkin' ? 'active' : ''} onClick={() => setTab('checkin')}>
          チェックイン
        </button>
        <button className={tab === 'invite' ? 'active' : ''} onClick={() => setTab('invite')}>
          招待履歴
        </button>
      </div>

      {tab === 'checkin' ? (
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
            <h3 className="section-title">過去ログ</h3>
            <ul className="log-list">
              {logs.length === 0 && <li className="empty-row">まだログがありません</li>}
              {[...logs].reverse().map((l) => (
                <li key={l.id} className={'log-row ' + l.status}>
                  <span>{formatDateJa(l.log_date)}</span>
                  <span>Day {l.day_number}</span>
                  <span>{l.status === 'success' ? '✅ 成功' : '❌ エラー'}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
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
    </div>
  );
}
