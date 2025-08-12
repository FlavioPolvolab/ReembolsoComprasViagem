-- Políticas RLS com USING enxuto para evitar planos ruins e timeouts

-- Example: expenses select policy (se já existir, reescreva semelhante)
do $$ begin
  drop policy if exists expenses_select_policy on public.expenses;
  create policy expenses_select_policy on public.expenses
  for select using (
    user_id = auth.uid() or user_has_role(auth.uid(), 'admin')
  );
exception when others then null; end $$;

do $$ begin
  drop policy if exists purchase_orders_select_policy on public.purchase_orders;
  create policy purchase_orders_select_policy on public.purchase_orders
  for select using (
    user_id = auth.uid() or user_has_role(auth.uid(), 'admin')
  );
exception when others then null; end $$;

do $$ begin
  drop policy if exists trips_select_policy on public.trips;
  create policy trips_select_policy on public.trips
  for select using (
    user_id = auth.uid() or user_has_role(auth.uid(), 'admin')
  );
exception when others then null; end $$;


