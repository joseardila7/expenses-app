create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
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

alter table public.groups add column if not exists owner_user_id uuid references auth.users(id) on delete set null;
alter table public.group_members add column if not exists role text not null default 'member';
alter table public.group_members add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'group_members_role_check'
  ) then
    alter table public.group_members
      add constraint group_members_role_check
      check (role in ('owner', 'member'));
  end if;
end
$$;

create index if not exists groups_owner_user_id_idx on public.groups(owner_user_id);
create index if not exists group_members_user_id_idx on public.group_members(user_id);
create index if not exists participants_group_id_idx on public.participants(group_id);
create index if not exists expenses_group_id_idx on public.expenses(group_id);
create index if not exists expenses_paid_by_idx on public.expenses(paid_by_participant_id);
create index if not exists expense_shares_expense_id_idx on public.expense_shares(expense_id);
create index if not exists payments_group_id_idx on public.payments(group_id);
