create table if not exists public.mock_exam_templates (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  blueprint_json jsonb not null,
  scoring_json jsonb not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (blueprint_json ->> 'mode' in ('fixed', 'random')),
  check ((blueprint_json ->> 'questionCount')::integer > 0),
  check ((scoring_json ->> 'perQuestion')::numeric > 0)
);

create table if not exists public.mock_exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid not null references public.mock_exam_templates(id)
    on delete restrict,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted')),
  started_at timestamptz not null,
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  score numeric(8, 4),
  max_score numeric(8, 4) not null check (max_score > 0),
  result_json jsonb,
  check (deadline_at > started_at),
  check (
    (status = 'in_progress' and submitted_at is null)
    or
    (status = 'submitted' and submitted_at is not null)
  )
);

create table if not exists public.mock_exam_items (
  mock_session_id uuid not null references public.mock_exam_sessions(id)
    on delete cascade,
  question_id uuid not null,
  question_version integer not null check (question_version > 0),
  position integer not null check (position >= 0),
  question_type text not null check (
    question_type in ('single_choice', 'multiple_choice', 'true_false')
  ),
  module_title text not null,
  weight numeric(8, 4) not null check (weight > 0),
  answer_json jsonb,
  score numeric(8, 4),
  is_correct boolean,
  is_marked boolean not null default false,
  saved_at timestamptz,
  primary key (mock_session_id, position),
  unique (mock_session_id, question_id),
  foreign key (question_id, question_version)
    references public.questions(id, version) on delete restrict
);

alter table public.question_attempts
alter column session_id drop not null;

alter table public.question_attempts
add column if not exists mock_session_id uuid
references public.mock_exam_sessions(id) on delete restrict;

alter table public.question_attempts
drop constraint if exists question_attempts_one_session_check;

alter table public.question_attempts
add constraint question_attempts_one_session_check
check (num_nonnulls(session_id, mock_session_id) = 1);

create index if not exists mock_exam_sessions_user_idx
on public.mock_exam_sessions(user_id, started_at desc);

create index if not exists mock_exam_items_session_idx
on public.mock_exam_items(mock_session_id, position);

alter table public.mock_exam_templates enable row level security;
alter table public.mock_exam_sessions enable row level security;
alter table public.mock_exam_items enable row level security;

revoke all on table public.mock_exam_templates from anon, authenticated;
revoke all on table public.mock_exam_sessions from anon, authenticated;
revoke all on table public.mock_exam_items from anon, authenticated;

insert into public.mock_exam_templates (
  exam_id,
  name,
  duration_minutes,
  blueprint_json,
  scoring_json,
  status
)
select
  exam.id,
  '客观题基础模拟（2题）',
  120,
  '{"mode":"random","questionCount":2}'::jsonb,
  '{"perQuestion":1}'::jsonb,
  'published'
from public.exams as exam
where exam.code = 'system-integration-project-management-engineer'
  and not exists (
    select 1
    from public.mock_exam_templates as template
    where template.exam_id = exam.id
      and template.name = '客观题基础模拟（2题）'
  );

create or replace function public.get_mock_exam_setup(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'owner'
  ) then
    raise exception 'Owner profile not found';
  end if;

  return jsonb_build_object(
    'templates',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', template.id,
          'name', template.name,
          'durationMinutes', template.duration_minutes,
          'questionCount',
            (template.blueprint_json ->> 'questionCount')::integer,
          'maxScore',
            (template.blueprint_json ->> 'questionCount')::numeric
            * (template.scoring_json ->> 'perQuestion')::numeric,
          'mode', template.blueprint_json ->> 'mode'
        )
        order by template.created_at
      )
      from public.mock_exam_templates as template
      where template.status = 'published'
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_mock_exam_session(
  p_user_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.mock_exam_sessions%rowtype;
begin
  select *
  into v_session
  from public.mock_exam_sessions
  where id = p_session_id and user_id = p_user_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_session.id,
    'templateId', v_session.template_id,
    'status', v_session.status,
    'startedAt', v_session.started_at,
    'deadlineAt', v_session.deadline_at,
    'submittedAt', v_session.submitted_at,
    'score', v_session.score,
    'maxScore', v_session.max_score,
    'result', v_session.result_json,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'position', item.position,
          'externalId', question.external_id,
          'version', item.question_version,
          'type', item.question_type,
          'stem', question.stem_md,
          'options', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'key', option.option_key,
                'content', option.content_md
              )
              order by option.sort_order
            )
            from public.question_options as option
            where option.question_id = item.question_id
          ), '[]'::jsonb),
          'selectedKeys',
            coalesce(item.answer_json -> 'keys', '[]'::jsonb),
          'isMarked', item.is_marked,
          'savedAt', item.saved_at
        )
        ||
        case
          when v_session.status = 'submitted' then
            jsonb_build_object(
              'correctKeys', question.answer_json -> 'keys',
              'explanation', question.explanation_md,
              'isCorrect', item.is_correct,
              'score', item.score
            )
          else '{}'::jsonb
        end
        order by item.position
      )
      from public.mock_exam_items as item
      join public.questions as question on question.id = item.question_id
      where item.mock_session_id = v_session.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.start_mock_exam_session(
  p_user_id uuid,
  p_template_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.mock_exam_templates%rowtype;
  v_session_id uuid;
  v_question_count integer;
  v_inserted integer;
  v_per_question numeric;
  v_started_at timestamptz := now();
begin
  if not exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'owner'
  ) then
    raise exception 'Owner profile not found';
  end if;

  select *
  into v_template
  from public.mock_exam_templates
  where id = p_template_id and status = 'published';
  if not found then
    raise exception 'Mock exam template not found';
  end if;

  v_question_count :=
    (v_template.blueprint_json ->> 'questionCount')::integer;
  v_per_question :=
    (v_template.scoring_json ->> 'perQuestion')::numeric;

  insert into public.mock_exam_sessions (
    user_id,
    template_id,
    status,
    started_at,
    deadline_at,
    max_score
  )
  values (
    p_user_id,
    v_template.id,
    'in_progress',
    v_started_at,
    v_started_at
      + make_interval(mins => v_template.duration_minutes),
    v_question_count * v_per_question
  )
  returning id into v_session_id;

  with recursive syllabus_tree as (
    select id, parent_id, title as root_title
    from public.syllabus_nodes
    where exam_id = v_template.exam_id
      and parent_id is null
      and status = 'published'
    union all
    select child.id, child.parent_id, parent.root_title
    from public.syllabus_nodes as child
    join syllabus_tree as parent on parent.id = child.parent_id
    where child.status = 'published'
  ),
  latest_questions as (
    select distinct on (external_id)
      id, external_id, version, question_type
    from public.questions
    where exam_id = v_template.exam_id
    order by external_id, version desc
  ),
  eligible as (
    select
      question.id,
      question.external_id,
      question.version,
      question.question_type,
      coalesce(min(tree.root_title), '未分类') as module_title
    from latest_questions as question
    join public.questions as current on current.id = question.id
    left join public.question_knowledge_points as link
      on link.question_id = question.id
    left join public.knowledge_points as knowledge
      on knowledge.id = link.knowledge_point_id
    left join syllabus_tree as tree
      on tree.id = knowledge.syllabus_node_id
    where current.review_status = 'published'
    group by
      question.id,
      question.external_id,
      question.version,
      question.question_type
  ),
  selected as (
    select *
    from eligible
    order by
      case
        when v_template.blueprint_json ->> 'mode' = 'fixed'
          then external_id
      end,
      random()
    limit v_question_count
  )
  insert into public.mock_exam_items (
    mock_session_id,
    question_id,
    question_version,
    position,
    question_type,
    module_title,
    weight
  )
  select
    v_session_id,
    selected.id,
    selected.version,
    row_number() over () - 1,
    selected.question_type,
    selected.module_title,
    v_per_question
  from selected;

  get diagnostics v_inserted = row_count;
  if v_inserted <> v_question_count then
    raise exception 'Not enough published objective questions';
  end if;

  return public.get_mock_exam_session(p_user_id, v_session_id);
end;
$$;

create or replace function public.save_mock_exam_answer(
  p_user_id uuid,
  p_session_id uuid,
  p_position integer,
  p_selected_keys text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deadline timestamptz;
begin
  select deadline_at
  into v_deadline
  from public.mock_exam_sessions
  where id = p_session_id
    and user_id = p_user_id
    and status = 'in_progress'
  for update;
  if not found then
    raise exception 'Mock exam session not found or submitted';
  end if;
  if now() >= v_deadline then
    raise exception 'Mock exam deadline passed';
  end if;

  update public.mock_exam_items
  set
    answer_json = jsonb_build_object('keys', p_selected_keys),
    saved_at = now()
  where mock_session_id = p_session_id
    and position = p_position;
  if not found then
    raise exception 'Mock exam item not found';
  end if;

  return public.get_mock_exam_session(p_user_id, p_session_id);
end;
$$;

create or replace function public.set_mock_exam_marked(
  p_user_id uuid,
  p_session_id uuid,
  p_position integer,
  p_is_marked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.mock_exam_sessions
    where id = p_session_id
      and user_id = p_user_id
      and status = 'in_progress'
      and now() < deadline_at
  ) then
    raise exception 'Mock exam session not found, submitted or expired';
  end if;

  update public.mock_exam_items
  set is_marked = p_is_marked, saved_at = now()
  where mock_session_id = p_session_id
    and position = p_position;
  if not found then
    raise exception 'Mock exam item not found';
  end if;

  return public.get_mock_exam_session(p_user_id, p_session_id);
end;
$$;

create or replace function public.submit_mock_exam_session(
  p_user_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.mock_exam_sessions%rowtype;
  v_result jsonb;
begin
  select *
  into v_session
  from public.mock_exam_sessions
  where id = p_session_id and user_id = p_user_id
  for update;
  if not found then
    raise exception 'Mock exam session not found';
  end if;
  if v_session.status = 'submitted' then
    return public.get_mock_exam_session(p_user_id, p_session_id);
  end if;

  update public.mock_exam_items as item
  set
    is_correct = (
      coalesce(item.answer_json -> 'keys', '[]'::jsonb)
        @> question.answer_json -> 'keys'
      and question.answer_json -> 'keys'
        @> coalesce(item.answer_json -> 'keys', '[]'::jsonb)
    ),
    score = case
      when (
        coalesce(item.answer_json -> 'keys', '[]'::jsonb)
          @> question.answer_json -> 'keys'
        and question.answer_json -> 'keys'
          @> coalesce(item.answer_json -> 'keys', '[]'::jsonb)
      ) then item.weight
      else 0
    end
  from public.questions as question
  where item.mock_session_id = p_session_id
    and question.id = item.question_id;

  insert into public.question_attempts (
    user_id,
    question_id,
    session_id,
    mock_session_id,
    answer_json,
    is_correct,
    score,
    confidence,
    created_at
  )
  select
    p_user_id,
    item.question_id,
    null,
    p_session_id,
    coalesce(item.answer_json, '{"keys":[]}'::jsonb),
    item.is_correct,
    item.score,
    'uncertain',
    now()
  from public.mock_exam_items as item
  where item.mock_session_id = p_session_id;

  insert into public.user_question_state (
    user_id,
    exam_id,
    question_external_id,
    total_attempts,
    correct_attempts,
    wrong_attempts,
    consecutive_correct,
    last_result,
    last_attempt_at,
    is_wrong,
    review_level,
    next_review_at,
    mastered_at,
    last_wrong_at
  )
  select
    p_user_id,
    question.exam_id,
    question.external_id,
    1,
    case when item.is_correct then 1 else 0 end,
    case when item.is_correct then 0 else 1 end,
    case when item.is_correct then 1 else 0 end,
    item.is_correct,
    now(),
    not item.is_correct,
    0,
    case
      when item.is_correct then null
      else date_trunc(
        'day',
        now() at time zone 'Asia/Shanghai'
      ) at time zone 'Asia/Shanghai' + interval '1 day'
    end,
    null,
    case when item.is_correct then null else now() end
  from public.mock_exam_items as item
  join public.questions as question on question.id = item.question_id
  where item.mock_session_id = p_session_id
  on conflict (user_id, exam_id, question_external_id)
  do update set
    total_attempts = public.user_question_state.total_attempts + 1,
    correct_attempts = public.user_question_state.correct_attempts
      + case when excluded.last_result then 1 else 0 end,
    wrong_attempts = public.user_question_state.wrong_attempts
      + case when excluded.last_result then 0 else 1 end,
    consecutive_correct = case
      when excluded.last_result
        then public.user_question_state.consecutive_correct + 1
      else 0
    end,
    last_result = excluded.last_result,
    last_attempt_at = excluded.last_attempt_at,
    is_wrong = case
      when excluded.last_result
        then public.user_question_state.is_wrong
      else true
    end,
    review_level = case
      when excluded.last_result
        then public.user_question_state.review_level
      else 0
    end,
    next_review_at = case
      when excluded.last_result
        then public.user_question_state.next_review_at
      else excluded.next_review_at
    end,
    last_wrong_at = coalesce(
      excluded.last_wrong_at,
      public.user_question_state.last_wrong_at
    );

  select jsonb_build_object(
    'questionCount', count(*),
    'correctCount', count(*) filter (where is_correct),
    'byModule', (
      select coalesce(jsonb_agg(row_data order by module_title), '[]'::jsonb)
      from (
        select
          module_title,
          jsonb_build_object(
            'moduleTitle', module_title,
            'questionCount', count(*),
            'correctCount', count(*) filter (where is_correct),
            'score', sum(score),
            'maxScore', sum(weight)
          ) as row_data
        from public.mock_exam_items
        where mock_session_id = p_session_id
        group by module_title
      ) as modules
    ),
    'byType', (
      select coalesce(jsonb_agg(row_data order by question_type), '[]'::jsonb)
      from (
        select
          question_type,
          jsonb_build_object(
            'type', question_type,
            'questionCount', count(*),
            'correctCount', count(*) filter (where is_correct),
            'score', sum(score),
            'maxScore', sum(weight)
          ) as row_data
        from public.mock_exam_items
        where mock_session_id = p_session_id
        group by question_type
      ) as types
    )
  )
  into v_result
  from public.mock_exam_items
  where mock_session_id = p_session_id;

  update public.mock_exam_sessions
  set
    status = 'submitted',
    submitted_at = now(),
    score = (
      select sum(score)
      from public.mock_exam_items
      where mock_session_id = p_session_id
    ),
    result_json = v_result
  where id = p_session_id;

  return public.get_mock_exam_session(p_user_id, p_session_id);
end;
$$;

revoke all on function public.get_mock_exam_setup(uuid)
from public, anon, authenticated;
revoke all on function public.get_mock_exam_session(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.start_mock_exam_session(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.save_mock_exam_answer(
  uuid, uuid, integer, text[]
) from public, anon, authenticated;
revoke all on function public.set_mock_exam_marked(
  uuid, uuid, integer, boolean
) from public, anon, authenticated;
revoke all on function public.submit_mock_exam_session(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.get_mock_exam_setup(uuid)
to service_role;
grant execute on function public.get_mock_exam_session(uuid, uuid)
to service_role;
grant execute on function public.start_mock_exam_session(uuid, uuid)
to service_role;
grant execute on function public.save_mock_exam_answer(
  uuid, uuid, integer, text[]
) to service_role;
grant execute on function public.set_mock_exam_marked(
  uuid, uuid, integer, boolean
) to service_role;
grant execute on function public.submit_mock_exam_session(uuid, uuid)
to service_role;
