-- ============================================================
-- CivicPulse Georgia public read API
--
-- Exposes only shared, provider-owned legislative data. No profiles, follows,
-- teams, notes, email lists, staff analysis, or editable agendas are reachable
-- through these functions.
-- ============================================================

begin;

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
    session_row.last_synced_at
  from public.bill_session_sync_state as session_row
  where session_row.state = upper(btrim(coalesce(p_state, 'GA')))
    and exists (
      select 1
      from public.legislative_bill_cache as cache_row
      where cache_row.state = session_row.state
        and cache_row.session_id = session_row.session_id
    )
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
    cache_row.payload || jsonb_build_object(
      'state', cache_row.state,
      'session_id', cache_row.session_id,
      'bill_number', cache_row.bill_number,
      'legiscan_id', cache_row.legiscan_id,
      'provider_updated_at', cache_row.updated_at
    ) as payload
  from public.legislative_bill_cache as cache_row
  where cache_row.state = upper(btrim(coalesce(p_state, 'GA')))
    and cache_row.session_id = p_session_id
    and (
      nullif(btrim(p_search), '') is null
      or regexp_replace(cache_row.bill_number, '\s+', '', 'g') ilike
        '%' || regexp_replace(btrim(p_search), '\s+', '', 'g') || '%'
      or coalesce(cache_row.payload ->> 'title', '') ilike '%' || btrim(p_search) || '%'
      or coalesce(cache_row.payload ->> 'sponsor', '') ilike '%' || btrim(p_search) || '%'
      or coalesce(cache_row.payload ->> 'current_committee', '') ilike '%' || btrim(p_search) || '%'
    )
    and (
      nullif(btrim(p_chamber), '') is null
      or coalesce(cache_row.payload ->> 'chamber', '') ilike btrim(p_chamber)
    )
  order by
    nullif(cache_row.payload ->> 'last_action_date', '') desc nulls last,
    cache_row.bill_number asc
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
    meeting_row.updated_at,
    meeting_row.session_id,
    meeting_row.state
  from public.ga_meetings_cache as meeting_row
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

comment on function public.get_civic_sessions(text) is
  'Read-only public session metadata for CivicPulse Georgia.';
comment on function public.get_civic_bills(text, bigint, integer, integer, text, text) is
  'Read-only public provider bill snapshots for CivicPulse Georgia.';
comment on function public.get_civic_meetings(text, bigint, timestamptz, timestamptz) is
  'Read-only public Georgia meeting cache for CivicPulse Georgia.';

commit;
