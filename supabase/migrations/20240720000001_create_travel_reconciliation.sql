-- Conciliação de Viagens: tabelas, funções, triggers e RLS

-- Enum de status das viagens
do $$ begin
  create type trip_status as enum ('open', 'closed');
exception when duplicate_object then null; end $$;

-- Tabela de viagens
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  start_date date,
  end_date date,
  budget_amount numeric(12,2) not null default 0,
  spent_amount numeric(12,2) not null default 0,
  status trip_status not null default 'open',
  closed_by uuid references public.users(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela de despesas da viagem
create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null,
  expense_date date,
  category text,
  reconciled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela de recibos das despesas
create table if not exists public.trip_receipts (
  id uuid primary key default gen_random_uuid(),
  trip_expense_id uuid not null references public.trip_expenses(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size bigint not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- Atualiza updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_trips_set_updated_at on public.trips;
create trigger trg_trips_set_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

drop trigger if exists trg_trip_expenses_set_updated_at on public.trip_expenses;
create trigger trg_trip_expenses_set_updated_at
before update on public.trip_expenses
for each row execute function public.set_updated_at();

-- Trigger para manter spent_amount em trips
create or replace function public.update_trip_spent_amount()
returns trigger as $$
declare v_trip uuid; begin
  v_trip := coalesce(new.trip_id, old.trip_id);
  update public.trips t
  set spent_amount = (
    select coalesce(sum(te.amount), 0)
    from public.trip_expenses te
    where te.trip_id = v_trip
  ), updated_at = now()
  where t.id = v_trip;
  return coalesce(new, old);
end; $$ language plpgsql;

drop trigger if exists trg_update_trip_spent_amount on public.trip_expenses;
create trigger trg_update_trip_spent_amount
after insert or update or delete on public.trip_expenses
for each row execute function public.update_trip_spent_amount();

-- RPC para fechar viagem, exige papel approver ou admin
create or replace function public.close_trip(trip_id uuid, closer_id uuid)
returns boolean as $$
declare can_close boolean; begin
  select user_has_role(closer_id, 'approver') into can_close;
  if not can_close then
    raise exception 'User does not have permission to close trips';
  end if;

  update public.trips
  set status = 'closed', closed_by = closer_id, closed_at = now(), updated_at = now()
  where id = trip_id and status = 'open';
  return found;
end; $$ language plpgsql security definer;

-- RLS
alter table public.trips enable row level security;
alter table public.trip_expenses enable row level security;
alter table public.trip_receipts enable row level security;

-- trips policies
drop policy if exists trips_select_policy on public.trips;
create policy trips_select_policy on public.trips
for select using (
  user_has_role(auth.uid(), 'admin') or user_id = auth.uid()
);

drop policy if exists trips_insert_policy on public.trips;
create policy trips_insert_policy on public.trips
for insert with check (
  user_id = auth.uid() or user_has_role(auth.uid(), 'admin')
);

drop policy if exists trips_update_policy on public.trips;
create policy trips_update_policy on public.trips
for update using (
  user_has_role(auth.uid(), 'admin') or user_id = auth.uid()
) with check (
  user_has_role(auth.uid(), 'admin') or user_id = auth.uid()
);

drop policy if exists trips_delete_policy on public.trips;
create policy trips_delete_policy on public.trips
for delete using (
  user_has_role(auth.uid(), 'admin') or user_id = auth.uid()
);

-- trip_expenses policies (baseadas no dono da trip)
drop policy if exists trip_expenses_select_policy on public.trip_expenses;
create policy trip_expenses_select_policy on public.trip_expenses
for select using (
  exists (
    select 1 from public.trips t
    where t.id = trip_id and (t.user_id = auth.uid() or user_has_role(auth.uid(), 'admin'))
  )
);

drop policy if exists trip_expenses_insert_policy on public.trip_expenses;
create policy trip_expenses_insert_policy on public.trip_expenses
for insert with check (
  exists (
    select 1 from public.trips t
    where t.id = trip_id and (t.user_id = auth.uid() or user_has_role(auth.uid(), 'admin'))
  )
);

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

drop policy if exists trip_expenses_delete_policy on public.trip_expenses;
create policy trip_expenses_delete_policy on public.trip_expenses
for delete using (
  exists (
    select 1 from public.trips t
    where t.id = trip_id and (t.user_id = auth.uid() or user_has_role(auth.uid(), 'admin'))
  )
);

-- trip_receipts policies (baseadas na trip via expense)
drop policy if exists trip_receipts_select_policy on public.trip_receipts;
create policy trip_receipts_select_policy on public.trip_receipts
for select using (
  exists (
    select 1 from public.trip_expenses te
    join public.trips t on t.id = te.trip_id
    where te.id = trip_expense_id and (t.user_id = auth.uid() or user_has_role(auth.uid(), 'admin'))
  )
);

drop policy if exists trip_receipts_insert_policy on public.trip_receipts;
create policy trip_receipts_insert_policy on public.trip_receipts
for insert with check (
  exists (
    select 1 from public.trip_expenses te
    join public.trips t on t.id = te.trip_id
    where te.id = trip_expense_id and (t.user_id = auth.uid() or user_has_role(auth.uid(), 'admin'))
  )
);

drop policy if exists trip_receipts_delete_policy on public.trip_receipts;
create policy trip_receipts_delete_policy on public.trip_receipts
for delete using (
  exists (
    select 1 from public.trip_expenses te
    join public.trips t on t.id = te.trip_id
    where te.id = trip_expense_id and (t.user_id = auth.uid() or user_has_role(auth.uid(), 'admin'))
  )
);


