import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, type ToolSet, type UIMessage } from "ai";
import { allAgents, delegateActionTool, delegateTool, OPENAI_OPTIONS, pickTools, systemFor } from "./agents.server";
import { needsApproval, TOOL_CATALOG, type AgentConfig } from "./agents.shared";
import { z } from "zod";
import { loadMcpTools, type McpRow } from "./mcp.server";
import { runnableSkills, skillsPrompt, skillTools, type SkillRow } from "./skills.server";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server";

export const CHAT_MODELS = ["openai/gpt-6-astra", "openai/gpt-6-sol", "openai/gpt-6-luna"] as const;
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const bodySchema = z.object({
  threadId: z.string().uuid(),
  model: z.enum(CHAT_MODELS).default("openai/gpt-6-astra"),
  agentId: z.string().max(80).nullish(),
  messages: z.array(z.any()).min(1).max(200),
  regeneratedFrom: z.string().max(120).nullish(),
});

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json" } });

function userClient(token: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || token.split(".").length !== 3) return json(401, "请先登录");
  const supabase = userClient(token);
  const { data: claims, error: authError } = await supabase.auth.getClaims(token);
  const userId = claims?.claims?.sub;
  if (authError || !userId) return json(401, "登录已失效，请重新登录");
  return { supabase, userId };
}

const textOf = (m: UIMessage) => m.parts.filter(p => p.type === "text").map(p => (p as { text: string }).text).join("\n").trim();

/** /compact：把当前对话压缩成摘要存到 thread，之后的请求用「摘要 + 摘要之后的消息」代替完整历史。 */
export async function handleCompact(request: Request) {
  const a = await auth(request);
  if (a instanceof Response) return a;
  const parsed = z.object({ threadId: z.string().uuid(), messages: z.array(z.any()).min(1).max(400) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, "请求格式不正确");
  const messages = parsed.data.messages as UIMessage[];
  const last = messages[messages.length - 1]!;
  if (last.role !== "assistant") return json(400, "请等回复完成后再压缩");
  const { data: thread } = await a.supabase.from("threads").select("id,summary").eq("id", parsed.data.threadId).maybeSingle();
  if (!thread) return json(404, "对话不存在");
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return json(500, "AI 服务未配置");
  const transcript = messages.map(m => `${m.role === "user" ? "用户" : "助手"}：${textOf(m)}`).filter(l => !l.endsWith("：")).join("\n\n").slice(-60000);
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({ baseURL: GATEWAY, apiKey, headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" }, fetch: runIdFetch.fetch });
  try {
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system: "你负责压缩对话历史。用简体中文输出一份结构化摘要（不超过 400 字）：用户目标、已确定的结论与数据、做过的操作、未完成事项。只输出摘要本身。",
      prompt: `${thread.summary ? `此前的摘要：\n${thread.summary}\n\n` : ""}之后的对话：\n${transcript}`,
      abortSignal: request.signal,
      providerOptions: { openai: { ...OPENAI_OPTIONS.openai, reasoningEffort: "low" } },
    });
    const summary = (await result.text).trim();
    if (!summary) return json(502, "摘要生成失败，请稍后重试");
    const { error } = await a.supabase.from("threads").update({ summary, summary_upto: last.id }).eq("id", thread.id);
    if (error) return json(500, "摘要保存失败");
    return withLovableAiGatewayRunIdHeader(Response.json({ summary, summaryUpto: last.id }), runIdFetch);
  } catch (e) {
    const status = (e as { statusCode?: number })?.statusCode;
    if (status === 402) return json(402, "AI 额度不足，请在 设置 → 套餐与额度 中充值后再试。");
    if (status === 429) return json(429, "请求过于频繁，请稍后再试。");
    return json(500, "摘要生成失败，请稍后重试");
  }
}

export async function handleChat(request: Request) {
  const a = await auth(request);
  if (a instanceof Response) return a;
  const { supabase, userId } = a;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, "请求格式不正确");
  const { threadId, agentId } = parsed.data;
  let model: string = parsed.data.model;
  const messages = parsed.data.messages as UIMessage[];

  const { data: thread } = await supabase.from("threads").select("id,title,summary,summary_upto,permission,plan_mode").eq("id", threadId).maybeSingle();
  if (!thread) return json(404, "对话不存在");

  const { data: rows } = await supabase.from("agents").select("id,name,description,system_prompt,model,tool_ids,mcp_tool_ids,skill_ids,delegate_ids,sort_order").order("sort_order").order("created_at");
  const agents = allAgents((rows ?? []) as AgentConfig[]);
  const active = agentId ? agents.find(a => a.id === agentId) ?? null : null;
  if (agentId && !active) return json(404, "Agent 不存在或已被删除");
  if (active && (CHAT_MODELS as readonly string[]).includes(active.model)) model = active.model;

  const last = messages[messages.length - 1];
  // 消息分支：每个回复挂在它回答的提问下（parent_id），同一提问下多个回复即多个版本。
  let parentId: string | null = null;
  let versionMeta: Record<string, unknown> | null = null;
  if (last?.role === "user") {
    parentId = last.id;
    const { error } = await supabase.from("messages").upsert({
      id: last.id, thread_id: threadId, user_id: userId, role: "user", parts: last.parts as unknown as Json,
    });
    if (error) return json(500, "消息保存失败");
    const firstText = last.parts.find(p => p.type === "text");
    const patch: { updated_at: string; model: string; agent_id: string | null; title?: string } = { updated_at: new Date().toISOString(), model, agent_id: agentId ?? null };
    if (thread.title === "新对话" && firstText && "text" in firstText) patch.title = firstText.text.trim().slice(0, 24) || "新对话";
    await supabase.from("threads").update(patch).eq("id", threadId);
    const regeneratedFrom = parsed.data.regeneratedFrom ?? null;
    if (regeneratedFrom) await supabase.from("messages").update({ parent_id: last.id }).eq("id", regeneratedFrom).is("parent_id", null);
    const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("thread_id", threadId).eq("role", "assistant").eq("parent_id", last.id);
    versionMeta = {
      parentId, version: (count ?? 0) + 1,
      regeneratedFrom, model, agentId: agentId ?? null, createdAt: new Date().toISOString(),
      event: regeneratedFrom ? "version.created" : "reply.created",
    };
  } else if (last?.role === "assistant") {
    const idx = messages.length - 2;
    parentId = idx >= 0 && messages[idx]?.role === "user" ? messages[idx]!.id : null;
  }

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return json(500, "AI 服务未配置");
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  // 编排：选中 Agent 时用它的提示词+工具+MCP+Skills，否则通用助手拥有全部能力；都可以委派给其他 Agent。
  const toolIds = active ? active.tool_ids : TOOL_CATALOG.map(t => t.id);
  const { data: mcpRows } = await supabase.from("mcp_connections").select("id,name,url,auth_type,header_name,proxy_url,secret_enc,state,disabled_tools");
  const mcp = await loadMcpTools((mcpRows ?? []) as McpRow[], active ? (active.mcp_tool_ids ?? []) : "all");
  const { data: skillRows } = await supabase.from("skills").select("id,name,description,source_type,source_url,ref,path,content,files").eq("enabled", true);
  const skills = ((skillRows ?? []) as SkillRow[]).filter(s => !active || (active.skill_ids ?? []).includes(s.id));
  const others = agents.filter(a => a.id !== active?.id);
  const delegates = active && !active.builtin && (active.delegate_ids ?? []).length ? others.filter(a => active.delegate_ids!.includes(a.id)) : active && !active.builtin ? [] : others;
  const subRes = { mcpRows: (mcpRows ?? []) as McpRow[], skillRows: (skillRows ?? []) as SkillRow[], store: { supabase, userId } };
  let closed = false;
  const closeMcp = () => { if (!closed) { closed = true; void mcp.close(); } };
  request.signal.addEventListener("abort", closeMcp);
  // 对话状态：/permission 决定写操作是否需确认或被禁用；/plan 只规划不执行；/compact 用摘要替代早期历史。
  const permission = thread.permission === "auto" || thread.permission === "readonly" ? thread.permission : "ask";
  const readOnly = permission === "readonly" || thread.plan_mode;
  const isWrite = (name: string) => name === "run_skill_script" || name === "run_js" || name === "delegate_action" || (name in mcp.tools && needsApproval(name));
  const allTools: ToolSet = { ...pickTools(toolIds), ...mcp.tools, ...skillTools(skills), ...(delegates.length ? { delegate_to_agent: delegateTool(provider, delegates, request.signal, subRes), delegate_action: delegateActionTool(provider, delegates, request.signal, subRes) } : {}) };
  const tools = readOnly ? Object.fromEntries(Object.entries(allTools).filter(([n]) => !isWrite(n))) : allTools;
  const cut = thread.summary && thread.summary_upto ? messages.findIndex(m => m.id === thread.summary_upto) : -1;
  const history = cut >= 0 ? messages.slice(cut + 1) : messages;
  const stateNote = `${cut >= 0 ? `\n\n【早期对话摘要】\n${thread.summary}` : ""}${thread.plan_mode ? "\n\n【计划模式】只制定计划，不执行任何修改外部数据的操作。可以用只读工具（搜索、读取）收集信息，然后输出编号的分步计划：每步写清做什么、用哪个工具或 Agent、预期结果，最后询问用户是否按计划执行。" : permission === "readonly" ? "\n\n【只读权限】当前对话禁止删除、发送、创建、修改和运行脚本，如用户要求这类操作，说明需要先用 /permission 调整权限。" : ""}`;
  const result = streamText({
    model: provider.responses(model),
    system: `${systemFor(active)}${skillsPrompt(skills)}${delegates.length ? "\n当子任务明显更适合某个专门 Agent 时，调用 delegate_to_agent 委派，然后整合结果回答。" : ""}${stateNote}`,
    messages: await convertToModelMessages(history.length ? history : messages),
    tools: tools as ToolSet,
    stopWhen: stepCountIs(50),
    // 人工批准：MCP 写操作（删除、发送、创建、修改……）暂停，等待用户在卡片上确认。
    toolApproval: ({ toolCall }) => {
      if (!toolCall || permission === "auto") return undefined;
      if (toolCall.toolName === "run_skill_script") return { type: "user-approval", reason: "将在云沙箱中运行 Skill 脚本，需要你确认" };
      if (toolCall.toolName === "delegate_action") {
        const i = toolCall.input as { agent_id?: string; tool?: string } | undefined;
        const who = delegates.find(a => a.id === i?.agent_id)?.name ?? "子 Agent";
        return { type: "user-approval", reason: `「${who}」请求执行「${(i?.tool ?? "").replace(/^m\d+_/, "")}」，会修改外部数据，批准后子任务会继续执行后续步骤` };
      }
      if (toolCall.toolName === "delegate_to_agent") {
        const target = delegates.find(a => a.id === (toolCall.input as { agent_id?: string } | undefined)?.agent_id);
        const runnable = target ? runnableSkills(((skillRows ?? []) as SkillRow[]).filter(s => (target.skill_ids ?? []).includes(s.id))) : [];
        if (target && runnable.length) return { type: "user-approval", reason: `「${target.name}」可能在云沙箱中运行 Skill 脚本（${runnable.map(s => s.name).join("、")}），批准后本次子任务内可直接运行` };
      }
      if (toolCall.toolName in mcp.tools && needsApproval(toolCall.toolName)) return { type: "user-approval", reason: `「${mcp.labels[toolCall.toolName] ?? toolCall.toolName}」会修改外部数据，需要你确认` };
      return undefined;
    },
    ...(process.env["MCP_ENC_KEY"] ? { experimental_toolApprovalSecret: `approval:${process.env["MCP_ENC_KEY"]}` } : {}),
    abortSignal: request.signal,
    providerOptions: OPENAI_OPTIONS,
    onFinish: closeMcp,
    onError: closeMcp,
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    // 版本变化写进事件流：start 事件携带 metadata（第几版、从哪条重新生成），前端据此归组切换。
    messageMetadata: ({ part }) => (part.type === "start" && versionMeta ? versionMeta : undefined),
    generateMessageId: () => crypto.randomUUID(),
    onFinish: async ({ responseMessage }) => {
      if (!responseMessage.parts.length) return;
      const { error } = await supabase.from("messages").upsert({
        id: responseMessage.id, thread_id: threadId, user_id: userId, role: "assistant",
        parts: responseMessage.parts as unknown as Json,
        parent_id: parentId, selected_at: new Date().toISOString(),
        ...(versionMeta ? { metadata: versionMeta as unknown as Json } : {}),
      });
      if (error) console.error("save assistant message failed", error.message);
      await supabase.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
    },
    onError: (error) => {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 402) return "AI 额度不足，请在 设置 → 套餐与额度 中充值后再试。";
      if (status === 429) return "请求过于频繁，请稍后再试。";
      if (status === 403) return "当前模型暂不可用（访问被拒绝）。";
      return "生成回复时出错，请稍后重试。";
    },
  });
  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}
