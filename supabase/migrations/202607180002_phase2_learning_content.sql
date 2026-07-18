create table if not exists public.syllabus_nodes (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  parent_id uuid references public.syllabus_nodes(id) on delete restrict,
  external_id text not null,
  node_type text not null check (node_type in ('module', 'chapter', 'section')),
  title text not null,
  description text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, external_id)
);

create table if not exists public.knowledge_points (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  syllabus_node_id uuid not null references public.syllabus_nodes(id)
    on delete restrict,
  external_id text not null,
  title text not null,
  summary text not null,
  content_md text not null default '',
  exam_focus_md text not null default '',
  confusion_md text not null default '',
  work_example_md text not null default '',
  formula_md text not null default '',
  importance text not null check (importance in ('S', 'A', 'B')),
  difficulty integer not null check (difficulty between 1 and 5),
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
    review_status in ('draft', 'reviewed', 'published', 'archived')
  ),
  version integer not null check (version > 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, external_id),
  check (
    review_status <> 'published' or copyright_status <> 'unknown'
  )
);

create table if not exists public.user_knowledge_state (
  user_id uuid not null references public.profiles(id) on delete cascade,
  knowledge_point_id uuid not null references public.knowledge_points(id)
    on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started', 'learning', 'mastered', 'weak')),
  mastery_level numeric(5, 2) not null default 0
    check (mastery_level between 0 and 100),
  first_accuracy numeric(5, 4)
    check (first_accuracy between 0 and 1),
  recent_accuracy numeric(5, 4)
    check (recent_accuracy between 0 and 1),
  review_success_rate numeric(5, 4)
    check (review_success_rate between 0 and 1),
  last_studied_at timestamptz,
  next_review_at timestamptz,
  personal_note_md text not null default '',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, knowledge_point_id)
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  import_type text not null check (import_type in ('knowledge')),
  file_name text not null,
  status text not null
    check (status in ('running', 'completed', 'failed')),
  total_count integer not null default 0 check (total_count >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  errors_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists syllabus_nodes_parent_id_idx
on public.syllabus_nodes(parent_id);

create index if not exists knowledge_points_syllabus_node_id_idx
on public.knowledge_points(syllabus_node_id);

create index if not exists knowledge_points_review_status_idx
on public.knowledge_points(review_status);

drop trigger if exists syllabus_nodes_set_updated_at
on public.syllabus_nodes;
create trigger syllabus_nodes_set_updated_at
before update on public.syllabus_nodes
for each row execute function public.set_updated_at();

drop trigger if exists knowledge_points_set_updated_at
on public.knowledge_points;
create trigger knowledge_points_set_updated_at
before update on public.knowledge_points
for each row execute function public.set_updated_at();

drop trigger if exists user_knowledge_state_set_updated_at
on public.user_knowledge_state;
create trigger user_knowledge_state_set_updated_at
before update on public.user_knowledge_state
for each row execute function public.set_updated_at();

drop trigger if exists import_jobs_set_updated_at
on public.import_jobs;
create trigger import_jobs_set_updated_at
before update on public.import_jobs
for each row execute function public.set_updated_at();

alter table public.syllabus_nodes enable row level security;
alter table public.knowledge_points enable row level security;
alter table public.user_knowledge_state enable row level security;
alter table public.import_jobs enable row level security;

revoke all on table public.syllabus_nodes from anon, authenticated;
revoke all on table public.knowledge_points from anon, authenticated;
revoke all on table public.user_knowledge_state from anon, authenticated;
revoke all on table public.import_jobs from anon, authenticated;

insert into public.syllabus_nodes (
  exam_id,
  external_id,
  node_type,
  title,
  sort_order,
  status,
  version
)
select
  exams.id,
  modules.external_id,
  'module',
  modules.title,
  modules.sort_order,
  'published',
  1
from public.exams as exams
cross join (
  values
    ('module-01', '信息化发展', 1),
    ('module-02', '信息技术发展', 2),
    ('module-03', '信息技术服务', 3),
    ('module-04', '信息系统架构', 4),
    ('module-05', '软件工程', 5),
    ('module-06', '数据工程', 6),
    ('module-07', '软硬件系统集成', 7),
    ('module-08', '信息安全工程', 8),
    ('module-09', '项目管理概论', 9),
    ('module-10', '启动过程组', 10),
    ('module-11', '规划过程组', 11),
    ('module-12', '执行过程组', 12),
    ('module-13', '监控过程组', 13),
    ('module-14', '收尾过程组', 14),
    ('module-15', '组织保障', 15),
    ('module-16', '监理基础知识', 16),
    ('module-17', '法律法规与标准规范', 17),
    ('module-18', '职业道德规范', 18)
) as modules(external_id, title, sort_order)
where exams.code = 'system-integration-project-management-engineer'
on conflict (exam_id, external_id) do nothing;

insert into public.syllabus_nodes (
  exam_id,
  parent_id,
  external_id,
  node_type,
  title,
  sort_order,
  status,
  version
)
select
  modules.exam_id,
  modules.id,
  'chapter-project-and-management',
  'chapter',
  '项目与项目管理',
  1,
  'published',
  1
from public.syllabus_nodes as modules
join public.exams as exams on exams.id = modules.exam_id
where modules.external_id = 'module-09'
  and exams.code = 'system-integration-project-management-engineer'
on conflict (exam_id, external_id) do nothing;

insert into public.knowledge_points (
  exam_id,
  syllabus_node_id,
  external_id,
  title,
  summary,
  content_md,
  exam_focus_md,
  confusion_md,
  work_example_md,
  formula_md,
  importance,
  difficulty,
  source_type,
  source_note,
  copyright_status,
  review_status,
  version,
  published_at
)
select
  chapters.exam_id,
  chapters.id,
  'kp-project-characteristics',
  '项目的基本特征',
  '项目是为了创造独特成果而进行的临时性工作。',
  '项目具有临时性、独特性和渐进明细等特征。临时性表示项目有明确的开始和结束，并不意味着持续时间一定很短。',
  '重点区分项目与持续、重复的运营工作。',
  '临时性描述项目边界，不等于项目成果只能短期存在。',
  '建设一次专题网站属于项目；网站上线后的长期日常维护更接近运营。',
  '',
  'A',
  1,
  'self_authored',
  '依据公开项目管理基本概念整理的原创学习卡片',
  'self_authored',
  'published',
  1,
  now()
from public.syllabus_nodes as chapters
join public.exams as exams on exams.id = chapters.exam_id
where chapters.external_id = 'chapter-project-and-management'
  and exams.code = 'system-integration-project-management-engineer'
on conflict (exam_id, external_id) do nothing;

create or replace function public.import_knowledge_points(
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
  v_path text[];
  v_parent_id uuid;
  v_node_id uuid;
  v_node_external_id text;
  v_item_external_id text;
  v_existing_version integer;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_index integer;
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
    'knowledge',
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

    select array_agg(value order by ordinality)
    into v_path
    from jsonb_array_elements_text(v_item -> 'syllabus_path')
    with ordinality;

    select id
    into v_parent_id
    from public.syllabus_nodes
    where exam_id = v_exam_id
      and parent_id is null
      and title = v_path[1]
      and status = 'published';

    if v_parent_id is null then
      raise exception 'Unknown syllabus module: %', v_path[1];
    end if;

    if array_length(v_path, 1) > 1 then
      for v_index in 2..array_length(v_path, 1)
      loop
        select id
        into v_node_id
        from public.syllabus_nodes
        where exam_id = v_exam_id
          and parent_id = v_parent_id
          and title = v_path[v_index]
          and status <> 'archived'
        limit 1;

        if v_node_id is null then
          v_node_external_id := 'imported-' || substring(
            pg_catalog.md5(array_to_string(v_path[1:v_index], '/'))
            from 1 for 24
          );

          insert into public.syllabus_nodes (
            exam_id,
            parent_id,
            external_id,
            node_type,
            title,
            sort_order,
            status,
            version
          )
          values (
            v_exam_id,
            v_parent_id,
            v_node_external_id,
            case when v_index = 2 then 'chapter' else 'section' end,
            v_path[v_index],
            0,
            'published',
            1
          )
          on conflict (exam_id, external_id) do nothing;

          select id
          into v_node_id
          from public.syllabus_nodes
          where exam_id = v_exam_id
            and external_id = v_node_external_id;
        end if;

        v_parent_id := v_node_id;
      end loop;
    end if;

    select version
    into v_existing_version
    from public.knowledge_points
    where exam_id = v_exam_id
      and external_id = v_item_external_id;

    if v_existing_version is null then
      insert into public.knowledge_points (
        exam_id,
        syllabus_node_id,
        external_id,
        title,
        summary,
        content_md,
        exam_focus_md,
        confusion_md,
        work_example_md,
        formula_md,
        importance,
        difficulty,
        source_type,
        source_note,
        copyright_status,
        review_status,
        version,
        published_at
      )
      values (
        v_exam_id,
        v_parent_id,
        v_item_external_id,
        v_item ->> 'title',
        v_item ->> 'summary',
        v_item ->> 'content_md',
        v_item ->> 'exam_focus_md',
        v_item ->> 'confusion_md',
        v_item ->> 'work_example_md',
        v_item ->> 'formula_md',
        v_item ->> 'importance',
        (v_item ->> 'difficulty')::integer,
        v_item -> 'source' ->> 'type',
        v_item -> 'source' ->> 'note',
        v_item -> 'source' ->> 'copyright_status',
        v_item ->> 'review_status',
        (v_item ->> 'version')::integer,
        case
          when v_item ->> 'review_status' = 'published' then now()
          else null
        end
      );
      v_inserted := v_inserted + 1;
    elsif (v_item ->> 'version')::integer = v_existing_version then
      v_skipped := v_skipped + 1;
    elsif (v_item ->> 'version')::integer > v_existing_version then
      update public.knowledge_points
      set
        syllabus_node_id = v_parent_id,
        title = v_item ->> 'title',
        summary = v_item ->> 'summary',
        content_md = v_item ->> 'content_md',
        exam_focus_md = v_item ->> 'exam_focus_md',
        confusion_md = v_item ->> 'confusion_md',
        work_example_md = v_item ->> 'work_example_md',
        formula_md = v_item ->> 'formula_md',
        importance = v_item ->> 'importance',
        difficulty = (v_item ->> 'difficulty')::integer,
        source_type = v_item -> 'source' ->> 'type',
        source_note = v_item -> 'source' ->> 'note',
        copyright_status = v_item -> 'source' ->> 'copyright_status',
        review_status = v_item ->> 'review_status',
        version = (v_item ->> 'version')::integer,
        published_at = case
          when v_item ->> 'review_status' = 'published'
            then coalesce(published_at, now())
          else published_at
        end
      where exam_id = v_exam_id
        and external_id = v_item_external_id;
      v_updated := v_updated + 1;
    else
      raise exception
        'Version regression for %',
        v_item_external_id;
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

revoke all on function public.import_knowledge_points(uuid, text, jsonb)
from public, anon, authenticated;

grant execute on function public.import_knowledge_points(uuid, text, jsonb)
to service_role;
