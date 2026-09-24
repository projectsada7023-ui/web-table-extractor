create table if not exists public.extraction_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  table_index integer not null default 0 check (table_index >= 0),
  cadence text not null check (cadence in ('daily', 'weekly')),
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_error text
);

alter table public.extraction_schedules enable row level security;

drop policy if exists "Users can view own extraction schedules" on public.extraction_schedules;
create policy "Users can view own extraction schedules"
on public.extraction_schedules
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own extraction schedules" on public.extraction_schedules;
create policy "Users can create own extraction schedules"
on public.extraction_schedules
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own extraction schedules" on public.extraction_schedules;
create policy "Users can update own extraction schedules"
on public.extraction_schedules
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own extraction schedules" on public.extraction_schedules;
create policy "Users can delete own extraction schedules"
on public.extraction_schedules
for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists extraction_schedules_active_idx
on public.extraction_schedules (active, cadence, created_at);
