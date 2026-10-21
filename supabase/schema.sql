-- ============================================================
-- MyWorld Cinema — schema inicial do Supabase
-- Cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ============================================================

-- 1. Perfis públicos (espelha auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '',
  avatar_url text not null default '',
  bio text not null default '',
  created_at timestamptz not null default now()
);

-- Cria perfil automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Logs / diário: watched, rating (0.5–5), liked, review
create table if not exists public.film_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  film_id integer not null,              -- id do TMDB
  film_title text not null default '',
  film_poster text,                      -- poster_path do TMDB
  film_year integer,
  watched_on date,                       -- data que assistiu (null = sem data)
  rating numeric(2,1) check (rating between 0.5 and 5),
  liked boolean not null default false,
  review_text text,
  contains_spoilers boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, film_id, watched_on)
);

-- 3. Watchlist
create table if not exists public.watchlist (
  user_id uuid not null references public.profiles (id) on delete cascade,
  film_id integer not null,
  film_title text not null default '',
  film_poster text,
  film_year integer,
  added_at timestamptz not null default now(),
  primary key (user_id, film_id)
);

-- 4. Listas personalizadas
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.list_items (
  list_id uuid not null references public.lists (id) on delete cascade,
  film_id integer not null,
  film_title text not null default '',
  film_poster text,
  film_year integer,
  position integer not null default 0,
  primary key (list_id, film_id)
);

-- 5. Seguidores
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);

-- 6. View: média de rating por filme (alimenta o histograma / ★3.1)
-- security_invoker = on: a view passa a respeitar o RLS de quem consulta
-- (por padrao views rodam com permissoes do DONO, ignorando o RLS do chamador).
create or replace view public.film_ratings
with (security_invoker = on) as
select
  film_id,
  round(avg(rating), 1) as avg_rating,
  count(rating)::int as rating_count,
  count(*)::int as log_count,
  count(*) filter (where liked)::int as like_count
from public.film_logs
group by film_id;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.film_logs enable row level security;
alter table public.watchlist enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.follows enable row level security;

-- profiles: leitura pública; só o dono edita
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);

-- film_logs: leitura pública; só o dono cria/edita/apaga
create policy "logs_select" on public.film_logs for select using (true);
create policy "logs_insert" on public.film_logs for insert with check (auth.uid() = user_id);
create policy "logs_update" on public.film_logs for update using (auth.uid() = user_id);
create policy "logs_delete" on public.film_logs for delete using (auth.uid() = user_id);

-- watchlist: só o próprio usuário vê/edita (privado)
create policy "watchlist_select" on public.watchlist for select using (auth.uid() = user_id);
create policy "watchlist_insert" on public.watchlist for insert with check (auth.uid() = user_id);
create policy "watchlist_delete" on public.watchlist for delete using (auth.uid() = user_id);

-- lists: públicas são lidas por todos; dono controla tudo
create policy "lists_select" on public.lists for select using (is_public or auth.uid() = user_id);
create policy "lists_insert" on public.lists for insert with check (auth.uid() = user_id);
create policy "lists_update" on public.lists for update using (auth.uid() = user_id);
create policy "lists_delete" on public.lists for delete using (auth.uid() = user_id);

-- list_items: segue a lista-mãe
create policy "items_select" on public.list_items for select
  using (exists (select 1 from public.lists l where l.id = list_id and (l.is_public or l.user_id = auth.uid())));
create policy "items_insert" on public.list_items for insert
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()));
create policy "items_delete" on public.list_items for delete
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()));

-- follows: leitura pública; só o seguidor cria/apaga
create policy "follows_select" on public.follows for select using (true);
create policy "follows_insert" on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete" on public.follows for delete using (auth.uid() = follower_id);
