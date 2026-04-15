import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { calculateCurrentDay, getTodayLog, MAX_CHECKIN_DAYS } from '../utils/checkin.js';
import { todayIso } from '../utils/dates.js';
import { rebuildCyclesAfterLogChange } from '../utils/cycles.js';

const BOOL_TASKS = [
  { key: 'get_button', label: 'GETボタン' },
  { key: 'receive_button', label: '受取ボタン' },
  { key: 'ad_watch', label: '広告視聴' },
];

const VIDEO_TARGET = 180;

function videoStateClass(minutes) {
  if (minutes == null || minutes === '' || Number(minutes) <= 0) return 'none';
  if (Number(minutes) >= VIDEO_TARGET) return 'achieved';
  return 'partial';
}

export default function DeviceCard({ device, logs, task, currentCycle, onChange }) {
  const [saving, setSaving] = useState(false);
  const [localTask, setLocalTask] = useState(task || {});
  const [videoMinutes, setVideoMinutes] = useState(
    task?.video_minutes != null ? String(task.video_minutes) : ''
  );
  const cycleStartDate = currentCycle?.start_date || null;
  const cycleNumber = currentCycle?.cycle_number || 1;
  const currentDay = useMemo(
    () => calculateCurrentDay(device, logs, cycleStartDate),
    [device, logs, cycleStartDate]
  );
  const todayLog = getTodayLog(device, logs);

  useEffect(() => {
    setLocalTask(task || {});
    setVideoMinutes(task?.video_minutes != null ? String(task.video_minutes) : '');
  }, [task]);

  async function persistTask(patch) {
    if (!supabase) return;
    const merged = { ...localTask, ...patch };
    const minutesRaw = patch.video_minutes !== undefined ? patch.video_minutes : merged.video_minutes;
    const parsedMinutes =
      minutesRaw === '' || minutesRaw == null ? null : parseInt(minutesRaw, 10);
    const payload = {
      device_id: device.id,
      task_date: todayIso(),
      video_180min: parsedMinutes != null && parsedMinutes >= VIDEO_TARGET,
      video_minutes: Number.isNaN(parsedMinutes) ? null : parsedMinutes,
      get_button: !!merged.get_button,
      receive_button: !!merged.receive_button,
      ad_watch: !!merged.ad_watch,
    };
    const { error } = await supabase
      .from('daily_tasks')
      .upsert(payload, { onConflict: 'device_id,task_date' });
    if (error) throw error;
    setLocalTask({ ...merged, video_minutes: payload.video_minutes });
  }

  async function toggleBool(field) {
    if (saving) return;
    setSaving(true);
    const prev = localTask;
    try {
      await persistTask({ [field]: !localTask[field] });
    } catch (e) {
      alert('タスク保存失敗: ' + e.message);
      setLocalTask(prev);
    } finally {
      setSaving(false);
    }
  }

  async function saveVideoMinutes(value) {
    if (saving) return;
    const prev = localTask.video_minutes;
    if (String(prev ?? '') === String(value ?? '')) return;
    setSaving(true);
    try {
      await persistTask({ video_minutes: value === '' ? null : value });
    } catch (e) {
      alert('動画分数の保存失敗: ' + e.message);
      setVideoMinutes(prev != null ? String(prev) : '');
    } finally {
      setSaving(false);
    }
  }

  async function recordCheckin(status) {
    if (!supabase || saving) return;
    if (todayLog) {
      if (!confirm('本日のチェックインは既に記録されています。上書きしますか？')) return;
    }
    setSaving(true);
    try {
      if (todayLog) {
        const updatePayload = { status, day_number: currentDay };
        if (currentCycle?.id) updatePayload.cycle_id = currentCycle.id;
        const { error } = await supabase
          .from('checkin_logs')
          .update(updatePayload)
          .eq('id', todayLog.id);
        if (error) throw error;
      } else {
        const insertPayload = {
          device_id: device.id,
          log_date: todayIso(),
          status,
          day_number: currentDay,
        };
        if (currentCycle?.id) insertPayload.cycle_id = currentCycle.id;
        const { error } = await supabase.from('checkin_logs').insert(insertPayload);
        if (error) throw error;
      }
      await rebuildCyclesAfterLogChange(device.id);
      onChange && onChange();
    } catch (e) {
      alert('チェックイン保存失敗: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  const videoCls = videoStateClass(videoMinutes);

  return (
    <div className="device-card">
      <div className="card-top">
        <div className="card-name-wrap">
          <div className="card-name">{device.name}</div>
          <div className="cycle-badge">第{cycleNumber}サイクル</div>
        </div>
        <Link to={`/device/${device.id}`} className="detail-link">詳細 ›</Link>
      </div>

      <div className="progress-wrap">
        <div className="progress-label">
          Day <strong>{currentDay}</strong> / {MAX_CHECKIN_DAYS}
        </div>
        <div className="progress-bar">
          {Array.from({ length: MAX_CHECKIN_DAYS }).map((_, i) => (
            <div
              key={i}
              className={
                'progress-cell ' +
                (i + 1 < currentDay ? 'done' : i + 1 === currentDay ? 'current' : '')
              }
            />
          ))}
        </div>
      </div>

      <div className={'video-task ' + videoCls}>
        <span className="video-label">動画視聴</span>
        <div className="video-input-wrap">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="0"
            value={videoMinutes}
            disabled={saving}
            onChange={(e) => setVideoMinutes(e.target.value)}
            onBlur={(e) => saveVideoMinutes(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
          />
          <span className="video-unit">分</span>
        </div>
        <span className="video-target">
          {videoCls === 'achieved' ? '✅ 達成' : `/ ${VIDEO_TARGET}分`}
        </span>
      </div>

      <div className="tasks">
        {BOOL_TASKS.map((t) => (
          <label key={t.key} className={'task-row ' + (localTask[t.key] ? 'checked' : '')}>
            <input
              type="checkbox"
              checked={!!localTask[t.key]}
              disabled={saving}
              onChange={() => toggleBool(t.key)}
            />
            <span>{t.label}</span>
          </label>
        ))}
      </div>

      <div className="checkin-actions">
        <button
          className={'btn success ' + (todayLog?.status === 'success' ? 'active' : '')}
          onClick={() => recordCheckin('success')}
          disabled={saving}
        >
          ✅ 成功
        </button>
        <button
          className={'btn danger ' + (todayLog?.status === 'error' ? 'active' : '')}
          onClick={() => recordCheckin('error')}
          disabled={saving}
        >
          ❌ エラー
        </button>
      </div>
    </div>
  );
}
