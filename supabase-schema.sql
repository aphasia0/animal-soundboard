-- ============================================
-- Sound Pad - Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. User Categories table
create table if not exists user_categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  emoji text not null default '📁',
  created_at timestamptz default now()
);

-- 2. User Cards table
create table if not exists user_cards (
  id uuid default gen_random_uuid() primary key,
  category_id uuid references user_categories(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  image_url text not null,
  sound_url text not null,
  created_at timestamptz default now()
);

-- 3. Enable RLS
alter table user_categories enable row level security;
alter table user_cards enable row level security;

-- 4. RLS Policies - Categories
create policy "Users can view own categories"
  on user_categories for select
  using (auth.uid() = user_id);

create policy "Users can insert own categories"
  on user_categories for insert
  with check (auth.uid() = user_id);

create policy "Users can update own categories"
  on user_categories for update
  using (auth.uid() = user_id);

create policy "Users can delete own categories"
  on user_categories for delete
  using (auth.uid() = user_id);

-- 5. RLS Policies - Cards
create policy "Users can view own cards"
  on user_cards for select
  using (auth.uid() = user_id);

create policy "Users can insert own cards"
  on user_cards for insert
  with check (auth.uid() = user_id);

create policy "Users can update own cards"
  on user_cards for update
  using (auth.uid() = user_id);

create policy "Users can delete own cards"
  on user_cards for delete
  using (auth.uid() = user_id);

-- 6. Storage buckets
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('card-sounds', 'card-sounds', true)
on conflict (id) do nothing;

-- 7. Storage policies - card-images
create policy "Authenticated users can upload images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'card-images');

create policy "Anyone can view images"
  on storage.objects for select
  using (bucket_id = 'card-images');

create policy "Users can delete own images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- 8. Storage policies - card-sounds
create policy "Authenticated users can upload sounds"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'card-sounds');

create policy "Anyone can view sounds"
  on storage.objects for select
  using (bucket_id = 'card-sounds');

create policy "Users can delete own sounds"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'card-sounds' and (storage.foldername(name))[1] = auth.uid()::text);
