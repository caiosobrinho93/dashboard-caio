-- ============================================================================
--  REDE DOS TRABALHADORES — banco da rede social (Supabase / PostgreSQL)
--  Como usar: Supabase > SQL Editor > New query > cole tudo > Run.
--  Pode rodar mais de uma vez sem quebrar (idempotente).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) PERFIS  (1 por usuario cadastrado no Auth)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique,
  full_name  text not null default 'Trabalhador',
  trade      text,                 -- profissao: marceneiro, eletricista, pintor...
  city       text,                 -- cidade / regiao
  bio        text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles leitura" on public.profiles;
create policy "profiles leitura" on public.profiles
  for select using (true);

drop policy if exists "profiles inserir" on public.profiles;
create policy "profiles inserir" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles editar" on public.profiles;
create policy "profiles editar" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- cria o perfil automaticamente quando alguem se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_name     text;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1));
  v_username := lower(regexp_replace(
      coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1)),
      '[^a-zA-Z0-9_]+', '', 'g'));

  if v_username is null or length(v_username) < 3 then
    v_username := 'user' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  if exists (select 1 from public.profiles where username = v_username) then
    v_username := v_username || '_' || substr(md5(random()::text), 1, 4);
  end if;

  insert into public.profiles (id, username, full_name, trade, city)
  values (
    new.id,
    v_username,
    v_name,
    nullif(trim(new.raw_user_meta_data->>'trade'), ''),
    nullif(trim(new.raw_user_meta_data->>'city'), '')
  )
  on conflict (id) do nothing;

  return new;
exception when others then
  begin
    insert into public.profiles (id, username, full_name)
    values (new.id, 'user' || substr(replace(new.id::text, '-', ''), 1, 8), 'Trabalhador')
    on conflict (id) do nothing;
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2) COMUNIDADES  (grupos: "Marceneiros da Zona Norte", "Pintores", ...)
-- ---------------------------------------------------------------------------
create table if not exists public.communities (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  city        text,
  cover_url   text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.communities enable row level security;

drop policy if exists "communities leitura" on public.communities;
create policy "communities leitura" on public.communities
  for select using (true);

drop policy if exists "communities criar" on public.communities;
create policy "communities criar" on public.communities
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "communities editar" on public.communities;
create policy "communities editar" on public.communities
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "communities apagar" on public.communities;
create policy "communities apagar" on public.communities
  for delete to authenticated using (created_by = auth.uid());

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         text not null default 'member',      -- 'admin' | 'moderator' | 'member'
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);

alter table public.community_members enable row level security;

drop policy if exists "members leitura" on public.community_members;
create policy "members leitura" on public.community_members
  for select using (true);

drop policy if exists "members entrar" on public.community_members;
create policy "members entrar" on public.community_members
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "members sair" on public.community_members;
create policy "members sair" on public.community_members
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.communities c where c.id = community_id and c.created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3) POSTS  (publicacoes do feed; podem pertencer a uma comunidade)
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  author       uuid not null references public.profiles(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  content      text not null default '',
  image_url    text,
  created_at   timestamptz not null default now()
);

alter table public.posts enable row level security;

drop policy if exists "posts leitura" on public.posts;
create policy "posts leitura" on public.posts
  for select using (true);

drop policy if exists "posts criar" on public.posts;
create policy "posts criar" on public.posts
  for insert to authenticated with check (author = auth.uid());

drop policy if exists "posts editar" on public.posts;
create policy "posts editar" on public.posts
  for update to authenticated using (author = auth.uid()) with check (author = auth.uid());

drop policy if exists "posts apagar" on public.posts;
create policy "posts apagar" on public.posts
  for delete to authenticated using (author = auth.uid());

-- ---------------------------------------------------------------------------
-- 4) COMENTARIOS
-- ---------------------------------------------------------------------------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author     uuid not null references public.profiles(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

drop policy if exists "comments leitura" on public.comments;
create policy "comments leitura" on public.comments
  for select using (true);

drop policy if exists "comments criar" on public.comments;
create policy "comments criar" on public.comments
  for insert to authenticated with check (author = auth.uid());

drop policy if exists "comments editar" on public.comments;
create policy "comments editar" on public.comments
  for update to authenticated using (author = auth.uid()) with check (author = auth.uid());

drop policy if exists "comments apagar" on public.comments;
create policy "comments apagar" on public.comments
  for delete to authenticated using (author = auth.uid());

-- ---------------------------------------------------------------------------
-- 5) CURTIDAS
-- ---------------------------------------------------------------------------
create table if not exists public.likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.likes enable row level security;

drop policy if exists "likes leitura" on public.likes;
create policy "likes leitura" on public.likes
  for select using (true);

drop policy if exists "likes curtir" on public.likes;
create policy "likes curtir" on public.likes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "likes descurtir" on public.likes;
create policy "likes descurtir" on public.likes
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6) SEGUIR  (rede de contatos entre trabalhadores)
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.follows enable row level security;

drop policy if exists "follows leitura" on public.follows;
create policy "follows leitura" on public.follows
  for select using (true);

drop policy if exists "follows seguir" on public.follows;
create policy "follows seguir" on public.follows
  for insert to authenticated with check (follower_id = auth.uid());

drop policy if exists "follows deixar" on public.follows;
create policy "follows deixar" on public.follows
  for delete to authenticated using (follower_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7) INDICES (feed rapido)
-- ---------------------------------------------------------------------------
create index if not exists posts_created_idx          on public.posts (created_at desc);
create index if not exists posts_community_idx        on public.posts (community_id, created_at desc);
create index if not exists posts_author_idx           on public.posts (author, created_at desc);
create index if not exists comments_post_idx          on public.comments (post_id, created_at);
create index if not exists likes_post_idx             on public.likes (post_id);
create index if not exists community_members_user_idx on public.community_members (user_id);
create index if not exists follows_following_idx      on public.follows (following_id);

-- ---------------------------------------------------------------------------
-- 8) STORAGE  (fotos dos posts e avatares)
--    Se der erro de permissao aqui, nao tem problema: crie os buckets
--    'posts' e 'avatars' manualmente em Storage > New bucket (publicos)
--    e as policies em Storage > Policies. O resto do script ja funcionou.
-- ---------------------------------------------------------------------------
do $$
begin
  insert into storage.buckets (id, name, public) values ('posts', 'posts', true)
    on conflict (id) do nothing;
  insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
    on conflict (id) do nothing;
exception when others then
  raise notice 'Crie os buckets posts/avatars manualmente no painel Storage.';
end $$;

do $$
begin
  execute 'drop policy if exists "fotos leitura publica" on storage.objects';
  execute 'create policy "fotos leitura publica" on storage.objects for select using (bucket_id in (''posts'', ''avatars''))';

  execute 'drop policy if exists "fotos envio autenticado" on storage.objects';
  execute 'create policy "fotos envio autenticado" on storage.objects for insert to authenticated with check (bucket_id in (''posts'', ''avatars''))';

  execute 'drop policy if exists "fotos apagar dono" on storage.objects';
  execute 'create policy "fotos apagar dono" on storage.objects for delete to authenticated using (bucket_id in (''posts'', ''avatars'') and owner::text = auth.uid()::text)';
exception when others then
  raise notice 'Crie as policies de Storage manualmente no painel (Storage > Policies).';
end $$;

-- ============================================================================
--  PRONTO! Agora no painel do Supabase:
--  1. Authentication > Providers > Email: habilitado.
--     Para testar rapido, desligue "Confirm email" (Authentication > Sign In / Up).
--  2. Authentication > URL Configuration: Site URL = URL do seu site na Vercel
--     (ex.: https://dashboard-caio-one.vercel.app) e adicione ela em Redirect URLs.
-- ============================================================================
