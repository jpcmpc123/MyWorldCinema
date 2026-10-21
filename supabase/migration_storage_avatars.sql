-- Políticas do bucket 'avatars' (Supabase Storage).
-- Rode no SQL Editor do Supabase. Bucket público libera apenas LEITURA;
-- estas policies permitem que usuários autenticados enviem/editem/apaguem
-- arquivos do bucket 'avatars'.

create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- SEGURANÇA: cada usuário só pode gravar dentro do próprio prefixo
-- (<user_id>/...). Sem essa restrição, qualquer usuário autenticado
-- poderia sobrescrever/apagar o avatar de outro usuário.
-- Se você já rodou a versão antiga deste arquivo, remova as policies
-- antigas primeiro (rodar o DROP abaixo uma vez no SQL Editor):
--   drop policy if exists "avatars_authenticated_insert" on storage.objects;
--   drop policy if exists "avatars_authenticated_update" on storage.objects;
--   drop policy if exists "avatars_authenticated_delete" on storage.objects;

create policy "avatars_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_authenticated_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
