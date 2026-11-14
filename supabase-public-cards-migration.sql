begin;

create temporary table soundpad_migration_config (
  owner_id uuid not null,
  private_category_ids uuid[] not null,
  category_ids uuid[]
) on commit drop;

insert into soundpad_migration_config
  (owner_id, private_category_ids, category_ids)
values (
  '00000000-0000-0000-0000-000000000000'::uuid,
  array[]::uuid[],
  null::uuid[]
);

do $migration$
begin
  if exists (
    select 1 from soundpad_migration_config
    where owner_id = '00000000-0000-0000-0000-000000000000'::uuid
  ) then
    raise exception 'Configura owner_id con UUID del tuo account.';
  end if;

  if not exists (
    select 1
    from soundpad_migration_config cfg
    join auth.users u on u.id = cfg.owner_id
  ) then
    raise exception 'owner_id non trovato in auth.users.';
  end if;

  if exists (
    select 1 from soundpad_migration_config
    where category_ids is not null and cardinality(private_category_ids) > 0
  ) then
    raise exception
      'Configura category_ids oppure private_category_ids, non entrambe.';
  end if;

  if exists (
    select 1 from soundpad_migration_config
    where category_ids is not null and cardinality(category_ids) = 0
  ) then
    raise exception
      'category_ids vuoto: indica almeno un UUID oppure usa NULL.';
  end if;

  if exists (
    select 1
    from soundpad_migration_config cfg
    cross join lateral unnest(
      coalesce(cfg.category_ids, cfg.private_category_ids)
    ) as selected(id)
    left join public.user_categories cat
      on cat.id = selected.id and cat.user_id = cfg.owner_id
    where cat.id is null
  ) then
    raise exception
      'La configurazione contiene un UUID categoria inesistente o non appartenente a owner_id.';
  end if;
end
$migration$;

create temporary table soundpad_categories_to_migrate on commit drop as
select
  cat.id,
  cat.name,
  cat.emoji,
  cat.created_at,
  (row_number() over (order by cat.created_at, cat.id) - 1)::integer as sort_order
from soundpad_migration_config cfg
join public.user_categories cat on cat.user_id = cfg.owner_id
where (
  cfg.category_ids is not null
  and cat.id = any(cfg.category_ids)
) or (
  cfg.category_ids is null
  and not (cat.id = any(cfg.private_category_ids))
);

create temporary table soundpad_cards_to_migrate on commit drop as
with selected as (
  select card.id, card.category_id, card.name, card.created_at,
         card.image_url, card.sound_url, cfg.owner_id
  from soundpad_migration_config cfg
  join public.user_cards card on card.user_id = cfg.owner_id
  join soundpad_categories_to_migrate cat on cat.id = card.category_id
), parsed as (
  select
    selected.*,
    substring(image_url from
      '/storage/v1/object/public/card-images/' || owner_id::text
      || '/([-A-Za-z0-9_./]+)$'
    ) as source_image_path,
    substring(sound_url from
      '/storage/v1/object/public/card-sounds/' || owner_id::text
      || '/([-A-Za-z0-9_./]+)$'
    ) as source_sound_path
  from selected
), classified as (
  select
    parsed.*,
    (
      source_image_path is null
      and btrim(image_url) = image_url
      and char_length(image_url) between 1 and 32
      and image_url !~ '[/\\:[:space:]]'
      and image_url !~ '^[A-Za-z0-9_.-]+$'
    ) as use_emoji_image
  from parsed
)
select
  id,
  category_id,
  name,
  created_at,
  case when source_image_path is not null then
    regexp_replace(
      image_url,
      '(/card-images/)' || owner_id::text || '/',
      '\1public/' || id::text || '/'
    )
    when use_emoji_image then
      regexp_replace(
        sound_url,
        '/storage/v1/object/public/card-sounds/' || owner_id::text || '/[-A-Za-z0-9_./]+$',
        '/storage/v1/object/public/card-images/public/' || id::text || '/emoji.svg'
      )
  end as public_image_url,
  case when source_sound_path is not null then
    regexp_replace(
      sound_url,
      '(/card-sounds/)' || owner_id::text || '/',
      '\1public/' || id::text || '/'
    )
  end as public_sound_url,
  case
    when source_image_path is not null then
      'public/' || id::text || '/' || source_image_path
    when use_emoji_image then
      'public/' || id::text || '/emoji.svg'
  end as target_image_path,
  case when source_sound_path is not null then
    'public/' || id::text || '/' || source_sound_path
  end as target_sound_path
from classified;

do $migration$
begin
  if exists (
    select 1 from soundpad_cards_to_migrate
    where public_image_url is null
       or public_sound_url is null
       or position('..' in coalesce(target_image_path, '')) > 0
       or position('..' in coalesce(target_sound_path, '')) > 0
  ) then
    raise exception
      'Sono supportati gli URL Storage attuali .../card-images/<userid>/<file> e .../card-sounds/<userid>/<file>, senza query string; image_url può anche contenere un singolo emoji. Correggi gli altri valori non conformi prima di migrare.';
  end if;

  if exists (
    select 1
    from soundpad_cards_to_migrate card
    where not exists (
      select 1 from storage.objects obj
      where obj.bucket_id = 'card-images'
        and obj.name = card.target_image_path
    ) or not exists (
      select 1 from storage.objects obj
      where obj.bucket_id = 'card-sounds'
        and obj.name = card.target_sound_path
    )
  ) then
    raise exception
      'Manca almeno un asset sotto public/. Esegui prima scripts/migrate-user-card-assets-to-public.js con --apply e la stessa selezione category/private-category; nessun dato è stato modificato.';
  end if;

  if exists (
    select 1
    from public.user_cards card
    join soundpad_categories_to_migrate cat on cat.id = card.category_id
    join soundpad_migration_config cfg on card.user_id <> cfg.owner_id
  ) then
    raise exception
      'Una categoria da migrare contiene card di un altro user_id; migrazione annullata.';
  end if;
end
$migration$;

insert into public.soundpad_public_categories
  (id, name, emoji, sort_order, created_at)
select id, name, emoji, sort_order, created_at
from soundpad_categories_to_migrate
on conflict (id) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  sort_order = excluded.sort_order,
  created_at = excluded.created_at;

insert into public.soundpad_public_cards
  (id, category_id, name, image_url, sound_url, created_at)
select id, category_id, name, public_image_url, public_sound_url, created_at
from soundpad_cards_to_migrate
on conflict (id) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  image_url = excluded.image_url,
  sound_url = excluded.sound_url,
  created_at = excluded.created_at;

delete from public.user_cards card
using soundpad_cards_to_migrate migrated
where card.id = migrated.id;

delete from public.user_categories cat
using soundpad_categories_to_migrate migrated
where cat.id = migrated.id;

select
  (select count(*) from soundpad_categories_to_migrate) as categorie_da_pubblicare,
  (select count(*) from soundpad_cards_to_migrate) as card_da_pubblicare,
  (select count(*)
   from public.user_categories cat
   join soundpad_migration_config cfg on cat.user_id = cfg.owner_id
  ) as categorie_rimaste_personali,
  (select count(*)
   from public.user_cards card
   join soundpad_migration_config cfg on card.user_id = cfg.owner_id
  ) as card_rimaste_personali;

rollback;
