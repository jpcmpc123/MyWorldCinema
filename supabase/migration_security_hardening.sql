-- ============================================================
-- MyWorld Cinema — Security & Schema Hardening Migration
-- Cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- Idempotente: pode ser executado mais de uma vez com segurança.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Storage: Bucket 'avatars' (MIME types seguros + limite 2MB)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB (2 * 1024 * 1024 bytes)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Garante que policies de INSERT e UPDATE em storage.objects validem
-- dono do prefixo (<user_id>/...), extensão segura (sem SVG) e WITH CHECK
drop policy if exists "avatars_authenticated_insert" on storage.objects;
create policy "avatars_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

drop policy if exists "avatars_authenticated_update" on storage.objects;
create policy "avatars_authenticated_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

-- ------------------------------------------------------------
-- 2. Restrições CHECK de tamanho em colunas de texto livre
-- ------------------------------------------------------------

-- profiles: display_name (<= 80) e bio (<= 1000)
alter table public.profiles
  drop constraint if exists profiles_display_name_len_check,
  add constraint profiles_display_name_len_check
    check (char_length(display_name) <= 80);

alter table public.profiles
  drop constraint if exists profiles_bio_len_check,
  add constraint profiles_bio_len_check
    check (char_length(bio) <= 1000);

-- Caso migration_settings.sql já tenha sido aplicada, limita location e website
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'location'
  ) then
    alter table public.profiles
      drop constraint if exists profiles_location_len_check,
      add constraint profiles_location_len_check
        check (char_length(location) <= 100);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'website'
  ) then
    alter table public.profiles
      drop constraint if exists profiles_website_len_check,
      add constraint profiles_website_len_check
        check (char_length(website) <= 255);
  end if;
end $$;

-- film_logs: review_text (<= 10000) e film_title (<= 300)
alter table public.film_logs
  drop constraint if exists film_logs_review_text_len_check,
  add constraint film_logs_review_text_len_check
    check (review_text is null or char_length(review_text) <= 10000);

alter table public.film_logs
  drop constraint if exists film_logs_film_title_len_check,
  add constraint film_logs_film_title_len_check
    check (char_length(film_title) <= 300);

-- lists: title (1..150) e description (<= 5000)
alter table public.lists
  drop constraint if exists lists_title_len_check,
  add constraint lists_title_len_check
    check (char_length(trim(title)) between 1 and 150);

alter table public.lists
  drop constraint if exists lists_description_len_check,
  add constraint lists_description_len_check
    check (char_length(description) <= 5000);

-- ------------------------------------------------------------
-- 3. Colunas faltantes em film_logs + tabela list_comments + RLS
-- ------------------------------------------------------------
alter table public.film_logs
  add column if not exists tags text[] not null default '{}',
  add column if not exists is_rewatch boolean not null default false;

alter table public.film_logs
  drop constraint if exists film_logs_tags_count_check,
  add constraint film_logs_tags_count_check
    check (coalesce(array_length(tags, 1), 0) <= 20);

create table if not exists public.list_comments (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists list_comments_list_created_idx
  on public.list_comments (list_id, created_at asc);

alter table public.list_comments enable row level security;

drop policy if exists "list_comments_select" on public.list_comments;
create policy "list_comments_select"
  on public.list_comments for select
  using (
    exists (
      select 1 from public.lists l
      where l.id = list_id
        and (l.is_public or l.user_id = auth.uid())
    )
  );

drop policy if exists "list_comments_insert" on public.list_comments;
create policy "list_comments_insert"
  on public.list_comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.lists l
      where l.id = list_id
        and (l.is_public or l.user_id = auth.uid())
    )
  );

drop policy if exists "list_comments_update" on public.list_comments;
create policy "list_comments_update"
  on public.list_comments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "list_comments_delete" on public.list_comments;
create policy "list_comments_delete"
  on public.list_comments for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.lists l
      where l.id = list_id
        and l.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 4. Policies de UPDATE com WITH CHECK explícito (anti-tampering)
-- ------------------------------------------------------------
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "logs_update" on public.film_logs;
create policy "logs_update"
  on public.film_logs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "lists_update" on public.lists;
create policy "lists_update"
  on public.lists for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
begin
  if to_regclass('public.film_overrides') is not null then
    drop policy if exists "film_overrides_update" on public.film_overrides;
    create policy "film_overrides_update"
      on public.film_overrides for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ------------------------------------------------------------
-- 5. Policy de DELETE em profiles (conformidade LGPD)
-- ------------------------------------------------------------
drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete"
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);
