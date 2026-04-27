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

function makeBulkRow() {
  return {
    name: '',
    birth_method: '',
    parent: '',
    group: '',
    birth_date: todayIso(),
    checkin_start_date: todayIso(),
    current_day: 1,
    balance: '',
    notes: '',
  };
}

export default function AddDeviceModal({ devices, onClose, onSaved }) {
  const [mode, setMode] = useState('single');
  const [name, setName] = useState('');
  const [birthMethod, setBirthMethod] = useState('');
  const [parentText, setParentText] = useState('');
  const [groupName, setGroupName] = useState('');
  const [birthDate, setBirthDate] = useState(todayIso());
  const [checkinStartDate, setCheckinStartDate] = useState(todayIso());
  const [currentDay, setCurrentDay] = useState(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [bulkRows, setBulkRows] = useState([makeBulkRow()]);

  function updateBulkRow(idx, patch) {
    setBulkRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addBulkRow() {
    setBulkRows((rs) => [...rs, makeBulkRow()]);
  }
  function removeBulkRow(idx) {
    setBulkRows((rs) => (rs.length === 1 ? rs : rs.filter((_, i) => i !== idx)));
  }
  function bulkStartChanged(idx, val) {
    const start = new Date(val);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.floor((today - start) / 86400000);
    const day = Math.min(MAX_DAY, Math.max(1, diff + 1));
    updateBulkRow(idx, { checkin_start_date: val, current_day: day });
  }
  function bulkDayChanged(idx, val) {
    const day = clampDay(val);
    updateBulkRow(idx, { current_day: day, checkin_start_date: startDateFromCurrentDay(day) });
  }

  const existingGroups = Array.from(
    new Set((devices || []).map((d) => d?.group_name).filter(Boolean))
  );
  const existingMethods = Array.from(
    new Set((devices || []).map((d) => d?.birth_method).filter(Boolean))
  );

  const sessionGroups = Array.from(
    new Set(bulkRows.map((r) => r.group?.trim()).filter(Boolean))
  );
  const sessionMethods = Array.from(
    new Set(bulkRows.map((r) => r.birth_method?.trim()).filter(Boolean))
  );
  const sessionParents = Array.from(
    new Set(bulkRows.map((r) => r.parent?.trim()).filter(Boolean))
  );

  const allGroups = Array.from(new Set([...existingGroups, ...sessionGroups]));
  const allMethods = Array.from(new Set([...existingMethods, ...sessionMethods]));
  const allParentNames = Array.from(
    new Set([
      ...(devices || []).filter((d) => d.is_active !== false).map((d) => d.name),
      ...sessionParents,
    ])
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

  function resolveParent(typed) {
    const t = typed.trim();
    if (!t) return { parent_id: null, parent_name: null };
    const matched = parentCandidates.find((d) => d.name === t);
    if (matched) return { parent_id: matched.id, parent_name: null };
    return { parent_id: null, parent_name: t };
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!supabase) {
      alert('Supabase 未設定');
      return;
    }
    setSaving(true);
    try {
      let targets;
      if (mode === 'single') {
        if (!name.trim() || !birthMethod.trim()) {
          alert('端末名と生まれた方法は必須です');
          setSaving(false);
          return;
        }
        const p = resolveParent(parentText);
        targets = [{
          name: name.trim(),
          birth_method: birthMethod.trim(),
          parent_id: p.parent_id,
          parent_name: p.parent_name,
          group_name: groupName.trim() || null,
          birth_date: birthDate,
          checkin_start_date: checkinStartDate,
          current_checkin_day: currentDay,
          is_active: true,
          notes: notes.trim() || null,
        }];
      } else {
        const valid = bulkRows.filter((r) => r.name.trim() && r.birth_method.trim());
        if (valid.length === 0) {
          alert('端末名と生まれた方法は各端末で必須です');
          setSaving(false);
          return;
        }
        targets = valid.map((r) => {
          const p = resolveParent(r.parent);
          const balVal = parseInt(r.balance, 10);
          return {
            name: r.name.trim(),
            birth_method: r.birth_method.trim(),
            parent_id: p.parent_id,
            parent_name: p.parent_name,
            group_name: r.group.trim() || null,
            birth_date: r.birth_date,
            checkin_start_date: r.checkin_start_date,
            current_checkin_day: r.current_day,
            balance: Number.isNaN(balVal) ? 0 : balVal,
            is_active: true,
            notes: r.notes.trim() || null,
          };
        });
      }

      const { data: inserted, error } = await supabase
        .from('devices')
        .insert(targets)
        .select();
      if (error) throw error;

      if (inserted && inserted.length > 0) {
        const cycles = inserted.map((d) => ({
          device_id: d.id,
          cycle_number: 1,
          start_date: d.checkin_start_date,
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
          ) : null}

          {mode === 'bulk' && (
            <>
              <datalist id="bulk-methods">
                {allMethods.map((m) => <option key={m} value={m} />)}
              </datalist>
              <datalist id="bulk-parents">
                {allParentNames.map((p) => <option key={p} value={p} />)}
              </datalist>
              <datalist id="bulk-groups">
                {allGroups.map((g) => <option key={g} value={g} />)}
              </datalist>

              <div className="bulk-rows">
                {bulkRows.map((row, idx) => (
                  <div key={idx} className="bulk-row">
                    <div className="bulk-row-head">
                      <span className="bulk-row-num">端末 {idx + 1}</span>
                      {bulkRows.length > 1 && (
                        <button
                          type="button"
                          className="bulk-remove"
                          onClick={() => removeBulkRow(idx)}
                          aria-label="削除"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="端末名 *"
                      value={row.name}
                      onChange={(e) => updateBulkRow(idx, { name: e.target.value })}
                      className="bulk-name"
                    />
                    <div className="bulk-grid-2">
                      <input
                        type="text"
                        list="bulk-methods"
                        placeholder="生まれた方法 *"
                        value={row.birth_method}
                        onChange={(e) => updateBulkRow(idx, { birth_method: e.target.value })}
                      />
                      <input
                        type="text"
                        list="bulk-parents"
                        placeholder="親端末"
                        value={row.parent}
                        onChange={(e) => updateBulkRow(idx, { parent: e.target.value })}
                        autoComplete="off"
                      />
                    </div>
                    <div className="bulk-grid-2">
                      <input
                        type="text"
                        list="bulk-groups"
                        placeholder="グループ"
                        value={row.group}
                        onChange={(e) => updateBulkRow(idx, { group: e.target.value })}
                        autoComplete="off"
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="残高(円)"
                        value={row.balance}
                        onChange={(e) => updateBulkRow(idx, { balance: e.target.value })}
                      />
                    </div>
                    <div className="bulk-grid-3">
                      <input
                        type="date"
                        value={row.birth_date}
                        onChange={(e) => updateBulkRow(idx, { birth_date: e.target.value })}
                        title="誕生日"
                      />
                      <input
                        type="date"
                        value={row.checkin_start_date}
                        onChange={(e) => bulkStartChanged(idx, e.target.value)}
                        title="チェックイン開始日"
                      />
                      <input
                        type="number"
                        min="1"
                        max={MAX_DAY}
                        value={row.current_day}
                        onChange={(e) => bulkDayChanged(idx, e.target.value)}
                        title="現在日数"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="btn ghost full" onClick={addBulkRow}>
                ＋ もう1台追加
              </button>
            </>
          )}
          {mode === 'single' && (
            <>
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
            </>
          )}
          <button type="submit" className="btn primary full" disabled={saving}>
            {saving
              ? '保存中...'
              : mode === 'bulk'
              ? `${bulkRows.filter((r) => r.name.trim() && r.birth_method.trim()).length}件まとめて追加`
              : '保存'}
          </button>
        </form>
      </div>
    </div>
  );
}
