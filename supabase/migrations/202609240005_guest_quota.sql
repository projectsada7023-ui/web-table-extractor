create table if not exists public.guest_extraction_usage (
  guest_id uuid primary key,
  usage_date date not null default current_date,
  extraction_count integer not null default 0 check (extraction_count >= 0 and extraction_count <= 3),
  updated_at timestamptz not null default now()
);

alter table public.guest_extraction_usage enable row level security;

create or replace function public.consume_guest_extraction(p_guest_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.guest_extraction_usage (guest_id, usage_date, extraction_count, updated_at)
  values (p_guest_id, current_date, 1, now())
  on conflict (guest_id) do update
    set
      usage_date = case
        when public.guest_extraction_usage.usage_date = current_date
          then public.guest_extraction_usage.usage_date
        else current_date
      end,
      extraction_count = case
        when public.guest_extraction_usage.usage_date = current_date
          then public.guest_extraction_usage.extraction_count + 1
        else 1
      end,
      updated_at = now()
    where public.guest_extraction_usage.usage_date <> current_date
       or public.guest_extraction_usage.extraction_count < 3
  returning extraction_count into new_count;

  if new_count is null then
    raise exception 'Guest daily limit reached';
  end if;

  return new_count;
end;
$$;

revoke all on function public.consume_guest_extraction(uuid) from public;
grant execute on function public.consume_guest_extraction(uuid) to anon, authenticated;
