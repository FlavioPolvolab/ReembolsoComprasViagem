-- Adiciona nota de fechamento na viagem e atualiza RPC para receber a nota

alter table if exists public.trips
  add column if not exists close_note text;

create or replace function public.close_trip(trip_id uuid, closer_id uuid, note text default null)
returns boolean as $$
declare can_close boolean; begin
  select user_has_role(closer_id, 'approver') into can_close;
  if not can_close then
    raise exception 'User does not have permission to close trips';
  end if;

  update public.trips
  set status = 'closed', closed_by = closer_id, closed_at = now(), updated_at = now(), close_note = note
  where id = trip_id and status = 'open';
  return found;
end; $$ language plpgsql security definer;


