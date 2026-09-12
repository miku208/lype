-- ============================================================
-- Lyppe Store — Supabase schema
-- Run this in the Supabase SQL Editor (Project → SQL Editor).
-- Safe to run once on a fresh project.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. profiles — links auth.users to an application role
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

-- Automatically create a profile row whenever a new auth user signs up.
-- New users default to 'user'. Promote an account to admin manually:
--   update public.profiles set role = 'admin' where id = '<user-uuid>';
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper used inside RLS policies: is the current JWT user an admin?
-- SECURITY DEFINER lets it read profiles regardless of the caller's
-- own row-level policy, without granting the caller broader access.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- 2. products
-- ------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price numeric not null default 0,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_slug_idx on public.products (slug);
create index if not exists products_active_idx on public.products (is_active);

-- ------------------------------------------------------------
-- 3. store_settings (single-row table)
-- ------------------------------------------------------------
create table if not exists public.store_settings (
  id uuid primary key default gen_random_uuid(),
  store_name text not null default 'Lyppe Store',
  store_description text,
  admin_whatsapp text,
  qris_url text,
  updated_at timestamptz not null default now()
);

-- Enforce "only one active settings row" at the database level.
create unique index if not exists store_settings_singleton
  on public.store_settings ((true));

insert into public.store_settings (store_name, store_description)
select 'Lyppe Store', 'Katalog produk digital Lyppe Store.'
where not exists (select 1 from public.store_settings);

-- ------------------------------------------------------------
-- 4. updated_at trigger, shared by products & store_settings
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 5. Row Level Security
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.store_settings enable row level security;

-- profiles: a user may read only their own row; only admins manage roles.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_admin_manage" on public.profiles;
create policy "profiles_admin_manage"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- products: public may only read active rows.
drop policy if exists "products_public_select" on public.products;
create policy "products_public_select"
  on public.products for select
  using (is_active = true or public.is_admin());

-- products: admin-only write access (NOT "any authenticated user").
drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert"
  on public.products for insert
  with check (public.is_admin());

drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update"
  on public.products for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete"
  on public.products for delete
  using (public.is_admin());

-- store_settings: public may read; only admins may write.
drop policy if exists "settings_public_select" on public.store_settings;
create policy "settings_public_select"
  on public.store_settings for select
  using (true);

drop policy if exists "settings_admin_insert" on public.store_settings;
create policy "settings_admin_insert"
  on public.store_settings for insert
  with check (public.is_admin());

drop policy if exists "settings_admin_update" on public.store_settings;
create policy "settings_admin_update"
  on public.store_settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- 6. Promote your first admin (run manually after creating a user
--    via Supabase Auth → Users, or via admin/index.html sign-in flow
--    followed by this statement):
--
-- update public.profiles set role = 'admin' where id = '<user-uuid>';
-- ------------------------------------------------------------

do $$
declare
  new_user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'admin@miku.com',
    crypt('mikuhost', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    new_user_id,
    new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', 'admin@miku.com'),
    'email',
    now(), now(), now()
  );

  insert into public.profiles (id, role)
  values (new_user_id, 'admin')
  on conflict (id) do update set role = 'admin';
end $$;


alter table public.store_settings add column if not exists banner_url text;

alter table public.store_settings
add column if not exists hero_media_url text;