-- Adiciona campos de perfil da página Settings ao schema existente.
-- Rode no SQL Editor do Supabase.
alter table public.profiles
  add column if not exists location text not null default '',
  add column if not exists website text not null default '',
  add column if not exists favorite_films int[] not null default '{}';
