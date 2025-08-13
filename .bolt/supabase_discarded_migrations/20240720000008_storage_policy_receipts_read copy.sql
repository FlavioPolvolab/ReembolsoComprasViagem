-- Permitir que usuários autenticados gerem signed URLs para arquivos do bucket 'receipts'
-- (necessário para visualizar comprovantes)

do $$ begin
  -- Habilita RLS e cria política de SELECT no storage.objects
  alter table if exists storage.objects enable row level security;

  drop policy if exists receipts_read_policy on storage.objects;
  create policy receipts_read_policy on storage.objects
  for select using (
    bucket_id = 'receipts' and auth.role() = 'authenticated'
  );
exception when others then null; end $$;


