alter table public.practice_sessions
drop constraint if exists practice_sessions_mode_check;

alter table public.practice_sessions
add constraint practice_sessions_mode_check
check (
  mode in ('sequential', 'chapter', 'random', 'unanswered', 'review')
);

alter table public.question_attempts
add column if not exists error_reason text;

alter table public.question_attempts
drop constraint if exists question_attempts_error_reason_check;

alter table public.question_attempts
add constraint question_attempts_error_reason_check
check (
  error_reason is null
  or error_reason in (
    'not_learned',
    'concept_confusion',
    'formula_memory',
    'calculation_error',
    'reading_error',
    'option_trap',
    'time_shortage',
    'careless',
    'other'
  )
);

alter table public.user_question_state
add column if not exists consecutive_correct integer not null default 0,
add column if not exists is_wrong boolean not null default false,
add column if not exists review_level integer not null default 0,
add column if not exists next_review_at timestamptz,
add column if not exists mastered_at timestamptz,
add column if not exists last_wrong_at timestamptz,
add column if not exists error_reason text;

alter table public.user_question_state
drop constraint if exists user_question_state_consecutive_correct_check;

alter table public.user_question_state
add constraint user_question_state_consecutive_correct_check
check (consecutive_correct >= 0);

alter table public.user_question_state
drop constraint if exists user_question_state_review_level_check;

alter table public.user_question_state
add constraint user_question_state_review_level_check
check (review_level between 0 and 5);

alter table public.user_question_state
drop constraint if exists user_question_state_error_reason_check;

alter table public.user_question_state
add constraint user_question_state_error_reason_check
check (
  error_reason is null
  or error_reason in (
    'not_learned',
    'concept_confusion',
    'formula_memory',
    'calculation_error',
    'reading_error',
    'option_trap',
    'time_shortage',
    'careless',
    'other'
  )
);

with wrong_history as (
  select
    state.user_id,
    state.exam_id,
    state.question_external_id,
    max(attempt.created_at) as last_wrong_at
  from public.user_question_state as state
  join public.questions as question
    on question.exam_id = state.exam_id
    and question.external_id = state.question_external_id
  join public.question_attempts as attempt
    on attempt.user_id = state.user_id
    and attempt.question_id = question.id
    and attempt.is_correct = false
  where state.wrong_attempts > 0
  group by
    state.user_id,
    state.exam_id,
    state.question_external_id
)
update public.user_question_state as state
set
  is_wrong = true,
  last_wrong_at = history.last_wrong_at,
  next_review_at = (
    date_trunc(
      'day',
      history.last_wrong_at at time zone 'Asia/Shanghai'
    ) + interval '1 day'
  ) at time zone 'Asia/Shanghai'
from wrong_history as history
where state.user_id = history.user_id
  and state.exam_id = history.exam_id
  and state.question_external_id = history.question_external_id
  and state.next_review_at is null;

create index if not exists user_question_state_review_queue_idx
on public.user_question_state(user_id, next_review_at)
where next_review_at is not null;

create index if not exists question_attempts_user_wrong_idx
on public.question_attempts(user_id, created_at desc)
where is_correct = false;

create or replace function public.start_practice_session(
  p_user_id uuid,
  p_mode text,
  p_count integer,
  p_module_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam_id uuid;
  v_session_id uuid;
  v_inserted_count integer;
begin
  if not exists (
    select 1
    from public.profiles
    where id = p_user_id and role = 'owner'
  ) then
    raise exception 'Owner profile not found';
  end if;

  if p_mode not in (
    'sequential',
    'chapter',
    'random',
    'unanswered',
    'review'
  )
    or p_count < 1
    or p_count > 100 then
    raise exception 'Invalid practice request';
  end if;

  if p_mode = 'chapter' and coalesce(p_module_title, '') = '' then
    raise exception 'Module is required for chapter practice';
  end if;

  select id
  into v_exam_id
  from public.exams
  where code = 'system-integration-project-management-engineer';

  insert into public.practice_sessions (
    user_id,
    mode,
    filters_json,
    status
  )
  values (
    p_user_id,
    p_mode,
    case
      when p_module_title is null then '{}'::jsonb
      else jsonb_build_object('moduleTitle', p_module_title)
    end,
    'in_progress'
  )
  returning id into v_session_id;

  with recursive syllabus_tree as (
    select
      id,
      parent_id,
      title as root_title
    from public.syllabus_nodes
    where exam_id = v_exam_id
      and parent_id is null
      and status = 'published'
    union all
    select
      child.id,
      child.parent_id,
      parent.root_title
    from public.syllabus_nodes as child
    join syllabus_tree as parent on parent.id = child.parent_id
    where child.status = 'published'
  ),
  latest_questions as (
    select distinct on (external_id)
      id,
      external_id,
      version,
      review_status
    from public.questions
    where exam_id = v_exam_id
    order by external_id, version desc
  ),
  eligible_questions as (
    select distinct
      question.id,
      question.external_id,
      question.version,
      state.next_review_at
    from latest_questions as question
    left join public.question_knowledge_points as link
      on link.question_id = question.id
    left join public.knowledge_points as knowledge
      on knowledge.id = link.knowledge_point_id
    left join syllabus_tree
      on syllabus_tree.id = knowledge.syllabus_node_id
    left join public.user_question_state as state
      on state.user_id = p_user_id
      and state.exam_id = v_exam_id
      and state.question_external_id = question.external_id
    where question.review_status = 'published'
      and (
        p_mode <> 'chapter'
        or syllabus_tree.root_title = p_module_title
      )
      and (
        p_mode <> 'unanswered'
        or not exists (
          select 1
          from public.question_attempts as attempt
          join public.questions as attempted_question
            on attempted_question.id = attempt.question_id
          where attempt.user_id = p_user_id
            and attempted_question.exam_id = v_exam_id
            and attempted_question.external_id = question.external_id
        )
      )
      and (
        p_mode <> 'review'
        or (
          state.next_review_at is not null
          and state.next_review_at <= now()
        )
      )
  ),
  selected_questions as (
    select
      id,
      version,
      row_number() over (
        order by
          case
            when p_mode = 'review' then next_review_at
          end asc nulls last,
          case
            when p_mode = 'random'
              then md5(id::text || random()::text)
            else external_id
          end
      ) - 1 as position
    from eligible_questions
    limit p_count
  )
  insert into public.practice_session_items (
    session_id,
    question_id,
    question_version,
    position
  )
  select
    v_session_id,
    id,
    version,
    position
  from selected_questions;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count = 0 then
    if p_mode = 'review' then
      raise exception 'No due or overdue mistakes';
    end if;
    raise exception 'No questions available for the selected filters';
  end if;

  return jsonb_build_object('session_id', v_session_id);
end;
$$;

create or replace function public.start_review_session(
  p_user_id uuid,
  p_count integer,
  p_question_external_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam_id uuid;
  v_session_id uuid;
  v_inserted_count integer;
begin
  if not exists (
    select 1
    from public.profiles
    where id = p_user_id and role = 'owner'
  ) then
    raise exception 'Owner profile not found';
  end if;

  if p_count < 1 or p_count > 100 then
    raise exception 'Invalid review request';
  end if;

  select id
  into v_exam_id
  from public.exams
  where code = 'system-integration-project-management-engineer';

  insert into public.practice_sessions (
    user_id,
    mode,
    filters_json,
    status
  )
  values (
    p_user_id,
    'review',
    case
      when p_question_external_id is null then '{}'::jsonb
      else jsonb_build_object(
        'questionExternalId',
        p_question_external_id
      )
    end,
    'in_progress'
  )
  returning id into v_session_id;

  with latest_questions as (
    select distinct on (external_id)
      id,
      external_id,
      version,
      review_status
    from public.questions
    where exam_id = v_exam_id
    order by external_id, version desc
  ),
  selected_questions as (
    select
      question.id,
      question.version,
      row_number() over (
        order by state.next_review_at asc nulls last,
          question.external_id
      ) - 1 as position
    from latest_questions as question
    join public.user_question_state as state
      on state.user_id = p_user_id
      and state.exam_id = v_exam_id
      and state.question_external_id = question.external_id
    where question.review_status = 'published'
      and state.wrong_attempts > 0
      and (
        (
          p_question_external_id is null
          and state.next_review_at is not null
          and state.next_review_at <= now()
        )
        or question.external_id = p_question_external_id
      )
    limit p_count
  )
  insert into public.practice_session_items (
    session_id,
    question_id,
    question_version,
    position
  )
  select
    v_session_id,
    id,
    version,
    position
  from selected_questions;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count = 0 then
    if p_question_external_id is not null then
      raise exception 'Mistake not found';
    end if;
    raise exception 'No due or overdue mistakes';
  end if;

  return jsonb_build_object('session_id', v_session_id);
end;
$$;

create or replace function public.submit_practice_answer(
  p_user_id uuid,
  p_session_id uuid,
  p_selected_keys jsonb,
  p_confidence text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.practice_sessions%rowtype;
  v_item public.practice_session_items%rowtype;
  v_question public.questions%rowtype;
  v_state public.user_question_state%rowtype;
  v_correct_keys text[];
  v_selected_keys text[];
  v_is_correct boolean;
  v_score numeric(8, 4);
  v_consecutive_correct integer := 0;
  v_is_wrong boolean := false;
  v_review_level integer := 0;
  v_next_review_at timestamptz;
  v_mastered_at timestamptz;
  v_last_wrong_at timestamptz;
  v_error_reason text;
  v_interval_days integer;
begin
  if p_confidence is null
    or p_confidence not in ('certain', 'uncertain')
    or p_selected_keys is null
    or jsonb_typeof(p_selected_keys) <> 'array' then
    raise exception 'Invalid answer';
  end if;

  select *
  into v_session
  from public.practice_sessions
  where id = p_session_id
    and user_id = p_user_id
  for update;

  if v_session.id is null then
    raise exception 'Practice session not found';
  end if;

  select *
  into v_item
  from public.practice_session_items
  where session_id = p_session_id
    and position = v_session.current_index
  for update;

  if v_item.answered_at is not null then
    raise exception 'Question already answered';
  end if;

  select *
  into v_question
  from public.questions
  where id = v_item.question_id;

  if jsonb_array_length(p_selected_keys) = 0
    or (
      select count(*) <> count(distinct value)
      from jsonb_array_elements_text(p_selected_keys)
    )
    or exists (
      select 1
      from jsonb_array_elements_text(p_selected_keys) as selected(value)
      where not exists (
        select 1
        from public.question_options
        where question_id = v_question.id
          and option_key = selected.value
      )
    ) then
    raise exception 'Invalid answer options';
  end if;

  select array_agg(value order by value)
  into v_correct_keys
  from jsonb_array_elements_text(v_question.answer_json -> 'keys');

  select array_agg(value order by value)
  into v_selected_keys
  from jsonb_array_elements_text(p_selected_keys);

  v_is_correct := v_correct_keys = v_selected_keys;
  v_score := case when v_is_correct then 1 else 0 end;

  select *
  into v_state
  from public.user_question_state
  where user_id = p_user_id
    and exam_id = v_question.exam_id
    and question_external_id = v_question.external_id
  for update;

  if v_state.user_id is not null then
    v_consecutive_correct := v_state.consecutive_correct;
    v_is_wrong := v_state.is_wrong;
    v_review_level := v_state.review_level;
    v_next_review_at := v_state.next_review_at;
    v_mastered_at := v_state.mastered_at;
    v_last_wrong_at := v_state.last_wrong_at;
    v_error_reason := v_state.error_reason;
  end if;

  if not v_is_correct then
    v_consecutive_correct := 0;
    v_is_wrong := true;
    v_review_level := 0;
    v_mastered_at := null;
    v_last_wrong_at := now();
    v_interval_days := 1;
    v_next_review_at := (
      date_trunc('day', now() at time zone 'Asia/Shanghai')
      + make_interval(days => v_interval_days)
    ) at time zone 'Asia/Shanghai';
  elsif v_next_review_at is not null then
    v_review_level := least(
      5,
      v_review_level + case
        when p_confidence = 'certain' then 2
        else 1
      end
    );
    v_consecutive_correct := v_consecutive_correct + 1;
    v_is_wrong := v_consecutive_correct < 2;
    if v_consecutive_correct >= 2 then
      v_mastered_at := coalesce(v_mastered_at, now());
    else
      v_mastered_at := null;
    end if;
    v_interval_days := (array[1, 3, 7, 14, 30, 60])[
      v_review_level + 1
    ];
    v_next_review_at := (
      date_trunc('day', now() at time zone 'Asia/Shanghai')
      + make_interval(days => v_interval_days)
    ) at time zone 'Asia/Shanghai';
  end if;

  update public.practice_session_items
  set
    answer_json = jsonb_build_object('keys', p_selected_keys),
    is_correct = v_is_correct,
    score = v_score,
    confidence = p_confidence,
    is_marked = p_confidence = 'uncertain',
    answered_at = now()
  where session_id = p_session_id
    and position = v_session.current_index;

  insert into public.question_attempts (
    user_id,
    question_id,
    session_id,
    answer_json,
    is_correct,
    score,
    confidence,
    error_reason
  )
  values (
    p_user_id,
    v_question.id,
    p_session_id,
    jsonb_build_object('keys', p_selected_keys),
    v_is_correct,
    v_score,
    p_confidence,
    case when v_is_correct then null else v_error_reason end
  );

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
    last_wrong_at,
    error_reason
  )
  values (
    p_user_id,
    v_question.exam_id,
    v_question.external_id,
    1,
    case when v_is_correct then 1 else 0 end,
    case when v_is_correct then 0 else 1 end,
    v_consecutive_correct,
    v_is_correct,
    now(),
    v_is_wrong,
    v_review_level,
    v_next_review_at,
    v_mastered_at,
    v_last_wrong_at,
    v_error_reason
  )
  on conflict (user_id, exam_id, question_external_id)
  do update set
    total_attempts = public.user_question_state.total_attempts + 1,
    correct_attempts = public.user_question_state.correct_attempts
      + case when excluded.last_result then 1 else 0 end,
    wrong_attempts = public.user_question_state.wrong_attempts
      + case when excluded.last_result then 0 else 1 end,
    consecutive_correct = excluded.consecutive_correct,
    last_result = excluded.last_result,
    last_attempt_at = excluded.last_attempt_at,
    is_wrong = excluded.is_wrong,
    review_level = excluded.review_level,
    next_review_at = excluded.next_review_at,
    mastered_at = excluded.mastered_at,
    last_wrong_at = excluded.last_wrong_at,
    error_reason = excluded.error_reason;

  if not exists (
    select 1
    from public.practice_session_items
    where session_id = p_session_id
      and answered_at is null
  ) then
    update public.practice_sessions
    set
      status = 'completed',
      completed_at = now()
    where id = p_session_id;
  end if;

  return jsonb_build_object(
    'is_correct', v_is_correct,
    'score', v_score
  );
end;
$$;

create or replace function public.set_mistake_reason(
  p_user_id uuid,
  p_question_external_id text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam_id uuid;
begin
  if not exists (
    select 1
    from public.profiles
    where id = p_user_id and role = 'owner'
  ) then
    raise exception 'Owner profile not found';
  end if;

  if p_reason not in (
    'not_learned',
    'concept_confusion',
    'formula_memory',
    'calculation_error',
    'reading_error',
    'option_trap',
    'time_shortage',
    'careless',
    'other'
  ) then
    raise exception 'Invalid mistake reason';
  end if;

  select id
  into v_exam_id
  from public.exams
  where code = 'system-integration-project-management-engineer';

  update public.user_question_state
  set error_reason = p_reason
  where user_id = p_user_id
    and exam_id = v_exam_id
    and question_external_id = p_question_external_id
    and wrong_attempts > 0;

  if not found then
    raise exception 'Mistake not found';
  end if;

  update public.question_attempts
  set error_reason = p_reason
  where id = (
    select attempt.id
    from public.question_attempts as attempt
    join public.questions as question
      on question.id = attempt.question_id
    where attempt.user_id = p_user_id
      and question.exam_id = v_exam_id
      and question.external_id = p_question_external_id
      and attempt.is_correct = false
    order by attempt.created_at desc
    limit 1
  );
end;
$$;

create or replace function public.mark_mistake_mastered(
  p_user_id uuid,
  p_question_external_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam_id uuid;
begin
  if not exists (
    select 1
    from public.profiles
    where id = p_user_id and role = 'owner'
  ) then
    raise exception 'Owner profile not found';
  end if;

  select id
  into v_exam_id
  from public.exams
  where code = 'system-integration-project-management-engineer';

  update public.user_question_state
  set
    is_wrong = false,
    next_review_at = null,
    mastered_at = now()
  where user_id = p_user_id
    and exam_id = v_exam_id
    and question_external_id = p_question_external_id
    and wrong_attempts > 0;

  if not found then
    raise exception 'Mistake not found';
  end if;
end;
$$;

revoke all on function public.start_practice_session(
  uuid, text, integer, text
) from public, anon, authenticated;
revoke all on function public.submit_practice_answer(
  uuid, uuid, jsonb, text
) from public, anon, authenticated;
revoke all on function public.start_review_session(
  uuid, integer, text
) from public, anon, authenticated;
revoke all on function public.set_mistake_reason(
  uuid, text, text
) from public, anon, authenticated;
revoke all on function public.mark_mistake_mastered(
  uuid, text
) from public, anon, authenticated;

grant execute on function public.start_practice_session(
  uuid, text, integer, text
) to service_role;
grant execute on function public.submit_practice_answer(
  uuid, uuid, jsonb, text
) to service_role;
grant execute on function public.start_review_session(
  uuid, integer, text
) to service_role;
grant execute on function public.set_mistake_reason(
  uuid, text, text
) to service_role;
grant execute on function public.mark_mistake_mastered(
  uuid, text
) to service_role;
