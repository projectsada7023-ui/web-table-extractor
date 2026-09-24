-- Production-safe daily extraction quota.
-- Run this once in the Supabase SQL Editor.

create or replace function public.record_extraction_usage(
  p_source_url text,
  p_table_count integer
)
returns table (
  used_today integer,
  remaining_today integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_start_of_day timestamptz;
  v_used_today integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Serialize quota checks per user so concurrent requests cannot both
  -- observe the same remaining slot.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  -- The product day is based on India Standard Time.
  v_start_of_day := (
    timezone('Asia/Kolkata', now())::date
    at time zone 'Asia/Kolkata'
  );

  select count(*)::integer
    into v_used_today
  from public.extraction_usage
  where user_id = v_user_id
    and status = 'success'
    and created_at >= v_start_of_day;

  if v_used_today >= 3 then
    raise exception 'daily_limit_reached';
  end if;

  insert into public.extraction_usage (
    user_id,
    source_url,
    table_count,
    status
  )
  values (
    v_user_id,
    p_source_url,
    p_table_count,
    'success'
  );

  return query
  select
    v_used_today + 1,
    greatest(3 - (v_used_today + 1), 0);
end;
$$;

revoke all on function public.record_extraction_usage(text, integer) from public;
grant execute on function public.record_extraction_usage(text, integer) to authenticated;
