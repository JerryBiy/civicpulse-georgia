-- ============================================================
-- CivicPulse Georgia standalone public data store
--
-- Apply this migration to a dedicated CivicPulse Supabase project, not the
-- LegiPulse staff project. The browser can only execute the three read-only
-- functions at the end of this file. Direct table access remains unavailable
-- to anon and authenticated clients; service_role performs data imports.
-- ============================================================

begin;

create table if not exists public.civic_sessions (
  state           text not null default 'GA',
  session_id      bigint not null check (session_id > 0),
  session_name    text,
  year_start      integer,
  year_end        integer,
  is_special      boolean not null default false,
  is_prior        boolean not null default false,
  is_sine_die     boolean not null default false,
  bill_count      integer not null default 0 check (bill_count >= 0),
  dataset_hash    text,
  source_updated_at timestamptz,
  imported_at     timestamptz not null default now(),
  primary key (state, session_id)
);

create table if not exists public.civic_bills (
  state           text not null default 'GA',
  session_id      bigint not null check (session_id > 0),
  bill_number     text not null,
  legiscan_id     text not null,
  payload         jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  imported_at     timestamptz not null default now(),
  primary key (state, session_id, bill_number),
  foreign key (state, session_id)
    references public.civic_sessions (state, session_id)
    on delete cascade
);

create unique index if not exists civic_bills_legiscan_key
  on public.civic_bills (state, session_id, legiscan_id);

create index if not exists civic_bills_session_idx
  on public.civic_bills (state, session_id);

create table if not exists public.civic_meetings (
  state           text not null default 'GA',
  session_id      bigint not null check (session_id > 0),
  id              text not null,
  legis_id        bigint,
  title           text not null,
  description     text,
  start_time      timestamptz not null,
  end_time        timestamptz,
  all_day         boolean not null default false,
  color           text,
  location        text,
  classification  text,
  chamber         smallint,
  video_url       text,
  agenda_url      text,
  schedule_url    text,
  will_broadcast  boolean not null default false,
  is_vimeo        boolean not null default false,
  data            jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  imported_at     timestamptz not null default now(),
  primary key (state, session_id, id),
  foreign key (state, session_id)
    references public.civic_sessions (state, session_id)
    on delete cascade
);

create index if not exists civic_meetings_session_start_idx
  on public.civic_meetings (state, session_id, start_time);

alter table public.civic_sessions enable row level security;
alter table public.civic_bills enable row level security;
alter table public.civic_meetings enable row level security;

revoke all on table public.civic_sessions from anon, authenticated;
revoke all on table public.civic_bills from anon, authenticated;
revoke all on table public.civic_meetings from anon, authenticated;
grant all on table public.civic_sessions to service_role;
grant all on table public.civic_bills to service_role;
grant all on table public.civic_meetings to service_role;

create or replace function public.get_civic_sessions(
  p_state text default 'GA'
)
returns table (
  session_id bigint,
  session_name text,
  year_start integer,
  year_end integer,
  is_special boolean,
  is_prior boolean,
  is_sine_die boolean,
  bill_count integer,
  last_synced_at timestamptz
)
language sql
security definer
stable
set search_path = public, pg_temp
as $function$
  select
    session_row.session_id,
    coalesce(
      nullif(btrim(session_row.session_name), ''),
      concat_ws(
        ' ',
        case
          when session_row.year_start is not null
            and session_row.year_end is not null
            and session_row.year_start <> session_row.year_end
            then session_row.year_start::text || '–' || session_row.year_end::text
          else session_row.year_start::text
        end,
        case when session_row.is_special then 'Special Session' else 'Regular Session' end
      )
    ) as session_name,
    session_row.year_start,
    session_row.year_end,
    session_row.is_special,
    session_row.is_prior,
    session_row.is_sine_die,
    session_row.bill_count,
    session_row.source_updated_at as last_synced_at
  from public.civic_sessions as session_row
  where session_row.state = upper(btrim(coalesce(p_state, 'GA')))
  order by
    session_row.is_prior asc,
    session_row.year_end desc nulls last,
    session_row.year_start desc nulls last,
    session_row.is_special desc,
    session_row.session_id desc;
$function$;

create or replace function public.get_civic_bills(
  p_state text,
  p_session_id bigint,
  p_limit integer default 100,
  p_offset integer default 0,
  p_search text default null,
  p_chamber text default null
)
returns table (payload jsonb)
language sql
security definer
stable
set search_path = public, pg_temp
as $function$
  select
    bill_row.payload || jsonb_build_object(
      'state', bill_row.state,
      'session_id', bill_row.session_id,
      'bill_number', bill_row.bill_number,
      'legiscan_id', bill_row.legiscan_id,
      'provider_updated_at', bill_row.source_updated_at
    ) as payload
  from public.civic_bills as bill_row
  where bill_row.state = upper(btrim(coalesce(p_state, 'GA')))
    and bill_row.session_id = p_session_id
    and (
      nullif(btrim(p_search), '') is null
      or regexp_replace(bill_row.bill_number, '\s+', '', 'g') ilike
        '%' || regexp_replace(btrim(p_search), '\s+', '', 'g') || '%'
      or coalesce(bill_row.payload ->> 'title', '') ilike '%' || btrim(p_search) || '%'
      or coalesce(bill_row.payload ->> 'sponsor', '') ilike '%' || btrim(p_search) || '%'
      or coalesce(bill_row.payload ->> 'current_committee', '') ilike '%' || btrim(p_search) || '%'
    )
    and (
      nullif(btrim(p_chamber), '') is null
      or coalesce(bill_row.payload ->> 'chamber', '') ilike btrim(p_chamber)
    )
  order by
    nullif(bill_row.payload ->> 'last_action_date', '') desc nulls last,
    bill_row.bill_number asc
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

create or replace function public.get_civic_meetings(
  p_state text,
  p_session_id bigint,
  p_start timestamptz default null,
  p_end timestamptz default null
)
returns table (
  id text,
  title text,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  location text,
  classification text,
  chamber smallint,
  video_url text,
  agenda_url text,
  schedule_url text,
  will_broadcast boolean,
  data jsonb,
  updated_at timestamptz,
  session_id bigint,
  state text
)
language sql
security definer
stable
set search_path = public, pg_temp
as $function$
  select
    meeting_row.id,
    meeting_row.title,
    meeting_row.description,
    meeting_row.start_time,
    meeting_row.end_time,
    meeting_row.location,
    meeting_row.classification,
    meeting_row.chamber,
    meeting_row.video_url,
    meeting_row.agenda_url,
    meeting_row.schedule_url,
    meeting_row.will_broadcast,
    meeting_row.data,
    meeting_row.source_updated_at as updated_at,
    meeting_row.session_id,
    meeting_row.state
  from public.civic_meetings as meeting_row
  where meeting_row.state = upper(btrim(coalesce(p_state, 'GA')))
    and meeting_row.session_id = p_session_id
    and (p_start is null or meeting_row.start_time >= p_start)
    and (p_end is null or meeting_row.start_time < p_end)
  order by meeting_row.start_time asc
  limit 500;
$function$;

revoke all on function public.get_civic_sessions(text) from public;
revoke all on function public.get_civic_bills(text, bigint, integer, integer, text, text) from public;
revoke all on function public.get_civic_meetings(text, bigint, timestamptz, timestamptz) from public;

grant execute on function public.get_civic_sessions(text) to anon, authenticated;
grant execute on function public.get_civic_bills(text, bigint, integer, integer, text, text) to anon, authenticated;
grant execute on function public.get_civic_meetings(text, bigint, timestamptz, timestamptz) to anon, authenticated;

comment on table public.civic_sessions is
  'Public legislative-session snapshots imported into the standalone CivicPulse database.';
comment on table public.civic_bills is
  'Public bill snapshots imported into the standalone CivicPulse database.';
comment on table public.civic_meetings is
  'Public meeting snapshots imported into the standalone CivicPulse database.';

commit;
