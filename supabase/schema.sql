create extension if not exists "pgcrypto";

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  deleted_at timestamptz
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null check (amount > 0),
  paid_by_participant_id uuid references public.participants(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_shares (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  primary key (expense_id, participant_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_participant_id uuid not null references public.participants(id) on delete restrict,
  to_participant_id uuid not null references public.participants(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists participants_group_id_idx on public.participants(group_id);
create index if not exists expenses_group_id_idx on public.expenses(group_id);
create index if not exists expenses_paid_by_idx on public.expenses(paid_by_participant_id);
create index if not exists expense_shares_expense_id_idx on public.expense_shares(expense_id);
create index if not exists payments_group_id_idx on public.payments(group_id);
