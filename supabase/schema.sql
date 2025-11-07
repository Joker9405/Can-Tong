
-- Cantong schema v1
create table if not exists public.lexeme (
  id bigserial primary key,
  headword text not null,
  lang text not null default 'zhh', -- zhh=粵語正字, chs=中文, en=英文
  jyutping text,
  audio_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sense (
  id bigserial primary key,
  lexeme_id bigint references public.lexeme(id) on delete cascade,
  register text,               -- general/colloquial/polite or null
  gloss_chs text,
  gloss_en text,
  example text,
  example_translation text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.crossmap (
  id bigserial primary key,
  src_lexeme_id bigint references public.lexeme(id) on delete cascade,
  tgt_lexeme_id bigint references public.lexeme(id) on delete cascade,
  relation text default 'equivalent'
);

create table if not exists public.tag (
  id bigserial primary key,
  name text unique not null
);

create table if not exists public.lexeme_tag (
  lexeme_id bigint references public.lexeme(id) on delete cascade,
  tag_id bigint references public.tag(id) on delete cascade,
  primary key (lexeme_id, tag_id)
);

create table if not exists public.rules (
  id bigserial primary key,
  wrong_form text not null,
  correct_form text not null,
  note text
);

create index if not exists idx_lexeme_headword_fts on public.lexeme using gin (to_tsvector('simple', coalesce(headword,'')));
create index if not exists idx_sense_gloss_fts   on public.sense  using gin (to_tsvector('simple', coalesce(gloss_chs,'') || ' ' || coalesce(gloss_en,'')));
create index if not exists idx_rules_wrong on public.rules (wrong_form);

-- UGC additions

create table if not exists public.user_contrib (
  id bigserial primary key,
  user_name text,
  headword text not null,
  lang text default 'zhh',
  gloss_chs text,
  gloss_en text,
  source_url text,
  license text default 'CC0',
  status text default 'pending', -- pending/approved/rejected
  created_at timestamptz default now()
);

alter table public.user_contrib enable row level security;
create policy if not exists anon_insert_contrib on public.user_contrib for insert with check (true);
create policy if not exists anon_select_contrib on public.user_contrib for select using (true);
create policy if not exists anon_update_block_contrib on public.user_contrib for update using (false);
create policy if not exists anon_delete_block_contrib on public.user_contrib for delete using (false);
