# 数据模型与导入规范

## 1. 核心表

### profiles

- id
- display_name
- timezone
- role
- created_at
- updated_at

### exams

当前仅一条记录。

- id
- code
- name
- level
- syllabus_version
- config_json
- is_active

### syllabus_nodes

支持无限层级。

- id
- exam_id
- parent_id
- external_id
- node_type: module / chapter / section
- title
- description
- sort_order
- status
- version

### knowledge_points

- id
- exam_id
- syllabus_node_id
- external_id
- title
- summary
- content_md
- exam_focus_md
- confusion_md
- work_example_md
- formula_md
- importance: S / A / B
- difficulty: 1-5
- source_type
- source_note
- copyright_status
- review_status
- version
- published_at
- created_at
- updated_at

### user_knowledge_state

- user_id
- knowledge_point_id
- status
- mastery_level
- first_accuracy
- recent_accuracy
- review_success_rate
- last_studied_at
- next_review_at
- personal_note_md
- is_favorite

### questions

- id
- exam_id
- external_id
- question_type
- stem_md
- answer_json
- explanation_md
- difficulty
- importance
- status
- source_type
- source_note
- copyright_status
- version
- created_at
- updated_at

### question_options

- id
- question_id
- option_key
- content_md
- sort_order

### question_knowledge_points

- question_id
- knowledge_point_id
- weight

### question_tags / question_tag_links

标签示例：

- 高频
- 易错
- 计算题
- 关键路径
- 挣值
- 法规
- 概念辨析

### practice_sessions

- id
- user_id
- mode
- filters_json
- status
- started_at
- completed_at
- elapsed_seconds
- current_index
- summary_json

### practice_session_items

必须保存抽题时的顺序和题目版本。

- session_id
- question_id
- question_version
- position
- answer_json
- is_correct
- confidence
- is_marked
- elapsed_seconds
- answered_at

### question_attempts

每次作答均保留，不覆盖历史。

- id
- user_id
- question_id
- session_id
- answer_json
- is_correct
- score
- confidence
- elapsed_seconds
- error_reason
- created_at

### user_question_state

- user_id
- question_id
- total_attempts
- correct_attempts
- wrong_attempts
- consecutive_correct
- last_result
- last_attempt_at
- is_wrong
- is_favorite
- review_level
- next_review_at
- mastered_at

### mock_exam_templates

- id
- exam_id
- name
- duration_minutes
- blueprint_json
- scoring_json
- status

### mock_exam_sessions

- id
- user_id
- template_id
- status
- started_at
- deadline_at
- submitted_at
- score
- max_score
- result_json

### mock_exam_items

- mock_session_id
- question_id
- question_version
- position
- answer_json
- score
- is_correct
- is_marked
- saved_at

### study_events

用于学习时长和连续天数统计。

- id
- user_id
- event_type
- entity_type
- entity_id
- duration_seconds
- metadata_json
- occurred_at

### ai_conversations / ai_messages

- user_id
- context_type
- context_id
- provider
- model
- prompt_version
- role
- content
- token_usage
- created_at

### import_jobs

- id
- user_id
- import_type
- file_name
- status
- total_count
- inserted_count
- updated_count
- skipped_count
- failed_count
- errors_json
- created_at

## 2. 题目JSON导入规范

```json
{
  "schema_version": "1.0",
  "exam_code": "system-integration-project-management-engineer",
  "items": [
    {
      "external_id": "q-demo-001",
      "type": "single_choice",
      "stem_md": "示例题干",
      "options": [
        {"key": "A", "content_md": "选项A"},
        {"key": "B", "content_md": "选项B"},
        {"key": "C", "content_md": "选项C"},
        {"key": "D", "content_md": "选项D"}
      ],
      "answer": {"keys": ["B"]},
      "explanation_md": "原创解析。",
      "difficulty": 2,
      "importance": "A",
      "knowledge_point_external_ids": ["kp-demo-001"],
      "tags": ["示例"],
      "source": {
        "type": "self_authored",
        "note": "个人原创示例",
        "copyright_status": "self_authored"
      },
      "review_status": "reviewed",
      "version": 1
    }
  ]
}
```

## 3. 知识点JSON导入规范

```json
{
  "schema_version": "1.0",
  "exam_code": "system-integration-project-management-engineer",
  "items": [
    {
      "external_id": "kp-demo-001",
      "syllabus_path": [
        "项目管理概论",
        "项目与项目管理"
      ],
      "title": "项目的基本特征",
      "summary": "项目是为创造独特产品、服务或成果而进行的临时性工作。",
      "content_md": "详细内容由个人整理或合法来源改写。",
      "exam_focus_md": "重点区分临时性和独特性。",
      "confusion_md": "项目与运营的区别。",
      "work_example_md": "完成一次文保项目宣传片交付属于项目；长期日常账号运营更接近运营。",
      "formula_md": "",
      "importance": "A",
      "difficulty": 1,
      "source": {
        "type": "user_note",
        "note": "个人学习笔记",
        "copyright_status": "user_note"
      },
      "review_status": "reviewed",
      "version": 1
    }
  ]
}
```

## 4. 导入校验

必须校验：

- schema_version
- exam_code
- external_id唯一
- 题型合法
- 选项key唯一
- 答案引用有效选项
- 难度1至5
- 重要度S/A/B
- 关联知识点存在
- 来源和版权状态完整
- Markdown大小限制
- 禁止危险HTML

导入过程分为：

1. 上传
2. 解析
3. 校验
4. 预览
5. 用户确认
6. 事务提交
7. 生成导入报告

任何一项失败不得造成半批次脏数据。

## 5. 幂等与版本

- 使用 `external_id` 识别同一内容
- 版本更高时允许更新
- 相同版本默认跳过
- 版本降低默认拒绝
- 被用户作答过的题目更新时，历史记录继续引用旧 `question_version`
- 题目删除使用归档，不物理删除历史引用
