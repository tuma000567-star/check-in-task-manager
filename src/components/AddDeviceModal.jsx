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
  const [mode, setMode] = useState('single');
  const [name, setName] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [birthMethod, setBirthMethod] = useState('');
  const [parentText, setParentText] = useState('');
  const [groupName, setGroupName] = useState('');
  const [birthDate, setBirthDate] = useState(todayIso());
  const [checkinStartDate, setCheckinStartDate] = useState(todayIso());
  const [currentDay, setCurrentDay] = useState(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedBulk = bulkNames
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const existingGroups = Array.from(
    new Set((devices || []).map((d) => d?.group_name).filter(Boolean))
  );

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
    if (!birthMethod.trim()) {
      alert('生まれた方法は必須です');
      return;
    }
    if (mode === 'single' && !name.trim()) {
      alert('端末名は必須です');
      return;
    }
    if (mode === 'bulk' && parsedBulk.length === 0) {
      alert('端末名を1つ以上入力してください（1行1端末）');
      return;
    }
    setSaving(true);
    try {
      const typedParent = parentText.trim();
      const matchedParent = typedParent
        ? parentCandidates.find((d) => d.name === typedParent) || null
        : null;
      const parentId = matchedParent?.id || null;
      const parentName = typedParent && !matchedParent ? typedParent : null;

      const common = {
        birth_method: birthMethod.trim(),
        parent_id: parentId,
        parent_name: parentName,
        group_name: groupName.trim() || null,
        birth_date: birthDate,
        checkin_start_date: checkinStartDate,
        current_checkin_day: currentDay,
        is_active: true,
        notes: notes.trim() || null,
      };

      const targets =
        mode === 'single'
          ? [{ ...common, name: name.trim() }]
          : parsedBulk.map((n) => ({ ...common, name: n }));

      const { data: inserted, error } = await supabase
        .from('devices')
        .insert(targets)
        .select();
      if (error) throw error;

      if (inserted && inserted.length > 0) {
        const cycles = inserted.map((d) => ({
          device_id: d.id,
          cycle_number: 1,
          start_date: checkinStartDate,
          completed: false,
        }));
        const { error: cycleErr } = await supabase
          .from('checkin_cycles')
          .insert(cycles);
        if (cycleErr && !/does not exist|relation/i.test(cycleErr.message)) {
          throw cycleErr;
        }
      }

      if (mode === 'bulk' && inserted) {
        alert(`${inserted.length}件の端末を追加しました`);
      }

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
        <div className="mode-toggle">
          <button
            type="button"
            className={mode === 'single' ? 'active' : ''}
            onClick={() => setMode('single')}
          >
            1台ずつ
          </button>
          <button
            type="button"
            className={mode === 'bulk' ? 'active' : ''}
            onClick={() => setMode('bulk')}
          >
            一括追加
          </button>
        </div>
        <form onSubmit={handleSave} className="modal-body">
          {mode === 'single' ? (
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
          ) : (
            <label>
              端末名（1行1端末） *
              <textarea
                value={bulkNames}
                onChange={(e) => setBulkNames(e.target.value)}
                placeholder={'WE2 1234\nWE2 5678\nA9012'}
                rows={6}
                style={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}
              />
              <span className="hint">
                {parsedBulk.length > 0
                  ? `${parsedBulk.length}件追加します（共通設定: 下記フィールド）`
                  : '空行は無視されます'}
              </span>
            </label>
          )}
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
            親端末（選択 or 手入力）
            <input
              type="text"
              list="parent-device-options"
              value={parentText}
              onChange={(e) => setParentText(e.target.value)}
              placeholder="空欄でなし / 一覧から選択 / 新規入力"
              autoComplete="off"
            />
            <datalist id="parent-device-options">
              {parentCandidates.map((d) => (
                <option key={d.id} value={d.name} />
              ))}
            </datalist>
            <span className="hint">
              既存端末名と一致すれば自動で紐付け、新しい名前ならテキストとして保存されます。
            </span>
          </label>
          <label>
            グループ
            <input
              type="text"
              list="group-options"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="空欄でグループ未設定"
              autoComplete="off"
            />
            <datalist id="group-options">
              {existingGroups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
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
            {saving
              ? '保存中...'
              : mode === 'bulk'
              ? `${parsedBulk.length || 0}件まとめて追加`
              : '保存'}
          </button>
        </form>
      </div>
    </div>
  );
}
