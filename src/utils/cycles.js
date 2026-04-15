import { supabase } from '../lib/supabase.js';
import { addDaysIso, toDateOnly } from './dates.js';

export function getCurrentCycleForDate(cycles, now = new Date()) {
  const today = toDateOnly(now);
  const eligible = (cycles || []).filter(
    (c) => toDateOnly(c.start_date) <= today
  );
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => b.cycle_number - a.cycle_number)[0];
}

function cyclesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.cycle_number !== y.cycle_number ||
      x.start_date !== y.start_date ||
      (x.end_date || null) !== (y.end_date || null) ||
      (!!x.completed) !== (!!y.completed)
    ) {
      return false;
    }
  }
  return true;
}

function containsDate(cycle, isoDate) {
  if (isoDate < cycle.start_date) return false;
  if (cycle.end_date && isoDate > cycle.end_date) return false;
  return true;
}

function dayNumberFor(cycle, isoDate) {
  const [y1, m1, d1] = cycle.start_date.split('-').map(Number);
  const [y2, m2, d2] = isoDate.split('-').map(Number);
  const a = new Date(y1, m1 - 1, d1).getTime();
  const b = new Date(y2, m2 - 1, d2).getTime();
  return Math.floor((b - a) / 86400000) + 1;
}

export async function rebuildCyclesAfterLogChange(deviceId) {
  if (!supabase) return;

  const [logsRes, cyclesRes] = await Promise.all([
    supabase
      .from('checkin_logs')
      .select('*')
      .eq('device_id', deviceId)
      .order('log_date'),
    supabase
      .from('checkin_cycles')
      .select('*')
      .eq('device_id', deviceId)
      .order('cycle_number'),
  ]);
  if (logsRes.error) throw logsRes.error;
  if (cyclesRes.error) throw cyclesRes.error;

  const logs = logsRes.data || [];
  const cycles = cyclesRes.data || [];
  if (cycles.length === 0) return;

  let freezeIdx = -1;
  for (let i = cycles.length - 1; i >= 0; i--) {
    if (cycles[i].completed === true) {
      freezeIdx = i;
      break;
    }
  }

  const frozenCycles = cycles.slice(0, freezeIdx + 1);

  let rebuildStartDate;
  let rebuildCycleNumber;
  if (freezeIdx >= 0) {
    const freeze = cycles[freezeIdx];
    rebuildStartDate = freeze.end_date || freeze.start_date;
    rebuildCycleNumber = freeze.cycle_number + 1;
  } else {
    rebuildStartDate = cycles[0].start_date;
    rebuildCycleNumber = 1;
  }

  const relevantLogs = logs.filter((l) => l.log_date >= rebuildStartDate);
  const errorLogs = relevantLogs
    .filter((l) => l.status === 'error')
    .sort((a, b) => a.log_date.localeCompare(b.log_date));

  const desired = [];
  let curStart = rebuildStartDate;
  let curNum = rebuildCycleNumber;
  for (const err of errorLogs) {
    desired.push({
      cycle_number: curNum,
      start_date: curStart,
      end_date: err.log_date,
      completed: false,
    });
    curStart = addDaysIso(err.log_date, 1);
    curNum += 1;
  }
  desired.push({
    cycle_number: curNum,
    start_date: curStart,
    end_date: null,
    completed: false,
  });

  const existingNonFrozen = cycles.slice(freezeIdx + 1);
  const cyclesUnchanged = cyclesEqual(desired, existingNonFrozen);

  let allCyclesNow;
  if (cyclesUnchanged) {
    allCyclesNow = cycles;
  } else {
    if (existingNonFrozen.length > 0) {
      const delRes = await supabase
        .from('checkin_cycles')
        .delete()
        .in('id', existingNonFrozen.map((c) => c.id));
      if (delRes.error) throw delRes.error;
    }
    const inserts = desired.map((d) => ({
      device_id: deviceId,
      cycle_number: d.cycle_number,
      start_date: d.start_date,
      end_date: d.end_date,
      completed: d.completed,
    }));
    const insRes = await supabase
      .from('checkin_cycles')
      .insert(inserts)
      .select();
    if (insRes.error) throw insRes.error;
    allCyclesNow = [...frozenCycles, ...(insRes.data || [])];
  }

  for (const log of logs) {
    const cycle = allCyclesNow.find((c) => containsDate(c, log.log_date));
    if (!cycle) continue;
    const newDay = dayNumberFor(cycle, log.log_date);
    if (log.cycle_id !== cycle.id || log.day_number !== newDay) {
      const upRes = await supabase
        .from('checkin_logs')
        .update({ cycle_id: cycle.id, day_number: newDay })
        .eq('id', log.id);
      if (upRes.error) throw upRes.error;
    }
  }

  const currentCycle = getCurrentCycleForDate(allCyclesNow);
  const activeCycle =
    allCyclesNow.find((c) => !c.end_date) || allCyclesNow[allCyclesNow.length - 1];
  const deviceStart = currentCycle?.start_date || activeCycle?.start_date;
  if (deviceStart) {
    await supabase
      .from('devices')
      .update({ checkin_start_date: deviceStart })
      .eq('id', deviceId);
  }
}
