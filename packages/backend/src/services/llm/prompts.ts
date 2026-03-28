import type { ExpandMode, PromptTemplates } from './types.js'

export const DEFAULT_SYSTEM_PROMPT = `你是 OpenMindLearn 的学习教练型助手，目标是帮助用户“理解 -> 记住 -> 会用”。

回答原则：
1. 你可以进行充分推理；若输出思考过程，请与最终答案清晰分段，避免混在同一段正文里。
2. 优先使用用户输入语言；未指定时使用简体中文。
3. 先给结论，再给结构化讲解；解释要准确、可验证、避免空话。
4. 适度延伸但不跑题，和当前问题及上下文保持强关联。
5. 对不确定信息明确标注“可能/待确认”，不要编造。
6. 输出使用 Markdown，信息密度优先。`

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplates = {
  directExpand: `请把下面内容扩展成一张高质量学习卡片，目标是让学习者快速理解并能应用。

原始内容：
{{text}}

输出结构（按需增减，避免凑字）：
## 一句话结论
## 核心概念与机制
## 示例（贴近真实场景）
## 易错点 / 边界条件
## 1 个自测问题（不附答案）

要求：
- 与原文强关联，先解释原文再延伸
- 若原文有歧义，先写明你的理解假设`,
  targetedQuestion: `请针对用户的问题给出高质量学习回答。

用户问题/指令：
{{text}}

输出要求：
1. 先直接回答问题，给出明确结论。
2. 再用要点解释关键依据与原理。
3. 给一个最小可用示例或反例。
4. 给一个“下一步可继续追问”的问题。
5. 若信息不足，先说明缺失信息，再给出在当前假设下的答案。`,
  customContextExpand: `请围绕以下“选中文本片段”做上下文一致的深挖扩展，不要偏题。

选中文本：
{{text}}

输出建议：
## 片段在原主题中的作用
## 逐点拆解（术语 / 概念 / 关系）
## 与上游知识的连接
## 示例或类比
## 可继续探索的 2 个方向

要求：
- 先贴合片段，再做必要扩展
- 不要脱离片段另起话题`,
  contextEnvelope: `你正在为 OpenMindLearn 生成学习节点。以下是从上游到当前父节点的上下文链（XML）：

{{contextXml}}

当前任务：
{{prompt}}

请遵循：
1. 把“最后一个节点”视为当前焦点，优先服务它。
2. 上游节点用于补充背景、术语和因果链，不要平均分配篇幅。
3. 若上下文信息冲突，优先采用更接近焦点且更具体的信息，并在答案中简要说明假设。
4. 输出应可直接保存为学习卡片（Markdown）。
5. 不要复述 XML 标签。`
}

export const DEFAULT_ANSWER_ANCHOR_KEYWORDS = ['结论']

export function resolveTemplate(template: string | undefined, fallback: string, requiredTokens: string[]): string {
  const value = (template || '').trim()
  if (!value) return fallback
  let resolved = value
  requiredTokens.forEach((token) => {
    if (!resolved.includes(`{{${token}}}`)) {
      resolved = `${resolved}\n\n{{${token}}}`
    }
  })
  return resolved
}

export function applyTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => variables[key] ?? '')
}

function getExpandPromptTemplate(mode: ExpandMode, templates: PromptTemplates): string {
  if (mode === 'targeted') return templates.targetedQuestion
  if (mode === 'custom_context') return templates.customContextExpand
  return templates.directExpand
}

export function buildExpandPromptFromTemplates(text: string, mode: ExpandMode, templates: PromptTemplates): string {
  const template = getExpandPromptTemplate(mode, templates)
  return applyTemplate(template, { text })
}

export function buildContextPromptFromTemplates(prompt: string, contextXml: string, templates: PromptTemplates): string {
  return applyTemplate(templates.contextEnvelope, {
    prompt,
    contextXml
  })
}
