-- Permitir que aprovadores (e admins/donos) visualizem comprovantes das viagens

alter table if exists public.trip_receipts enable row level security;

do $$ begin
  drop policy if exists trip_receipts_select_policy on public.trip_receipts;
  create policy trip_receipts_select_policy on public.trip_receipts
  for select using (
    exists (
      select 1 from public.trip_expenses te
      join public.trips t on t.id = te.trip_id
      where te.id = trip_expense_id and (
        t.user_id = auth.uid() or 
        user_has_role(auth.uid(), 'admin') or 
        user_has_role(auth.uid(), 'approver')
      )
    )
  );
exception when others then null; end $$;


