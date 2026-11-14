-- Sound Pad - categorie e card pubbliche
-- Esegui come postgres/service_role nel SQL Editor di Supabase.
-- Lo script è rieseguibile.

begin;

-- Le categorie pubbliche sono separate da quelle personali: una categoria
-- pubblica non appartiene più a un utente e non espone il suo user_id.
create table if not exists public.soundpad_public_categories (
  id uuid primary key default gen_random_uuid(),
  slug text,
  name text not null,
  emoji text not null default '📁',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.soundpad_public_categories
  add column if not exists slug text;

create table if not exists public.soundpad_public_cards (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null
    references public.soundpad_public_categories(id) on delete cascade,
  name text not null,
  image_url text not null,
  sound_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists soundpad_public_cards_category_created_idx
  on public.soundpad_public_cards (category_id, created_at, id);

create index if not exists soundpad_public_categories_sort_idx
  on public.soundpad_public_categories (sort_order, created_at, id);

create unique index if not exists soundpad_public_categories_slug_idx
  on public.soundpad_public_categories (lower(slug))
  where slug is not null;

alter table public.soundpad_public_categories enable row level security;
alter table public.soundpad_public_cards enable row level security;

-- Lettura libera anche senza login. Nessuna policy di scrittura viene creata:
-- postgres e service_role possono amministrare i contenuti, anon/authenticated no.
drop policy if exists "Soundpad public categories are readable"
  on public.soundpad_public_categories;
create policy "Soundpad public categories are readable"
  on public.soundpad_public_categories
  for select to anon, authenticated
  using (true);

drop policy if exists "Soundpad public cards are readable"
  on public.soundpad_public_cards;
create policy "Soundpad public cards are readable"
  on public.soundpad_public_cards
  for select to anon, authenticated
  using (true);

revoke all on table public.soundpad_public_categories from anon, authenticated;
revoke all on table public.soundpad_public_cards from anon, authenticated;
grant select on table public.soundpad_public_categories to anon, authenticated;
grant select on table public.soundpad_public_cards to anon, authenticated;

-- I bucket restano quelli esistenti. Convenzione delle chiavi:
--   public/<card_uuid>/<file>  -> contenuti pubblici
--   <user_uuid>/<file>         -> contenuti personali
insert into storage.buckets (id, name, public)
values
  ('card-images', 'card-images', true),
  ('card-sounds', 'card-sounds', true)
on conflict (id) do nothing;

-- Le vecchie policy consentivano a qualunque utente autenticato di caricare
-- anche sotto public/ o sotto il prefisso di un altro utente. Le sostituiamo
-- limitando gli upload dei client al solo prefisso auth.uid().
drop policy if exists "Authenticated users can upload images" on storage.objects;
drop policy if exists "Soundpad users can upload own images" on storage.objects;
create policy "Soundpad users can upload own images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated users can upload sounds" on storage.objects;
drop policy if exists "Soundpad users can upload own sounds" on storage.objects;
create policy "Soundpad users can upload own sounds"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'card-sounds'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lettura degli oggetti via API Storage. La lettura pubblica è coerente con i
-- bucket attuali, che sono già public=true; vedere la nota nel documento di
-- migrazione riguardo al significato di "privato" per gli asset personali.
drop policy if exists "Anyone can view images" on storage.objects;
create policy "Anyone can view images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'card-images');

drop policy if exists "Anyone can view sounds" on storage.objects;
create policy "Anyone can view sounds"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'card-sounds');

-- Mantiene/consolida la cancellazione dei soli asset personali. Gli oggetti
-- sotto public/ non possono essere cancellati dai client autenticati.
drop policy if exists "Users can delete own images" on storage.objects;
create policy "Users can delete own images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own sounds" on storage.objects;
create policy "Users can delete own sounds"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'card-sounds'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
