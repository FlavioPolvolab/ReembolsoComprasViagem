-- Garante permissão para gerar signed URLs no bucket 'receipts'
-- (alguns projetos exigem política de INSERT para rota /object/sign)

do $$ begin
  alter table if exists storage.objects enable row level security;

  -- leitura já criada; adiciona política de inserção controlada para permitir operação de sign
  drop policy if exists receipts_sign_policy on storage.objects;
  create policy receipts_sign_policy on storage.objects
  for insert with check (
    bucket_id = 'receipts' and auth.role() = 'authenticated'
  );
exception when others then null; end $$;


