-- Tabela de Centros de Custo para Viagens e coluna em trips

create table if not exists public.trip_cost_centers (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

alter table if exists public.trips
  add column if not exists cost_center_id uuid references public.trip_cost_centers(id);

-- Seeds
insert into public.trip_cost_centers (name) values
  ('Babaçu'), ('Cacau'), ('Caju'), ('Frutas'), ('Licuri'), ('Mel'),
  ('Milho'), ('Palmito'), ('Tapioca'), ('Tomate'), ('Institucional'), ('Outros')
on conflict (name) do nothing;

-- RLS
alter table public.trip_cost_centers enable row level security;
drop policy if exists trip_cost_centers_select on public.trip_cost_centers;
create policy trip_cost_centers_select on public.trip_cost_centers
for select using (auth.uid() is not null);


