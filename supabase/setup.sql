alter table public.groups enable row level security;
alter table public.participants enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.payments enable row level security;

drop policy if exists "public read groups" on public.groups;
drop policy if exists "public insert groups" on public.groups;
drop policy if exists "public delete groups" on public.groups;
drop policy if exists "public read participants" on public.participants;
drop policy if exists "public insert participants" on public.participants;
drop policy if exists "public delete participants" on public.participants;
drop policy if exists "public update participants" on public.participants;
drop policy if exists "public read expenses" on public.expenses;
drop policy if exists "public insert expenses" on public.expenses;
drop policy if exists "public read expense shares" on public.expense_shares;
drop policy if exists "public insert expense shares" on public.expense_shares;
drop policy if exists "public read payments" on public.payments;
drop policy if exists "public insert payments" on public.payments;

create policy "public read groups"
on public.groups
for select
to anon, authenticated
using (true);

create policy "public insert groups"
on public.groups
for insert
to anon, authenticated
with check (true);

create policy "public delete groups"
on public.groups
for delete
to anon, authenticated
using (true);

create policy "public read participants"
on public.participants
for select
to anon, authenticated
using (true);

create policy "public insert participants"
on public.participants
for insert
to anon, authenticated
with check (true);

create policy "public update participants"
on public.participants
for update
to anon, authenticated
using (true)
with check (true);

create policy "public delete participants"
on public.participants
for delete
to anon, authenticated
using (true);

create policy "public read expenses"
on public.expenses
for select
to anon, authenticated
using (true);

create policy "public insert expenses"
on public.expenses
for insert
to anon, authenticated
with check (true);

create policy "public read expense shares"
on public.expense_shares
for select
to anon, authenticated
using (true);

create policy "public insert expense shares"
on public.expense_shares
for insert
to anon, authenticated
with check (true);

create policy "public read payments"
on public.payments
for select
to anon, authenticated
using (true);

create policy "public insert payments"
on public.payments
for insert
to anon, authenticated
with check (true);
