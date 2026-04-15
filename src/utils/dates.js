export function toDateOnly(d) {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  return date;
}

export function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysBetween(from, to) {
  const a = toDateOnly(from);
  const b = toDateOnly(to);
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

export function formatDateJa(d) {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const day = date.getDate();
  const wk = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  return `${y}年${m}月${day}日(${wk})`;
}

export function addDaysIso(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
