import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { calculateCurrentDay, getTodayLog, MAX_CHECKIN_DAYS } from '../utils/checkin.js';
import { todayIso } from '../utils/dates.js';

const TASK_FIELDS = [
  { key: 'video_180min', label: '180分動画' },
  { key: 'get_button', label: 'GETボタン' },
  { key: 'receive_button', label: '受取ボタン' },
  { key: 'ad_watch', label: '広告視聴' },
];

export default function DeviceCard({ device, logs, task, onChange }) {
  const [saving, setSaving] = useState(false);
  const [localTask, setLocalTask] = useState(task || {});
  const currentDay = useMemo(() => calculateCurrentDay(device, logs), [device, logs]);
  const todayLog = getTodayLog(device, logs);

  async function toggleTask(field) {
    if (!supabase || saving) return;
    setSaving(true);
    const nextValue = !localTask[field];
    const newTask = { ...localTask, [field]: nextValue };
    setLocalTask(newTask);
    try {
      const payload = {
        device_id: device.id,
        task_date: todayIso(),
        video_180min: !!newTask.video_180min,
        get_button: !!newTask.get_button,
        receive_button: !!newTask.receive_button,
        ad_watch: !!newTask.ad_watch,
      };
      const { error } = await supabase
        .from('daily_tasks')
        .upsert(payload, { onConflict: 'device_id,task_date' });
      if (error) throw error;
    } catch (e) {
      alert('タスク保存失敗: ' + e.message);
      setLocalTask(localTask);
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
        const { error } = await supabase
          .from('checkin_logs')
          .update({ status, day_number: currentDay })
          .eq('id', todayLog.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('checkin_logs').insert({
          device_id: device.id,
          log_date: todayIso(),
          status,
          day_number: currentDay,
        });
        if (error) throw error;
      }
      onChange && onChange();
    } catch (e) {
      alert('チェックイン保存失敗: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="device-card">
      <div className="card-top">
        <div className="card-name">{device.name}</div>
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

      <div className="tasks">
        {TASK_FIELDS.map((t) => (
          <label key={t.key} className={'task-row ' + (localTask[t.key] ? 'checked' : '')}>
            <input
              type="checkbox"
              checked={!!localTask[t.key]}
              disabled={saving}
              onChange={() => toggleTask(t.key)}
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
