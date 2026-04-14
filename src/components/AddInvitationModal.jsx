import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { calculateCurrentDay } from '../utils/checkin.js';
import { daysBetween, todayIso } from '../utils/dates.js';

export default function AddInvitationModal({ parentDevice, allDevices, allLogs, onClose, onSaved }) {
  const [eventName, setEventName] = useState('');
  const [inviteDate, setInviteDate] = useState(todayIso());
  const [childId, setChildId] = useState('');
  const [result, setResult] = useState('pending');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const candidates = allDevices.filter((d) => d.id !== parentDevice.id);

  async function handleSave(e) {
    e.preventDefault();
    if (!supabase) return;
    if (!eventName.trim()) {
      alert('イベント名は必須です');
      return;
    }
    setSaving(true);
    try {
      let childDay = null;
      let daysSinceBirth = null;
      if (childId) {
        const child = allDevices.find((d) => d.id === childId);
        if (child) {
          const { data: childLogs } = await supabase
            .from('checkin_logs')
            .select('*')
            .eq('device_id', child.id);
          childDay = calculateCurrentDay(child, childLogs || []);
          daysSinceBirth = daysBetween(child.birth_date, new Date()) + 1;
        }
      }
      const { error } = await supabase.from('invitations').insert({
        parent_device_id: parentDevice.id,
        child_device_id: childId || null,
        event_name: eventName.trim(),
        invitation_date: inviteDate,
        result,
        child_checkin_day_at_invitation: childDay,
        days_since_birth_at_invitation: daysSinceBirth,
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
          <h2>招待追加</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSave} className="modal-body">
          <label>
            イベント名 *
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="例: 招待キャンペーン"
              required
            />
          </label>
          <label>
            招待日
            <input
              type="date"
              value={inviteDate}
              onChange={(e) => setInviteDate(e.target.value)}
            />
          </label>
          <label>
            子端末（任意）
            <select value={childId} onChange={(e) => setChildId(e.target.value)}>
              <option value="">なし</option>
              {candidates.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label>
            結果
            <select value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="pending">保留</option>
              <option value="success">成功</option>
              <option value="failure">失敗</option>
            </select>
          </label>
          <label>
            メモ
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </label>
          <button type="submit" className="btn primary full" disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </form>
      </div>
    </div>
  );
}
