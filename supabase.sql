create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  monthly_salary numeric(12,2) default 0,
  salary_date integer default 1 check (salary_date between 1 and 31),
  currency text default 'RM',
  private_vault_pin text default '',
  dark_mode boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null default 0,
  due_date integer not null check (due_date between 1 and 31),
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.commitment_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  commitment_id uuid not null references public.commitments(id) on delete cascade,
  month text not null,
  is_paid boolean default false,
  paid_at timestamptz,
  unique (user_id, commitment_id, month)
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null default 0,
  current_amount numeric(12,2) not null default 0,
  is_private boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  savings_goal_id uuid not null references public.savings_goals(id) on delete cascade,
  type text not null check (type in ('deposit', 'withdraw')),
  amount numeric(12,2) not null default 0,
  notes text default '',
  created_at timestamptz default now()
);

create table if not exists public.monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  salary numeric(12,2) not null default 0,
  total_commitments numeric(12,2) not null default 0,
  total_savings numeric(12,2) not null default 0,
  balance numeric(12,2) not null default 0,
  commitment_breakdown jsonb not null default '[]'::jsonb,
  savings_breakdown jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  unique (user_id, month)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists commitments_set_updated_at on public.commitments;
create trigger commitments_set_updated_at before update on public.commitments
for each row execute function public.set_updated_at();

drop trigger if exists savings_goals_set_updated_at on public.savings_goals;
create trigger savings_goals_set_updated_at before update on public.savings_goals
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.commitments enable row level security;
alter table public.commitment_payments enable row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_transactions enable row level security;
alter table public.monthly_snapshots enable row level security;

drop policy if exists "profiles own select" on public.profiles;
create policy "profiles own select" on public.profiles for select using (id = auth.uid());
drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert" on public.profiles for insert with check (id = auth.uid());
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "profiles own delete" on public.profiles;
create policy "profiles own delete" on public.profiles for delete using (id = auth.uid());

drop policy if exists "commitments own select" on public.commitments;
create policy "commitments own select" on public.commitments for select using (user_id = auth.uid());
drop policy if exists "commitments own insert" on public.commitments;
create policy "commitments own insert" on public.commitments for insert with check (user_id = auth.uid());
drop policy if exists "commitments own update" on public.commitments;
create policy "commitments own update" on public.commitments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "commitments own delete" on public.commitments;
create policy "commitments own delete" on public.commitments for delete using (user_id = auth.uid());

drop policy if exists "payments own select" on public.commitment_payments;
create policy "payments own select" on public.commitment_payments for select using (user_id = auth.uid());
drop policy if exists "payments own insert" on public.commitment_payments;
create policy "payments own insert" on public.commitment_payments for insert with check (user_id = auth.uid());
drop policy if exists "payments own update" on public.commitment_payments;
create policy "payments own update" on public.commitment_payments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "payments own delete" on public.commitment_payments;
create policy "payments own delete" on public.commitment_payments for delete using (user_id = auth.uid());

drop policy if exists "goals own select" on public.savings_goals;
create policy "goals own select" on public.savings_goals for select using (user_id = auth.uid());
drop policy if exists "goals own insert" on public.savings_goals;
create policy "goals own insert" on public.savings_goals for insert with check (user_id = auth.uid());
drop policy if exists "goals own update" on public.savings_goals;
create policy "goals own update" on public.savings_goals for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "goals own delete" on public.savings_goals;
create policy "goals own delete" on public.savings_goals for delete using (user_id = auth.uid());

drop policy if exists "transactions own select" on public.savings_transactions;
create policy "transactions own select" on public.savings_transactions for select using (user_id = auth.uid());
drop policy if exists "transactions own insert" on public.savings_transactions;
create policy "transactions own insert" on public.savings_transactions for insert with check (user_id = auth.uid());
drop policy if exists "transactions own update" on public.savings_transactions;
create policy "transactions own update" on public.savings_transactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "transactions own delete" on public.savings_transactions;
create policy "transactions own delete" on public.savings_transactions for delete using (user_id = auth.uid());

drop policy if exists "snapshots own select" on public.monthly_snapshots;
create policy "snapshots own select" on public.monthly_snapshots for select using (user_id = auth.uid());
drop policy if exists "snapshots own insert" on public.monthly_snapshots;
create policy "snapshots own insert" on public.monthly_snapshots for insert with check (user_id = auth.uid());
drop policy if exists "snapshots own update" on public.monthly_snapshots;
create policy "snapshots own update" on public.monthly_snapshots for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "snapshots own delete" on public.monthly_snapshots;
create policy "snapshots own delete" on public.monthly_snapshots for delete using (user_id = auth.uid());


