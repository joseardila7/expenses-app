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

create table if not exists public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  group_name_snapshot text not null,
  invited_email text not null,
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by_name_snapshot text,
  token text not null unique,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users(id) on delete set null,
  accepted_name_snapshot text,
  revoked_at timestamptz
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  user_id uuid references auth.users(id) on delete set null,
  contact_email text,
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
alter table public.group_invitations add column if not exists status text not null default 'pending';
alter table public.group_invitations add column if not exists created_at timestamptz not null default now();
alter table public.group_invitations add column if not exists accepted_at timestamptz;
alter table public.group_invitations add column if not exists accepted_user_id uuid references auth.users(id) on delete set null;
alter table public.group_invitations add column if not exists accepted_name_snapshot text;
alter table public.group_invitations add column if not exists revoked_at timestamptz;
alter table public.group_invitations add column if not exists group_name_snapshot text;
alter table public.group_invitations add column if not exists invited_by_name_snapshot text;
alter table public.participants add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.participants add column if not exists contact_email text;

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

  if not exists (
    select 1
    from pg_constraint
    where conname = 'group_invitations_status_check'
  ) then
    alter table public.group_invitations
      add constraint group_invitations_status_check
      check (status in ('pending', 'accepted', 'revoked'));
  end if;
end
$$;

create index if not exists groups_owner_user_id_idx on public.groups(owner_user_id);
create index if not exists group_members_user_id_idx on public.group_members(user_id);
create index if not exists group_invitations_group_id_idx on public.group_invitations(group_id);
create index if not exists group_invitations_email_idx on public.group_invitations(lower(invited_email));
create unique index if not exists group_invitations_pending_unique_idx
on public.group_invitations(group_id, lower(invited_email))
where status = 'pending';
create index if not exists participants_group_id_idx on public.participants(group_id);
create index if not exists participants_user_id_idx on public.participants(user_id);
create unique index if not exists participants_group_user_unique_idx
on public.participants(group_id, user_id)
where user_id is not null;
create index if not exists expenses_group_id_idx on public.expenses(group_id);
create index if not exists expenses_paid_by_idx on public.expenses(paid_by_participant_id);
create index if not exists expense_shares_expense_id_idx on public.expense_shares(expense_id);
create index if not exists payments_group_id_idx on public.payments(group_id);
