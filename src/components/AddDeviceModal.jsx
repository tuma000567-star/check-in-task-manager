import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { todayIso } from '../utils/dates.js';

export default function AddDeviceModal({ devices, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [birthMethod, setBirthMethod] = useState('');
  const [parentId, setParentId] = useState('');
  const [birthDate, setBirthDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

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
        parent_id: parentId || null,
        birth_date: birthDate,
        checkin_start_date: todayIso(),
        current_checkin_day: 1,
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
            <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">なし</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label>
            誕生日
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
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
