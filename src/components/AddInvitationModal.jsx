import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { calculateCurrentDay } from '../utils/checkin.js';
import { daysBetween, todayIso } from '../utils/dates.js';

const DEFAULT_EVENT_NAMES = ['通常', 'QR', 'ホームラン', '猫二人招待', '即時3000　3000'];
const NEW_EVENT_SENTINEL = '__new__';

export default function AddInvitationModal({ parentDevice, allDevices, allLogs, onClose, onSaved }) {
  const [eventNames, setEventNames] = useState(DEFAULT_EVENT_NAMES);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [customName, setCustomName] = useState('');
  const [inviteDate, setInviteDate] = useState(todayIso());
  const [childId, setChildId] = useState('');
  const [result, setResult] = useState('pending');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('event_names')
        .select('name')
        .order('created_at');
      if (error) {
        setLoadError(error.message);
        return;
      }
      if (data && data.length > 0) {
        setEventNames(data.map((r) => r.name));
      }
    })();
  }, []);

  const candidates = allDevices.filter((d) => d.id !== parentDevice.id);
  const isCustom = selectedEvent === NEW_EVENT_SENTINEL;

  async function handleSave(e) {
    e.preventDefault();
    if (!supabase) return;
    const finalName = isCustom ? customName.trim() : selectedEvent;
    if (!finalName) {
      alert('イベント名を選択または入力してください');
      return;
    }
    setSaving(true);
    try {
      if (isCustom && !eventNames.includes(finalName)) {
        const { error: insErr } = await supabase
          .from('event_names')
          .insert({ name: finalName });
        if (insErr && !/duplicate|unique/i.test(insErr.message)) {
          throw insErr;
        }
      }

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
        event_name: finalName,
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
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              required
            >
              <option value="">-- 選択 --</option>
              {eventNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
              <option value={NEW_EVENT_SENTINEL}>＋ 新しいイベント名を追加</option>
            </select>
          </label>
          {isCustom && (
            <label>
              新しいイベント名
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="例: 特別キャンペーン"
                autoFocus
              />
            </label>
          )}
          {loadError && (
            <span className="hint">イベント名リスト取得失敗: {loadError}</span>
          )}
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
