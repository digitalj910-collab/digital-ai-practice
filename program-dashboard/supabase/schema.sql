-- Program Dashboard — database schema for Supabase.
-- Paste this whole file into the Supabase SQL Editor and click Run.

create table if not exists domains (
  id text primary key,
  name text not null,
  manager_name text,
  color text,
  description text
);

create table if not exists programs (
  id text primary key,
  domain_id text references domains(id) on delete cascade,
  name text not null,
  description text,
  owner text,
  status text,
  rag_status text,
  start_date date,
  end_date date,
  percent_complete int,
  priority text,
  deprioritized boolean default false,
  deprioritized_reason text,
  deprioritized_date date,
  planned_resources int,
  current_resources int,
  source text,
  external_id text,
  last_synced_at timestamptz
);

create table if not exists tasks (
  id text primary key,
  program_id text references programs(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  percent_complete int,
  assignee text,
  milestone boolean default false,
  predecessor_ids text[] default '{}',
  source text,
  external_id text
);

create table if not exists updates_log (
  id text primary key,
  program_id text references programs(id) on delete cascade,
  date date,
  author text,
  note text,
  created_at timestamptz default now()
);

-- Audit trail: one row per program status change, with a mandatory reason.
create table if not exists status_changes (
  id text primary key,
  program_id text references programs(id) on delete cascade,
  date date,
  author text,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz default now()
);

-- Discussion thread on an update — leadership and managers reply to each other.
create table if not exists update_comments (
  id text primary key,
  update_id text references updates_log(id) on delete cascade,
  author text,
  role text,
  text text not null,
  date timestamptz,
  created_at timestamptz default now()
);

-- Edit history on an update — preserves what changed and who changed it, so the
-- manager's original wording is never silently overwritten by a leadership edit.
create table if not exists update_edits (
  id text primary key,
  update_id text references updates_log(id) on delete cascade,
  editor text,
  editor_role text,
  date timestamptz,
  changes jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- TEMPORARY open access so the app works before we add logins.
-- Sample data only. Replaced with real per-user rules once SSO is added.
alter table domains enable row level security;
alter table programs enable row level security;
alter table tasks enable row level security;
alter table updates_log enable row level security;
alter table status_changes enable row level security;
alter table update_comments enable row level security;
alter table update_edits enable row level security;

drop policy if exists "anon all" on domains;
drop policy if exists "anon all" on programs;
drop policy if exists "anon all" on tasks;
drop policy if exists "anon all" on updates_log;
drop policy if exists "anon all" on status_changes;
drop policy if exists "anon all" on update_comments;
drop policy if exists "anon all" on update_edits;

create policy "anon all" on domains for all to anon using (true) with check (true);
create policy "anon all" on programs for all to anon using (true) with check (true);
create policy "anon all" on tasks for all to anon using (true) with check (true);
create policy "anon all" on updates_log for all to anon using (true) with check (true);
create policy "anon all" on status_changes for all to anon using (true) with check (true);
create policy "anon all" on update_comments for all to anon using (true) with check (true);
create policy "anon all" on update_edits for all to anon using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
