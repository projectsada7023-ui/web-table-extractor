alter table public.profiles
  add column if not exists razorpay_subscription_id text,
  add column if not exists plan_status text not null default 'active',
  add column if not exists plan_current_period_end timestamptz;

create unique index if not exists profiles_razorpay_subscription_id_idx
on public.profiles (razorpay_subscription_id)
where razorpay_subscription_id is not null;

revoke update on public.profiles from authenticated;
