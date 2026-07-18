alter table public.import_jobs
drop constraint if exists import_jobs_import_type_check;

alter table public.import_jobs
add constraint import_jobs_import_type_check
check (import_type in ('knowledge', 'questions'));

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  external_id text not null,
  version integer not null check (version > 0),
  question_type text not null check (
    question_type in ('single_choice', 'multiple_choice', 'true_false')
  ),
  stem_md text not null,
  answer_json jsonb not null,
  explanation_md text not null,
  difficulty integer not null check (difficulty between 1 and 5),
  importance text not null check (importance in ('S', 'A', 'B')),
  tags_json jsonb not null default '[]'::jsonb,
  source_type text not null check (
    source_type in (
      'self_authored',
      'official_public',
      'authorized',
      'user_note',
      'ai_draft'
    )
  ),
  source_note text not null,
  copyright_status text not null check (
    copyright_status in (
      'self_authored',
      'official_public',
      'authorized',
      'user_note',
      'ai_draft',
      'unknown'
    )
  ),
  review_status text not null check (
    review_status in (
      'draft',
      'pending_review',
      'reviewed',
      'published',
      'disputed',
      'archived'
    )
  ),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (exam_id, external_id, version),
  unique (id, version),
  check (jsonb_typeof(answer_json -> 'keys') = 'array'),
  check (jsonb_typeof(tags_json) = 'array'),
  check (
    review_status <> 'published' or copyright_status <> 'unknown'
  )
);

create table if not exists public.question_options (
  question_id uuid not null references public.questions(id)
    on delete cascade,
  option_key text not null check (option_key ~ '^[A-Z]$'),
  content_md text not null,
  sort_order integer not null check (sort_order >= 0),
  primary key (question_id, option_key),
  unique (question_id, sort_order)
);

create table if not exists public.question_knowledge_points (
  question_id uuid not null references public.questions(id)
    on delete cascade,
  knowledge_point_id uuid not null references public.knowledge_points(id)
    on delete restrict,
  weight numeric(5, 4) not null default 1
    check (weight > 0 and weight <= 1),
  primary key (question_id, knowledge_point_id)
);

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (
    mode in ('sequential', 'chapter', 'random', 'unanswered')
  ),
  filters_json jsonb not null default '{}'::jsonb,
  status text not null default 'in_progress' check (
    status in ('created', 'in_progress', 'completed', 'abandoned')
  ),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  elapsed_seconds integer not null default 0
    check (elapsed_seconds >= 0),
  current_index integer not null default 0
    check (current_index >= 0),
  summary_json jsonb not null default '{}'::jsonb
);

create table if not exists public.practice_session_items (
  session_id uuid not null references public.practice_sessions(id)
    on delete cascade,
  question_id uuid not null,
  question_version integer not null check (question_version > 0),
  position integer not null check (position >= 0),
  answer_json jsonb,
  is_correct boolean,
  score numeric(8, 4),
  confidence text check (confidence in ('certain', 'uncertain')),
  is_marked boolean not null default false,
  elapsed_seconds integer not null default 0
    check (elapsed_seconds >= 0),
  answered_at timestamptz,
  primary key (session_id, position),
  unique (session_id, question_id),
  foreign key (question_id, question_version)
    references public.questions(id, version) on delete restrict,
  check (
    (answered_at is null and answer_json is null and is_correct is null)
    or
    (answered_at is not null and answer_json is not null
      and is_correct is not null and confidence is not null)
  )
);

create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id)
    on delete restrict,
  session_id uuid not null references public.practice_sessions(id)
    on delete restrict,
  answer_json jsonb not null,
  is_correct boolean not null,
  score numeric(8, 4) not null,
  confidence text not null check (
    confidence in ('certain', 'uncertain')
  ),
  elapsed_seconds integer not null default 0
    check (elapsed_seconds >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.user_question_state (
  user_id uuid not null references public.profiles(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_external_id text not null,
  total_attempts integer not null default 0 check (total_attempts >= 0),
  correct_attempts integer not null default 0 check (correct_attempts >= 0),
  wrong_attempts integer not null default 0 check (wrong_attempts >= 0),
  last_result boolean,
  last_attempt_at timestamptz,
  is_favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, exam_id, question_external_id)
);

create index if not exists questions_current_lookup_idx
on public.questions(exam_id, external_id, version desc);

create index if not exists questions_practice_pool_idx
on public.questions(exam_id, review_status);

create index if not exists question_knowledge_points_knowledge_idx
on public.question_knowledge_points(knowledge_point_id);

create index if not exists practice_sessions_user_idx
on public.practice_sessions(user_id, started_at desc);

create index if not exists question_attempts_user_question_idx
on public.question_attempts(user_id, question_id, created_at desc);

drop trigger if exists user_question_state_set_updated_at
on public.user_question_state;
create trigger user_question_state_set_updated_at
before update on public.user_question_state
for each row execute function public.set_updated_at();

alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_knowledge_points enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.practice_session_items enable row level security;
alter table public.question_attempts enable row level security;
alter table public.user_question_state enable row level security;

revoke all on table public.questions from anon, authenticated;
revoke all on table public.question_options from anon, authenticated;
revoke all on table public.question_knowledge_points
from anon, authenticated;
revoke all on table public.practice_sessions from anon, authenticated;
revoke all on table public.practice_session_items
from anon, authenticated;
revoke all on table public.question_attempts from anon, authenticated;
revoke all on table public.user_question_state
from anon, authenticated;

create or replace function public.import_questions(
  p_user_id uuid,
  p_file_name text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam_id uuid;
  v_job_id uuid;
  v_item jsonb;
  v_option jsonb;
  v_knowledge_external_id text;
  v_knowledge_id uuid;
  v_question_id uuid;
  v_item_external_id text;
  v_existing_version integer;
  v_item_version integer;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_option_order integer;
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
  where code = p_payload ->> 'exam_code';

  if v_exam_id is null then
    raise exception 'Exam configuration not found';
  end if;

  insert into public.import_jobs (
    user_id,
    import_type,
    file_name,
    status,
    total_count
  )
  values (
    p_user_id,
    'questions',
    p_file_name,
    'running',
    jsonb_array_length(p_payload -> 'items')
  )
  returning id into v_job_id;

  begin
    for v_item in
      select value from jsonb_array_elements(p_payload -> 'items')
    loop
      v_item_external_id := v_item ->> 'external_id';
      v_item_version := (v_item ->> 'version')::integer;

      select max(version)
      into v_existing_version
      from public.questions
      where exam_id = v_exam_id
        and external_id = v_item_external_id;

      if v_existing_version is not null
        and v_item_version = v_existing_version then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      if v_existing_version is not null
        and v_item_version < v_existing_version then
        raise exception
          'Version regression for %',
          v_item_external_id;
      end if;

      for v_knowledge_external_id in
        select value
        from jsonb_array_elements_text(
          v_item -> 'knowledge_point_external_ids'
        )
      loop
        select id
        into v_knowledge_id
        from public.knowledge_points
        where exam_id = v_exam_id
          and external_id = v_knowledge_external_id
          and review_status <> 'archived';

        if v_knowledge_id is null then
          raise exception
            'Unknown knowledge point: %',
            v_knowledge_external_id;
        end if;
      end loop;

      insert into public.questions (
        exam_id,
        external_id,
        version,
        question_type,
        stem_md,
        answer_json,
        explanation_md,
        difficulty,
        importance,
        tags_json,
        source_type,
        source_note,
        copyright_status,
        review_status,
        published_at
      )
      values (
        v_exam_id,
        v_item_external_id,
        v_item_version,
        v_item ->> 'type',
        v_item ->> 'stem_md',
        v_item -> 'answer',
        v_item ->> 'explanation_md',
        (v_item ->> 'difficulty')::integer,
        v_item ->> 'importance',
        v_item -> 'tags',
        v_item -> 'source' ->> 'type',
        v_item -> 'source' ->> 'note',
        v_item -> 'source' ->> 'copyright_status',
        v_item ->> 'review_status',
        case
          when v_item ->> 'review_status' = 'published' then now()
          else null
        end
      )
      returning id into v_question_id;

      v_option_order := 0;
      for v_option in
        select value from jsonb_array_elements(v_item -> 'options')
      loop
        insert into public.question_options (
          question_id,
          option_key,
          content_md,
          sort_order
        )
        values (
          v_question_id,
          v_option ->> 'key',
          v_option ->> 'content_md',
          v_option_order
        );
        v_option_order := v_option_order + 1;
      end loop;

      for v_knowledge_external_id in
        select value
        from jsonb_array_elements_text(
          v_item -> 'knowledge_point_external_ids'
        )
      loop
        select id
        into v_knowledge_id
        from public.knowledge_points
        where exam_id = v_exam_id
          and external_id = v_knowledge_external_id
          and review_status <> 'archived';

        insert into public.question_knowledge_points (
          question_id,
          knowledge_point_id
        )
        values (v_question_id, v_knowledge_id);
      end loop;

      if v_existing_version is null then
        v_inserted := v_inserted + 1;
      else
        v_updated := v_updated + 1;
      end if;
    end loop;

    update public.import_jobs
    set
      status = 'completed',
      inserted_count = v_inserted,
      updated_count = v_updated,
      skipped_count = v_skipped
    where id = v_job_id;

    return jsonb_build_object(
      'job_id', v_job_id,
      'file_name', p_file_name,
      'status', 'completed',
      'inserted', v_inserted,
      'updated', v_updated,
      'skipped', v_skipped,
      'failed', 0,
      'errors', '[]'::jsonb
    );
  exception
    when others then
      update public.import_jobs
      set
        status = 'failed',
        inserted_count = 0,
        updated_count = 0,
        skipped_count = 0,
        failed_count = 1,
        errors_json = jsonb_build_array(
          jsonb_build_object(
            'externalId', coalesce(v_item_external_id, ''),
            'message', sqlerrm
          )
        )
      where id = v_job_id;

      return jsonb_build_object(
        'job_id', v_job_id,
        'file_name', p_file_name,
        'status', 'failed',
        'inserted', 0,
        'updated', 0,
        'skipped', 0,
        'failed', 1,
        'errors', jsonb_build_array(
          jsonb_build_object(
            'externalId', coalesce(v_item_external_id, ''),
            'message', sqlerrm
          )
        )
      );
  end;
end;
$$;

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

  if p_mode not in ('sequential', 'chapter', 'random', 'unanswered')
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
      question.version
    from latest_questions as question
    left join public.question_knowledge_points as link
      on link.question_id = question.id
    left join public.knowledge_points as knowledge
      on knowledge.id = link.knowledge_point_id
    left join syllabus_tree
      on syllabus_tree.id = knowledge.syllabus_node_id
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
  ),
  selected_questions as (
    select
      id,
      version,
      row_number() over (
        order by
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
    raise exception 'No questions available for the selected filters';
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
  v_correct_keys text[];
  v_selected_keys text[];
  v_is_correct boolean;
  v_score numeric(8, 4);
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
    confidence
  )
  values (
    p_user_id,
    v_question.id,
    p_session_id,
    jsonb_build_object('keys', p_selected_keys),
    v_is_correct,
    v_score,
    p_confidence
  );

  insert into public.user_question_state (
    user_id,
    exam_id,
    question_external_id,
    total_attempts,
    correct_attempts,
    wrong_attempts,
    last_result,
    last_attempt_at
  )
  values (
    p_user_id,
    v_question.exam_id,
    v_question.external_id,
    1,
    case when v_is_correct then 1 else 0 end,
    case when v_is_correct then 0 else 1 end,
    v_is_correct,
    now()
  )
  on conflict (user_id, exam_id, question_external_id)
  do update set
    total_attempts = public.user_question_state.total_attempts + 1,
    correct_attempts = public.user_question_state.correct_attempts
      + case when excluded.last_result then 1 else 0 end,
    wrong_attempts = public.user_question_state.wrong_attempts
      + case when excluded.last_result then 0 else 1 end,
    last_result = excluded.last_result,
    last_attempt_at = excluded.last_attempt_at;

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

revoke all on function public.import_questions(uuid, text, jsonb)
from public, anon, authenticated;
revoke all on function public.start_practice_session(
  uuid, text, integer, text
) from public, anon, authenticated;
revoke all on function public.submit_practice_answer(
  uuid, uuid, jsonb, text
) from public, anon, authenticated;

grant execute on function public.import_questions(uuid, text, jsonb)
to service_role;
grant execute on function public.start_practice_session(
  uuid, text, integer, text
) to service_role;
grant execute on function public.submit_practice_answer(
  uuid, uuid, jsonb, text
) to service_role;
