
-- Enable RLS
alter table public.lexeme enable row level security;
alter table public.sense enable row level security;
alter table public.crossmap enable row level security;
alter table public.tag enable row level security;
alter table public.lexeme_tag enable row level security;
alter table public.rules enable row level security;

-- Anonymous read-only
create policy if not exists anon_select_lexeme on public.lexeme for select using (true);
create policy if not exists anon_select_sense on public.sense for select using (true);
create policy if not exists anon_select_crossmap on public.crossmap for select using (true);
create policy if not exists anon_select_tag on public.tag for select using (true);
create policy if not exists anon_select_lexeme_tag on public.lexeme_tag for select using (true);
create policy if not exists anon_select_rules on public.rules for select using (true);

-- Service role can write (checked at PostgREST level; keep DB policies permissive for simplicity)
-- If you need stricter checks, add: with check (auth.role() = 'service_role')
create policy if not exists anon_insert_block on public.lexeme for insert with check (false);
create policy if not exists anon_update_block on public.lexeme for update using (false);
create policy if not exists anon_delete_block on public.lexeme for delete using (false);
-- Repeat for other tables
create policy if not exists anon_insert_block_sense on public.sense for insert with check (false);
create policy if not exists anon_update_block_sense on public.sense for update using (false);
create policy if not exists anon_delete_block_sense on public.sense for delete using (false);

create policy if not exists anon_insert_block_crossmap on public.crossmap for insert with check (false);
create policy if not exists anon_update_block_crossmap on public.crossmap for update using (false);
create policy if not exists anon_delete_block_crossmap on public.crossmap for delete using (false);

create policy if not exists anon_insert_block_tag on public.tag for insert with check (false);
create policy if not exists anon_update_block_tag on public.tag for update using (false);
create policy if not exists anon_delete_block_tag on public.tag for delete using (false);

create policy if not exists anon_insert_block_lexeme_tag on public.lexeme_tag for insert with check (false);
create policy if not exists anon_update_block_lexeme_tag on public.lexeme_tag for update using (false);
create policy if not exists anon_delete_block_lexeme_tag on public.lexeme_tag for delete using (false);

create policy if not exists anon_insert_block_rules on public.rules for insert with check (false);
create policy if not exists anon_update_block_rules on public.rules for update using (false);
create policy if not exists anon_delete_block_rules on public.rules for delete using (false);
