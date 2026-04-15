import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { todayIso } from '../utils/dates.js';

const MAX_DAY = 14;

function clampDay(n) {
  const v = parseInt(n, 10);
  if (Number.isNaN(v)) return 1;
  return Math.min(MAX_DAY, Math.max(1, v));
}

function startDateFromCurrentDay(day) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (day - 1));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function currentDayFromStartDate(iso) {
  const start = new Date(iso);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  return Math.min(MAX_DAY, Math.max(1, diff + 1));
}

export default function AddDeviceModal({ devices, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [birthMethod, setBirthMethod] = useState('');
  const [parentId, setParentId] = useState('');
  const [birthDate, setBirthDate] = useState(todayIso());
  const [checkinStartDate, setCheckinStartDate] = useState(todayIso());
  const [currentDay, setCurrentDay] = useState(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function handleStartDateChange(v) {
    setCheckinStartDate(v);
    setCurrentDay(currentDayFromStartDate(v));
  }

  function handleCurrentDayChange(v) {
    const clamped = clampDay(v);
    setCurrentDay(clamped);
    setCheckinStartDate(startDateFromCurrentDay(clamped));
  }

  const parentCandidates = (devices || []).filter(
    (d) => d && d.id && d.is_active !== false
  );

  async function handleSave(e) {
    e.preventDefault();
    if (!supabase) {
      alert('Supabase 未設定');
      return;
    }
    if (!name.trim() || !birthMethod.trim()) {
      alert('端末名と生まれた方法は必須です');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('devices').insert({
        name: name.trim(),
        birth_method: birthMethod.trim(),
        parent_id: parentId ? parentId : null,
        birth_date: birthDate,
        checkin_start_date: checkinStartDate,
        current_checkin_day: currentDay,
        is_active: true,
        notes: notes.trim() || null,
      });
      if (error) throw error;
      onSaved && onSaved();
    } catch (err) {
      alert('保存失敗: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>端末追加</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSave} className="modal-body">
          <label>
            端末名 *
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: iPhone A"
              required
            />
          </label>
          <label>
            生まれた方法 *
            <input
              type="text"
              value={birthMethod}
              onChange={(e) => setBirthMethod(e.target.value)}
              placeholder="例: 招待、新規"
              required
            />
          </label>
          <label>
            親端末
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">なし</option>
              {parentCandidates.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {parentCandidates.length === 0 && (
              <span className="hint">登録済みの端末がまだありません</span>
            )}
          </label>
          <label>
            誕生日
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </label>
          <div className="form-row-2">
            <label>
              チェックイン開始日
              <input
                type="date"
                value={checkinStartDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </label>
            <label>
              現在のチェックイン日数
              <input
                type="number"
                min="1"
                max={MAX_DAY}
                value={currentDay}
                onChange={(e) => handleCurrentDayChange(e.target.value)}
              />
            </label>
          </div>
          <span className="hint">
            開始日と日数は連動します。既に進行中の端末はどちらかを入力してください。
          </span>
          <label>
            メモ
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </label>
          <button type="submit" className="btn primary full" disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </form>
      </div>
    </div>
  );
}
