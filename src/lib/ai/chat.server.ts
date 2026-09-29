import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { allAgents, delegateTool, OPENAI_OPTIONS, pickTools, systemFor } from "./agents.server";
import { needsApproval, TOOL_CATALOG, type AgentConfig } from "./agents.shared";
import { z } from "zod";
import { loadMcpTools, type McpRow } from "./mcp.server";
import { skillsPrompt, skillTools, type SkillRow } from "./skills.server";
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

export async function handleChat(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || token.split(".").length !== 3) return json(401, "请先登录");
  const supabase = userClient(token);
  const { data: claims, error: authError } = await supabase.auth.getClaims(token);
  const userId = claims?.claims?.sub;
  if (authError || !userId) return json(401, "登录已失效，请重新登录");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, "请求格式不正确");
  const { threadId, agentId } = parsed.data;
  let model: string = parsed.data.model;
  const messages = parsed.data.messages as UIMessage[];

  const { data: thread } = await supabase.from("threads").select("id,title").eq("id", threadId).maybeSingle();
  if (!thread) return json(404, "对话不存在");

  const { data: rows } = await supabase.from("agents").select("id,name,description,system_prompt,model,tool_ids,mcp_tool_ids,skill_ids,delegate_ids,sort_order").order("sort_order").order("created_at");
  const agents = allAgents((rows ?? []) as AgentConfig[]);
  const active = agentId ? agents.find(a => a.id === agentId) ?? null : null;
  if (agentId && !active) return json(404, "Agent 不存在或已被删除");
  if (active && (CHAT_MODELS as readonly string[]).includes(active.model)) model = active.model;

  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    const { error } = await supabase.from("messages").upsert({
      id: last.id, thread_id: threadId, user_id: userId, role: "user", parts: last.parts as unknown as Json,
    });
    if (error) return json(500, "消息保存失败");
    const firstText = last.parts.find(p => p.type === "text");
    const patch: { updated_at: string; model: string; agent_id: string | null; title?: string } = { updated_at: new Date().toISOString(), model, agent_id: agentId ?? null };
    if (thread.title === "新对话" && firstText && "text" in firstText) patch.title = firstText.text.trim().slice(0, 24) || "新对话";
    await supabase.from("threads").update(patch).eq("id", threadId);
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
  let closed = false;
  const closeMcp = () => { if (!closed) { closed = true; void mcp.close(); } };
  request.signal.addEventListener("abort", closeMcp);
  const result = streamText({
    model: provider.responses(model),
    system: `${systemFor(active)}${skillsPrompt(skills)}${delegates.length ? "\n当子任务明显更适合某个专门 Agent 时，调用 delegate_to_agent 委派，然后整合结果回答。" : ""}`,
    messages: await convertToModelMessages(messages),
    tools: { ...pickTools(toolIds), ...mcp.tools, ...skillTools(skills), ...(delegates.length ? { delegate_to_agent: delegateTool(provider, delegates, request.signal) } : {}) },
    stopWhen: stepCountIs(50),
    // 人工批准：MCP 写操作（删除、发送、创建、修改……）暂停，等待用户在卡片上确认。
    toolApproval: ({ toolCall }) => toolCall.toolName in mcp.tools && needsApproval(toolCall.toolName)
      ? { type: "user-approval", reason: `「${mcp.labels[toolCall.toolName] ?? toolCall.toolName}」会修改外部数据，需要你确认` }
      : undefined,
    ...(process.env["MCP_ENC_KEY"] ? { experimental_toolApprovalSecret: `approval:${process.env["MCP_ENC_KEY"]}` } : {}),
    abortSignal: request.signal,
    providerOptions: OPENAI_OPTIONS,
    onFinish: closeMcp,
    onError: closeMcp,
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    generateMessageId: () => crypto.randomUUID(),
    onFinish: async ({ responseMessage }) => {
      if (!responseMessage.parts.length) return;
      const { error } = await supabase.from("messages").upsert({
        id: responseMessage.id, thread_id: threadId, user_id: userId, role: "assistant",
        parts: responseMessage.parts as unknown as Json,
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
