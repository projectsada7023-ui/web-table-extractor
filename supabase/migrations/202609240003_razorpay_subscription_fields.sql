alter table public.profiles
  add column if not exists razorpay_subscription_id text,
  add column if not exists plan_status text not null default 'active',
  add column if not exists plan_current_period_end timestamptz;

create unique index if not exists profiles_razorpay_subscription_id_idx
on public.profiles (razorpay_subscription_id)
where razorpay_subscription_id is not null;

revoke update on public.profiles from authenticated;


alter table public.profiles
  add column if not exists full_name text,
  add column if not exists age integer,
  add column if not exists plan_started_at timestamptz,
  add column if not exists plan_amount integer;

drop policy if exists "Users can update own profile details" on public.profiles;
create policy "Users can update own profile details"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke update on public.profiles from authenticated;
grant update (full_name, age) on public.profiles to authenticated;
