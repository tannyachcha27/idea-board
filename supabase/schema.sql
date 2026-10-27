-- Run once in a new Supabase project's SQL Editor.
-- Replace __BOARD_SECRET_SHA256__ with SHA-256(BOARD_API_SECRET), never the secret.
-- No Supabase Auth, service-role key, or SECURITY DEFINER function is used.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon;

-- PostgREST forwards these headers from our Next.js server. Knowing the
-- publishable key alone cannot authorize writes or impersonate a voter.
create function private.board_voter() returns text
language sql stable security invoker set search_path = ''
as $$
  select case when
    encode(sha256(convert_to(coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-board-secret', ''), 'UTF8')), 'hex')
      = '__BOARD_SECRET_SHA256__'
    and (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-voter-id') ~ '^[a-f0-9]{64}$'
  then nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-voter-id'
  else null end;
$$;
revoke all on function private.board_voter() from public;
grant execute on function private.board_voter() to anon;

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text not null check (char_length(btrim(description)) between 10 and 1000),
  author_nickname text not null check (char_length(btrim(author_nickname)) between 2 and 30),
  created_at timestamptz not null default now()
);
create table public.votes (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  voter_id text not null check (voter_id ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  constraint one_vote_per_idea_per_voter unique (idea_id, voter_id)
);
create index ideas_created_at_idx on public.ideas (created_at desc);

alter table public.ideas enable row level security;
alter table public.votes enable row level security;
revoke all on public.ideas, public.votes from public, anon, authenticated;
grant select on public.ideas to anon;
grant insert (title, description, author_nickname) on public.ideas to anon;
-- Only per-idea anonymous vote tokens and idea IDs can be read. Voter IDs and
-- vote timestamps cannot be selected, filtered, or returned by public clients.
grant select (id, idea_id) on public.votes to anon;
grant insert (id, idea_id, voter_id) on public.votes to anon;
create policy "Public ideas" on public.ideas for select to anon using (true);
create policy "Server may submit" on public.ideas for insert to anon
  with check ((select private.board_voter()) is not null);
create policy "Anonymous vote totals" on public.votes for select to anon using (true);
create policy "Server may vote as identified visitor" on public.votes for insert to anon
  with check (voter_id = (select private.board_voter()));
-- No update or delete grants/policies for visitors.
create view public.idea_board with (security_invoker = true) as
  select i.id, i.title, i.description, i.author_nickname, i.created_at,
    count(v.idea_id)::integer as vote_count
  from public.ideas i left join public.votes v on v.idea_id = i.id
  group by i.id;
revoke all on public.idea_board from public, anon, authenticated;
grant select on public.idea_board to anon;
commit;
