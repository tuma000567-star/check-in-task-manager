import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { todayIso } from '../utils/dates.js';
import { rebuildCyclesAfterLogChange } from '../utils/cycles.js';

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

export default function EditDeviceModal({ device, allDevices, onClose, onSaved }) {
  const initialParent = (() => {
    if (device.parent_id) {
      const p = (allDevices || []).find((d) => d.id === device.parent_id);
      return p?.name || '';
    }
    return device.parent_name || '';
  })();

  const [name, setName] = useState(device.name || '');
  const [birthMethod, setBirthMethod] = useState(device.birth_method || '');
  const [parentText, setParentText] = useState(initialParent);
  const [birthDate, setBirthDate] = useState(device.birth_date || todayIso());
  const [checkinStartDate, setCheckinStartDate] = useState(
    device.checkin_start_date || todayIso()
  );
  const [currentDay, setCurrentDay] = useState(
    device.current_checkin_day || currentDayFromStartDate(device.checkin_start_date || todayIso())
  );
  const [balance, setBalance] = useState(String(device.balance || 0));
  const [notes, setNotes] = useState(device.notes || '');
  const [saving, setSaving] = useState(false);

  const parentCandidates = (allDevices || []).filter(
    (d) => d && d.id && d.id !== device.id && d.is_active !== false
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

  async function handleSave(e) {
    e.preventDefault();
    if (!supabase || saving) return;
    if (!name.trim() || !birthMethod.trim()) {
      alert('端末名と生まれた方法は必須です');
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

      const balVal = parseInt(balance, 10);
      const { error } = await supabase
        .from('devices')
        .update({
          name: name.trim(),
          birth_method: birthMethod.trim(),
          parent_id: parentId,
          parent_name: parentName,
          birth_date: birthDate,
          checkin_start_date: checkinStartDate,
          current_checkin_day: currentDay,
          balance: Number.isNaN(balVal) ? 0 : balVal,
          notes: notes.trim() || null,
        })
        .eq('id', device.id);
      if (error) throw error;

      if (checkinStartDate !== device.checkin_start_date) {
        const { data: actCycles } = await supabase
          .from('checkin_cycles')
          .select('*')
          .eq('device_id', device.id)
          .is('end_date', null)
          .eq('completed', false)
          .order('cycle_number', { ascending: false })
          .limit(1);
        if (actCycles && actCycles.length > 0) {
          const { error: cycErr } = await supabase
            .from('checkin_cycles')
            .update({ start_date: checkinStartDate })
            .eq('id', actCycles[0].id);
          if (cycErr) throw cycErr;
        }
        try {
          await rebuildCyclesAfterLogChange(device.id);
        } catch (e) {
          console.warn('Rebuild skipped:', e.message);
        }
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
          <h2>端末編集</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSave} className="modal-body">
          <label>
            端末名 *
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            生まれた方法 *
            <input
              type="text"
              value={birthMethod}
              onChange={(e) => setBirthMethod(e.target.value)}
              required
            />
          </label>
          <label>
            親端末（選択 or 手入力）
            <input
              type="text"
              list="edit-parent-device-options"
              value={parentText}
              onChange={(e) => setParentText(e.target.value)}
              placeholder="空欄でなし"
              autoComplete="off"
            />
            <datalist id="edit-parent-device-options">
              {parentCandidates.map((d) => (
                <option key={d.id} value={d.name} />
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
            開始日／日数を変更すると現在サイクルが再計算されます。
          </span>
          <label>
            残高（円）
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0"
            />
          </label>
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
