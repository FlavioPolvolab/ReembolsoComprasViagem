-- Reforça RLS e políticas para trips, trip_expenses e trip_receipts

-- Garante RLS habilitado
alter table if exists public.trips enable row level security;
alter table if exists public.trip_expenses enable row level security;
alter table if exists public.trip_receipts enable row level security;

-- trips SELECT/INSERT/UPDATE/DELETE
do $$ begin
  drop policy if exists trips_select_policy on public.trips;
  create policy trips_select_policy on public.trips
  for select using ( user_id = auth.uid() or user_has_role(auth.uid(), 'admin') );
exception when others then null; end $$;

do $$ begin
  drop policy if exists trips_insert_policy on public.trips;
  create policy trips_insert_policy on public.trips
  for insert with check ( user_id = auth.uid() or user_has_role(auth.uid(), 'admin') );
exception when others then null; end $$;

do $$ begin
  drop policy if exists trips_update_policy on public.trips;
  create policy trips_update_policy on public.trips
  for update using ( user_id = auth.uid() or user_has_role(auth.uid(), 'admin') )
            with check ( user_id = auth.uid() or user_has_role(auth.uid(), 'admin') );
exception when others then null; end $$;

do $$ begin
  drop policy if exists trips_delete_policy on public.trips;
  create policy trips_delete_policy on public.trips
  for delete using ( user_id = auth.uid() or user_has_role(auth.uid(), 'admin') );
exception when others then null; end $$;

-- trip_expenses SELECT/INSERT/UPDATE/DELETE baseadas no dono da trip
do $$ begin
  drop policy if exists trip_expenses_select_policy on public.trip_expenses;
  create policy trip_expenses_select_policy on public.trip_expenses
  for select using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and (t.user_id = auth.uid() or user_has_role(auth.uid(), 'admin'))
    )
  );
exception when others then null; end $$;

do $$ begin
  drop policy if exists trip_expenses_insert_policy on public.trip_expenses;
  create policy trip_expenses_insert_policy on public.trip_expenses
  for insert with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and (t.user_id = auth.uid() or user_has_role(auth.uid(), 'admin'))
    )
  );
exception when others then null; end $$;

do $$ begin
  drop policy if exists trip_expenses_update_policy on public.trip_expenses;
  create policy trip_expenses_update_policy on public.trip_expenses
  for update using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and (t.user_id = auth.uid() or user_has_role(auth.uid(), 'admin'))
    )
  ) with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and (t.user_id = auth.uid() or user_has_role(auth.uid(), 'admin'))
    )
  );
exception when others then null; end $$;

do $$ begin
  drop policy if exists trip_expenses_delete_policy on public.trip_expenses;
  create policy trip_expenses_delete_policy on public.trip_expenses
  for delete using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and (t.user_id = auth.uid() or user_has_role(auth.uid(), 'admin'))
    )
  );
exception when others then null; end $$;

-- trip_receipts SELECT/INSERT/DELETE baseadas na trip via expense
do $$ begin
  drop policy if exists trip_receipts_select_policy on public.trip_receipts;
  create policy trip_receipts_select_policy on public.trip_receipts
  for select using (
    exists (
      select 1 from public.trip_expenses te
      join public.trips t on t.id = te.trip_id
      where te.id = trip_expense_id and (t.user_id = auth.uid() or user_has_role(auth.uid(), 'admin'))
    )
  );
exception when others then null; end $$;

do $$ begin
  drop policy if exists trip_receipts_insert_policy on public.trip_receipts;
  create policy trip_receipts_insert_policy on public.trip_receipts
  for insert with check (
    exists (
      select 1 from public.trip_expenses te
      join public.trips t on t.id = te.trip_id
      where te.id = trip_expense_id and (t.user_id = auth.uid() or user_has_role(auth.uid(), 'admin'))
    )
  );
exception when others then null; end $$;

do $$ begin
  drop policy if exists trip_receipts_delete_policy on public.trip_receipts;
  create policy trip_receipts_delete_policy on public.trip_receipts
  for delete using (
    exists (
      select 1 from public.trip_expenses te
      join public.trips t on t.id = te.trip_id
      where te.id = trip_expense_id and (t.user_id = auth.uid() or user_has_role(auth.uid(), 'admin'))
    )
  );
exception when others then null; end $$;


