# AI讲题规格

## 1. AI定位

AI是辅导工具，不是真题来源、官方裁判或考试预测机器。

人工内容优先级：

1. 已审核人工解析
2. 已审核知识点
3. 用户笔记
4. AI解释

## 2. 调用上下文

每次调用只发送必要内容：

- 题干
- 选项
- 标准答案（仅在允许显示答案后）
- 人工解析
- 关联知识点摘录
- 用户本次答案
- 用户选择的错误原因
- 输出难度偏好

不得默认发送全部题库或全部个人学习记录。

## 3. 输出结构

推荐服务端要求JSON结构：

```json
{
  "knowledge_point": "本题考查内容",
  "answer_reasoning": ["步骤1", "步骤2"],
  "option_analysis": [
    {"key": "A", "analysis": "为什么对或错"}
  ],
  "common_mistake": "常见误区",
  "memory_tip": "记忆提示",
  "related_concepts": [
    {"name": "概念", "difference": "区别"}
  ],
  "variant_question": {
    "status": "draft",
    "stem": "变式题",
    "answer": "答案",
    "explanation": "解析"
  },
  "uncertainty": null
}
```

JSON解析失败时提供纯文本降级，不允许页面崩溃。

## 4. 系统提示词

```text
你是系统集成项目管理工程师考试辅导老师。
你的任务是依据系统提供的已审核知识点和参考答案进行解释。
不得编造官方题目来源、教材页码、法律条文编号或考试政策。
若资料不足或答案存在争议，明确说明不确定性。
先解释用户为什么会错，再解释正确知识。
涉及计算时列出已知量、公式、代入、结果和单位。
生成的变式题仅为练习草稿，不得声称为真题。
输出必须符合指定JSON结构。
```

## 5. 防止答案泄露

- 未作答练习题：AI默认只能讲知识点，不能直接给选项答案
- 用户主动点击“查看答案”后：可完整讲解
- 模拟考试进行中：禁用题目答案型AI
- 模考提交后：允许分析

## 6. RAG原则

优先从本地已审核内容检索：

- 关联知识点
- 同章节易混概念
- 人工解析
- 公式卡

检索结果带内部内容ID和版本。AI回答页面显示“依据的知识点”，便于用户回看。

第一版不需要复杂向量数据库也可以实现：

1. 先通过题目关联表直接取知识点
2. 再通过标题、标签和全文检索补充
3. 内容规模增大后再评估向量检索

不要为了写“RAG”三个字先搭一座无人居住的技术城市。

## 7. 成本控制

- 每日次数上限
- 单次输入和输出长度限制
- 相同题目的解释缓存
- 用户可选择简洁/详细
- 记录provider、model、tokens、latency
- 管理页显示本月调用统计
- API失败不重复无限重试

## 8. Provider适配

定义统一接口：

```ts
interface AiTutorProvider {
  explainQuestion(input: ExplainQuestionInput): Promise<ExplainQuestionResult>;
  explainConcept(input: ExplainConceptInput): Promise<ExplainConceptResult>;
  generateVariant(input: GenerateVariantInput): Promise<VariantDraft>;
}
```

不得在业务组件中直接调用某个厂商SDK。
