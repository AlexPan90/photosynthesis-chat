import { stepCountIs, streamText, tool, type JSONValue, type ModelMessage, type ToolSet } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { chatTools } from "./tools.server";
import { BUILTIN_AGENTS, needsApproval, type AgentConfig } from "./agents.shared";
import { loadMcpTools, type McpRow } from "./mcp.server";
import { skillsPrompt, skillTools, type SkillRow } from "./skills.server";

/** 子 Agent 的能力来源：用户的 MCP 连接和已启用 Skills，按该 Agent 的绑定临时加载。 */
export type DelegateResources = { mcpRows: McpRow[]; skillRows: SkillRow[]; store?: { supabase: SupabaseClient<Database>; userId: string } };

type Provider = ReturnType<typeof createOpenAI>;

export const OPENAI_OPTIONS = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "medium",
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
} as const;

const BASE = "默认使用简体中文回答，表达简洁清晰，适当使用 Markdown（标题、列表、表格、代码块）。需要时主动调用工具，再基于结果回答。";

export function pickTools(ids: string[]): ToolSet {
  const all = chatTools as unknown as ToolSet;
  return Object.fromEntries(ids.filter(id => id in all).map(id => [id, all[id]!]));
}

export function systemFor(agent: AgentConfig | null) {
  if (!agent) return `你是 Relay Studio 中的 AI 助手。${BASE}`;
  return `你是「${agent.name}」。${agent.description ? `职责：${agent.description}。` : ""}\n${agent.system_prompt}\n${BASE}`;
}

export type DelegateStep = { tool: string; state: "running" | "done" | "error"; detail?: string };
type Pending = { toolCallId: string; tool: string; label: string; input: unknown };
export type DelegateProgress = { agentId: string; agentName: string; status: "running" | "done" | "error" | "awaiting-approval"; steps: DelegateStep[]; text: string; error?: string; pending?: Pending; sessionId?: string };

const snap = (p: DelegateProgress) => ({ ...p, steps: p.steps.map(s => ({ ...s })) });

/** 运行子 Agent 直到完成或遇到写操作暂停；暂停时把对话历史存入 delegate_sessions，批准后可从断点继续。 */
async function* runSub(provider: Provider, agent: AgentConfig, res: DelegateResources, signal: AbortSignal, history: ModelMessage[], p: DelegateProgress) {
  const mcp = await loadMcpTools(res.mcpRows, agent.mcp_tool_ids ?? []);
  const skills = res.skillRows.filter(s => (agent.skill_ids ?? []).includes(s.id));
  const writeNames = new Set(Object.keys(mcp.tools).filter(needsApproval));
  const mcpTools: ToolSet = Object.fromEntries(Object.entries(mcp.tools).map(([name, t]) => [name, writeNames.has(name)
    ? tool({ description: `${t.description ?? ""}（需用户批准：调用后子任务暂停，批准后你会收到执行结果并继续）`, inputSchema: t.inputSchema as never, execute: async () => "已提交给用户批准。" })
    : t]));
  const label = (name: string) => mcp.labels[name] ?? name;
  p.pending = undefined as never; delete p.pending; p.status = "running";
  try {
    const result = streamText({
      model: provider.responses(agent.model),
      system: `${systemFor(agent)}${skillsPrompt(skills)}${writeNames.size ? `\n以下操作会修改外部数据，调用后子任务会暂停等待用户批准，批准后你会拿到真实结果并继续后续步骤：${[...writeNames].map(label).join("、")}。一次只调用一个这类操作。` : ""}`,
      messages: history,
      tools: { ...pickTools(agent.tool_ids.filter(id => id !== "run_js")), ...mcpTools, ...skillTools(skills) }, // 浏览器端工具无法在子 Agent 中执行
      stopWhen: [stepCountIs(50), ({ steps }) => !!steps.at(-1)?.toolCalls.some(c => writeNames.has(c.toolName))],
      abortSignal: signal,
      providerOptions: OPENAI_OPTIONS,
    });
    const running = (name: string) => [...p.steps].reverse().find(x => x.tool === label(name) && x.state === "running");
    let last = 0;
    for await (const part of result.fullStream) {
      if (part.type === "tool-call" && writeNames.has(part.toolName)) { if (!p.pending) { p.pending = { toolCallId: part.toolCallId, tool: part.toolName, label: label(part.toolName), input: part.input }; p.steps.push({ tool: label(part.toolName), state: "running", detail: "等待你批准" }); } }
      else if (part.type === "tool-result" && writeNames.has(part.toolName)) continue;
      else if (part.type === "tool-call") p.steps.push({ tool: label(part.toolName), state: "running", detail: JSON.stringify(part.input) });
      else if (part.type === "tool-result") { const s = running(part.toolName); if (s) s.state = "done"; }
      else if (part.type === "tool-error") { const s = running(part.toolName); if (s) { s.state = "error"; s.detail = String((part.error as Error)?.message ?? part.error); } }
      else if (part.type === "text-delta") p.text += part.text;
      else if (part.type === "error") throw part.error instanceof Error ? part.error : new Error("子 Agent 执行失败");
      else continue;
      const now = Date.now();
      if (part.type !== "text-delta" || now - last > 250) { last = now; yield snap(p); }
    }
    const pending = p.pending as Pending | undefined;
    if (pending) {
      const store = res.store;
      if (!store) throw new Error("无法保存子任务进度");
      // 去掉占位的工具结果，批准后用真实结果补上。
      const added = (await result.response).messages
        .map(m => m.role === "tool" ? { ...m, content: m.content.filter(c => !("toolCallId" in c) || c.toolCallId !== pending.toolCallId) } : m)
        .filter(m => m.role !== "tool" || m.content.length);
      const row = { user_id: store.userId, agent_id: agent.id, messages: [...history, ...added] as unknown as Json, pending: pending as unknown as Json, updated_at: new Date().toISOString() };
      if (p.sessionId) { const { error } = await store.supabase.from("delegate_sessions").update(row).eq("id", p.sessionId); if (error) throw new Error("保存子任务进度失败"); }
      else { const { data, error } = await store.supabase.from("delegate_sessions").insert(row).select("id").single(); if (error || !data) throw new Error("保存子任务进度失败"); p.sessionId = data.id; }
    } else if (p.sessionId && res.store) {
      await res.store.supabase.from("delegate_sessions").delete().eq("id", p.sessionId);
    }
  } finally {
    await mcp.close();
  }
  p.status = p.pending ? "awaiting-approval" : "done";
  yield snap(p);
}

const outputText = (o: DelegateProgress) => `【${o.agentName} 的结果】\n${o.text}${o.pending && o.sessionId ? `\n\n子任务已暂停：它请求执行「${o.pending.label}」，参数 ${JSON.stringify(o.pending.input)}。请立即调用 delegate_action（session_id=${o.sessionId}，agent_id=${o.agentId}，tool=${o.pending.tool}）请用户批准；批准后子 Agent 会自动继续后续步骤，不要重新委派。` : ""}`;

/** 委派工具：主 Agent 把子任务交给另一个 Agent，执行过程以预览输出逐步流回界面。 */
export function delegateTool(provider: Provider, agents: AgentConfig[], signal: AbortSignal, res: DelegateResources = { mcpRows: [], skillRows: [] }) {
  const list = agents.map(a => `- ${a.id}：${a.name}（${a.description}）`).join("\n");
  return tool({
    description: `把一个独立子任务委派给专门的 Agent 执行，并拿回它的结果。可用 Agent：\n${list}`,
    inputSchema: z.object({
      agent_id: z.string().describe("要委派的 Agent id"),
      task: z.string().describe("清晰完整的子任务描述，包含所需上下文"),
    }),
    async *execute({ agent_id, task }) {
      const agent = agents.find(a => a.id === agent_id);
      if (!agent) throw new Error(`未找到 Agent：${agent_id}`);
      const p: DelegateProgress = { agentId: agent.id, agentName: agent.name, status: "running", steps: [], text: "" };
      yield snap(p);
      yield* runSub(provider, agent, res, signal, [{ role: "user", content: task }], p);
    },
    toModelOutput: ({ output }) => ({ type: "text", value: outputText(output) }),
  });
}

/** 批准后执行子 Agent 暂停时请求的写操作，并让子 Agent 从断点继续；主对话对它强制人工批准。 */
export function delegateActionTool(provider: Provider, agents: AgentConfig[], signal: AbortSignal, res: DelegateResources) {
  return tool({
    description: "执行被委派 Agent 暂停时请求的外部写操作（删除、发送等），随后子 Agent 自动继续剩余步骤。调用前会弹卡片等用户批准。",
    inputSchema: z.object({ session_id: z.string().uuid(), agent_id: z.string(), tool: z.string() }),
    async *execute({ session_id }, opts) {
      if (!res.store) throw new Error("未登录");
      const { data: s } = await res.store.supabase.from("delegate_sessions").select("id,agent_id,messages,pending").eq("id", session_id).maybeSingle();
      if (!s?.pending) throw new Error("这个子任务已结束或不存在");
      const agent = agents.find(a => a.id === s.agent_id);
      if (!agent) throw new Error(`未找到 Agent：${s.agent_id}`);
      const pending = s.pending as unknown as Pending; // 只执行服务端保存的操作，不信任模型传入的参数
      const p: DelegateProgress = { agentId: agent.id, agentName: agent.name, status: "running", steps: [{ tool: pending.label, state: "running", detail: JSON.stringify(pending.input) }], text: "", sessionId: s.id };
      yield snap(p);
      const mcp = await loadMcpTools(res.mcpRows, agent.mcp_tool_ids ?? []);
      let output: { type: "json"; value: JSONValue } | { type: "error-text"; value: string };
      try {
        const t = mcp.tools[pending.tool];
        if (!t?.execute) throw new Error(`「${agent.name}」没有绑定该操作`);
        const r = await (t.execute as (i: unknown, o: unknown) => unknown)(pending.input, { toolCallId: opts.toolCallId, messages: [], abortSignal: signal });
        output = { type: "json", value: JSON.parse(JSON.stringify(r ?? null)) as JSONValue };
        p.steps[0]!.state = "done";
      } catch (e) {
        output = { type: "error-text", value: e instanceof Error ? e.message : String(e) };
        p.steps[0]!.state = "error"; p.steps[0]!.detail = output.value;
      } finally { await mcp.close(); }
      yield snap(p);
      const history = [...(s.messages as unknown as ModelMessage[]), { role: "tool", content: [{ type: "tool-result", toolCallId: pending.toolCallId, toolName: pending.tool, output }] } as ModelMessage];
      yield* runSub(provider, agent, res, signal, history, p);
    },
    toModelOutput: ({ output }) => ({ type: "text", value: outputText(output) }),
  });
}

export function allAgents(custom: AgentConfig[]) { return [...BUILTIN_AGENTS, ...custom]; }
