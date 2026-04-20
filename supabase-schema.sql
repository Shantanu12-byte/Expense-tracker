-- ============================================================
-- SpendSmart Expense Tracker - Supabase SQL Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  currency text not null default 'INR',
  monthly_budget numeric,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. CATEGORIES TABLE
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  icon text not null default '📦',
  color text not null default '#94a3b8',
  is_default boolean default false,
  created_at timestamptz default now()
);

alter table public.categories enable row level security;

create policy "Users can manage own categories"
  on public.categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. EXPENSES TABLE
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric not null check (amount > 0),
  note text,
  date date not null,
  payment_method text default 'UPI',
  created_at timestamptz default now()
);

alter table public.expenses enable row level security;

create policy "Users can manage own expenses"
  on public.expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for faster date queries
create index if not exists expenses_user_date_idx on public.expenses(user_id, date desc);
create index if not exists expenses_category_idx on public.expenses(category_id);

-- 4. RECURRING EXPENSES TABLE
create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric not null check (amount > 0),
  note text,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  next_due_date date not null,
  created_at timestamptz default now()
);

alter table public.recurring_expenses enable row level security;

create policy "Users can manage own recurring expenses"
  on public.recurring_expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Enable Realtime for expenses table
-- ============================================================
-- Run this in SQL editor or enable via Supabase Dashboard > Database > Replication
alter publication supabase_realtime add table public.expenses;
