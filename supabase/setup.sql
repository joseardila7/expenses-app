alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invitations enable row level security;
alter table public.participants enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.payments enable row level security;
alter table public.profiles force row level security;
alter table public.groups force row level security;
alter table public.group_members force row level security;
alter table public.group_invitations force row level security;
alter table public.participants force row level security;
alter table public.expenses force row level security;
alter table public.expense_shares force row level security;
alter table public.payments force row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1), 'Usuario')
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = excluded.display_name;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target_group_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups
    where id = target_group_id
      and owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups
    where id = target_group_id
      and owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.group_members
    where group_id = target_group_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

create or replace function public.invitation_matches_user(target_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = lower(target_email);
$$;

create or replace function public.can_join_group_via_invitation(target_group_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_user_id = auth.uid()
    and exists (
      select 1
      from public.group_invitations
      where group_id = target_group_id
        and status = 'pending'
        and lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and invited_by_user_id <> auth.uid()
    );
$$;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles',
        'groups',
        'group_members',
        'group_invitations',
        'participants',
        'expenses',
        'expense_shares',
        'payments'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$$;

create policy "users read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "users insert own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "users update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "members read groups"
on public.groups
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or public.is_group_member(id)
);

create policy "owners insert groups"
on public.groups
for insert
to authenticated
with check (owner_user_id = auth.uid());

create policy "owners update groups"
on public.groups
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "owners delete groups"
on public.groups
for delete
to authenticated
using (owner_user_id = auth.uid());

create policy "members read group members"
on public.group_members
for select
to authenticated
using (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
);

create policy "owners insert group members"
on public.group_members
for insert
to authenticated
with check (
  public.is_group_admin(group_id)
  or (
    user_id = auth.uid()
    and public.can_join_group_via_invitation(group_id, user_id)
  )
);

create policy "owners update group members"
on public.group_members
for update
to authenticated
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

create policy "owners delete group members"
on public.group_members
for delete
to authenticated
using (public.is_group_admin(group_id));

create policy "owners and invitees read invitations"
on public.group_invitations
for select
to authenticated
using (
  public.is_group_admin(group_id)
  or public.invitation_matches_user(invited_email)
);

create policy "owners insert invitations"
on public.group_invitations
for insert
to authenticated
with check (
  public.is_group_admin(group_id)
  and invited_by_user_id = auth.uid()
);

create policy "owners and invitees update invitations"
on public.group_invitations
for update
to authenticated
using (
  public.is_group_admin(group_id)
  or public.invitation_matches_user(invited_email)
)
with check (
  public.is_group_admin(group_id)
  or public.invitation_matches_user(invited_email)
);

create policy "owners delete invitations"
on public.group_invitations
for delete
to authenticated
using (public.is_group_admin(group_id));

create policy "members read participants"
on public.participants
for select
to authenticated
using (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
);

create policy "members insert participants"
on public.participants
for insert
to authenticated
with check (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
);

create policy "members update participants"
on public.participants
for update
to authenticated
using (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
)
with check (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
);

create policy "members delete participants"
on public.participants
for delete
to authenticated
using (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
);

create policy "members read expenses"
on public.expenses
for select
to authenticated
using (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
);

create policy "members insert expenses"
on public.expenses
for insert
to authenticated
with check (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
);

create policy "members update expenses"
on public.expenses
for update
to authenticated
using (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
)
with check (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
);

create policy "members delete expenses"
on public.expenses
for delete
to authenticated
using (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
);

create policy "members read expense shares"
on public.expense_shares
for select
to authenticated
using (
  exists (
    select 1
    from public.expenses
    where expenses.id = expense_shares.expense_id
      and (
        public.is_group_member(expenses.group_id)
        or public.is_group_owner(expenses.group_id)
      )
  )
);

create policy "members insert expense shares"
on public.expense_shares
for insert
to authenticated
with check (
  exists (
    select 1
    from public.expenses
    where expenses.id = expense_shares.expense_id
      and (
        public.is_group_member(expenses.group_id)
        or public.is_group_owner(expenses.group_id)
      )
  )
);

create policy "members delete expense shares"
on public.expense_shares
for delete
to authenticated
using (
  exists (
    select 1
    from public.expenses
    where expenses.id = expense_shares.expense_id
      and (
        public.is_group_member(expenses.group_id)
        or public.is_group_owner(expenses.group_id)
      )
  )
);

create policy "members read payments"
on public.payments
for select
to authenticated
using (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
);

create policy "members insert payments"
on public.payments
for insert
to authenticated
with check (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
);

create policy "members update payments"
on public.payments
for update
to authenticated
using (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
)
with check (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
);

create policy "members delete payments"
on public.payments
for delete
to authenticated
using (
  public.is_group_member(group_id)
  or public.is_group_owner(group_id)
);
