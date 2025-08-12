-- Índices e ajustes de chaves estrangeiras para melhorar desempenho e evitar timeouts

-- Expenses
create index if not exists idx_expenses_user_status_date on public.expenses (user_id, status, submitted_date desc);
create index if not exists idx_expenses_payment_status on public.expenses (payment_status);
create index if not exists idx_receipts_expense on public.receipts (expense_id);

-- Purchase Orders
create index if not exists idx_po_user_status_date on public.purchase_orders (user_id, status, submitted_date desc);
create index if not exists idx_po_is_paid on public.purchase_orders (is_paid);
create index if not exists idx_po_items_order on public.purchase_order_items (purchase_order_id);
create index if not exists idx_po_receipts_order on public.purchase_order_receipts (purchase_order_id);

-- Trips
create index if not exists idx_trips_user_status_date on public.trips (user_id, status, created_at desc);
create index if not exists idx_trips_cost_center on public.trips (cost_center_id);
create index if not exists idx_trip_expenses_trip on public.trip_expenses (trip_id);
create index if not exists idx_trip_receipts_expense on public.trip_receipts (trip_expense_id);

-- Roles helper
create index if not exists idx_user_roles_user_role on public.user_roles (user_id, role);

-- Opcional: garantir ON DELETE CASCADE onde faz sentido para reduzir operações múltiplas no app
do $$
begin
  -- purchase_order_items -> purchase_orders
  if exists (
    select 1 from information_schema.constraint_column_usage c
    where c.constraint_name = 'purchase_order_items_purchase_order_id_fkey'
  ) then
    alter table public.purchase_order_items
      drop constraint if exists purchase_order_items_purchase_order_id_fkey,
      add constraint purchase_order_items_purchase_order_id_fkey
        foreign key (purchase_order_id) references public.purchase_orders(id) on delete cascade;
  end if;

  -- purchase_order_receipts -> purchase_orders
  if exists (
    select 1 from information_schema.constraint_column_usage c
    where c.constraint_name = 'purchase_order_receipts_purchase_order_id_fkey'
  ) then
    alter table public.purchase_order_receipts
      drop constraint if exists purchase_order_receipts_purchase_order_id_fkey,
      add constraint purchase_order_receipts_purchase_order_id_fkey
        foreign key (purchase_order_id) references public.purchase_orders(id) on delete cascade;
  end if;

  -- receipts -> expenses
  if exists (
    select 1 from information_schema.constraint_column_usage c
    where c.constraint_name = 'receipts_expense_id_fkey'
  ) then
    alter table public.receipts
      drop constraint if exists receipts_expense_id_fkey,
      add constraint receipts_expense_id_fkey
        foreign key (expense_id) references public.expenses(id) on delete cascade;
  end if;
end $$;


