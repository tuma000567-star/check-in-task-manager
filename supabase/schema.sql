-- 端末マスタ
create table devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_method text not null,
  parent_id uuid references devices(id) on delete set null,
  birth_date date not null default current_date,
  checkin_start_date date not null default current_date,
  current_checkin_day integer not null default 1,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz default now()
);

-- チェックインログ
create table checkin_logs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  log_date date not null default current_date,
  status text not null check (status in ('success', 'error')),
  day_number integer not null,
  created_at timestamptz default now()
);

-- 日次タスク
create table daily_tasks (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  task_date date not null default current_date,
  video_180min boolean default false,
  get_button boolean default false,
  receive_button boolean default false,
  ad_watch boolean default false,
  created_at timestamptz default now(),
  unique(device_id, task_date)
);

-- 招待イベント
create table invitations (
  id uuid primary key default gen_random_uuid(),
  parent_device_id uuid not null references devices(id) on delete cascade,
  child_device_id uuid references devices(id) on delete set null,
  event_name text not null,
  invitation_date date not null default current_date,
  result text not null default 'pending' check (result in ('pending', 'success', 'failure')),
  child_checkin_day_at_invitation integer,
  days_since_birth_at_invitation integer,
  notes text,
  created_at timestamptz default now()
);

-- RLS有効化
alter table devices enable row level security;
alter table checkin_logs enable row level security;
alter table daily_tasks enable row level security;
alter table invitations enable row level security;

-- 全員読み書き可能（共有運用のため）
create policy "allow all" on devices for all to anon, authenticated using (true) with check (true);
create policy "allow all" on checkin_logs for all to anon, authenticated using (true) with check (true);
create policy "allow all" on daily_tasks for all to anon, authenticated using (true) with check (true);
create policy "allow all" on invitations for all to anon, authenticated using (true) with check (true);
