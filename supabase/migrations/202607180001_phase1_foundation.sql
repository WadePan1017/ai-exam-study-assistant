create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  timezone text not null default 'Asia/Shanghai',
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  level text not null,
  syllabus_version text not null,
  config_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.access_rate_limits (
  fingerprint_hash text primary key check (fingerprint_hash ~ '^[0-9a-f]{64}$'),
  failure_count integer not null default 0 check (failure_count >= 0),
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists exams_set_updated_at on public.exams;
create trigger exams_set_updated_at
before update on public.exams
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.exams enable row level security;
alter table public.access_rate_limits enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.exams from anon, authenticated;
revoke all on table public.access_rate_limits from anon, authenticated;

create or replace function public.get_access_rate_limit_status(
  p_fingerprint_hash text
)
returns table (
  is_allowed boolean,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blocked_until timestamptz;
begin
  select limits.blocked_until
  into v_blocked_until
  from public.access_rate_limits as limits
  where limits.fingerprint_hash = p_fingerprint_hash;

  if v_blocked_until is null or v_blocked_until <= clock_timestamp() then
    return query select true, 0;
    return;
  end if;

  return query
  select
    false,
    greatest(
      1,
      ceil(extract(epoch from (v_blocked_until - clock_timestamp())))::integer
    );
end;
$$;

create or replace function public.record_access_failure(
  p_fingerprint_hash text
)
returns table (
  is_allowed boolean,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_attempt public.access_rate_limits%rowtype;
begin
  insert into public.access_rate_limits as limits (
    fingerprint_hash,
    failure_count,
    window_started_at,
    blocked_until,
    updated_at
  )
  values (
    p_fingerprint_hash,
    1,
    v_now,
    null,
    v_now
  )
  on conflict (fingerprint_hash) do update
  set
    failure_count = case
      when v_now - limits.window_started_at > interval '15 minutes' then 1
      else limits.failure_count + 1
    end,
    window_started_at = case
      when v_now - limits.window_started_at > interval '15 minutes' then v_now
      else limits.window_started_at
    end,
    blocked_until = case
      when v_now - limits.window_started_at > interval '15 minutes' then null
      when limits.failure_count + 1 >= 5 then
        v_now + make_interval(
          secs => least(
            3600,
            (
              60 * power(
                2,
                greatest(limits.failure_count + 1 - 5, 0)
              )
            )::integer
          )
        )
      else null
    end,
    updated_at = v_now
  returning limits.* into v_attempt;

  if v_attempt.blocked_until is null or v_attempt.blocked_until <= v_now then
    return query select true, 0;
    return;
  end if;

  return query
  select
    false,
    greatest(
      1,
      ceil(extract(epoch from (v_attempt.blocked_until - v_now)))::integer
    );
end;
$$;

create or replace function public.clear_access_failures(
  p_fingerprint_hash text
)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.access_rate_limits
  where fingerprint_hash = p_fingerprint_hash;
$$;

revoke all on function public.get_access_rate_limit_status(text)
from public, anon, authenticated;
revoke all on function public.record_access_failure(text)
from public, anon, authenticated;
revoke all on function public.clear_access_failures(text)
from public, anon, authenticated;

grant execute on function public.get_access_rate_limit_status(text)
to service_role;
grant execute on function public.record_access_failure(text)
to service_role;
grant execute on function public.clear_access_failures(text)
to service_role;

insert into public.profiles (
  id,
  display_name,
  timezone,
  role
)
values (
  '00000000-0000-4000-8000-000000000001',
  '个人学习者',
  'Asia/Shanghai',
  'owner'
)
on conflict (id) do nothing;

insert into public.exams (
  id,
  code,
  name,
  level,
  syllabus_version,
  config_json,
  is_active
)
values (
  '00000000-0000-4000-8000-000000000002',
  'system-integration-project-management-engineer',
  '系统集成项目管理工程师',
  '中级',
  '2025-06-04',
  '{
    "timezone": "Asia/Shanghai",
    "passingRule": {
      "mode": "per_subject",
      "percentage": 60,
      "defaultFixedScore": 45
    },
    "combinedDurationMinutes": 240,
    "sessions": [
      {
        "code": "basic-knowledge",
        "name": "系统集成项目管理基础知识",
        "questionFormat": "选择题",
        "maxScore": 75,
        "minimumDurationMinutes": 90,
        "maximumDurationMinutes": 120
      },
      {
        "code": "applied-technology",
        "name": "系统集成项目管理应用技术（案例分析）",
        "questionFormat": "问答题",
        "maxScore": 75,
        "durationRule": "使用两科240分钟总时长的剩余时间"
      }
    ],
    "sourceUrls": [
      "https://www.ruankao.org.cn/article/content/ksjs/02_43.html",
      "https://www.ruankao.org.cn/article/content/2604141656059313900690012.html",
      "https://www.ruankao.org.cn/article/content/2506041517072285802468862.html"
    ]
  }'::jsonb,
  true
)
on conflict (code) do nothing;
