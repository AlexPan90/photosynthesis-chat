import { stepCountIs, streamText, tool, type ToolSet } from "ai";
import type { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { chatTools } from "./tools.server";
import { BUILTIN_AGENTS, needsApproval, type AgentConfig } from "./agents.shared";
import { loadMcpTools, type McpRow } from "./mcp.server";
import { skillsPrompt, skillTools, type SkillRow } from "./skills.server";

/** 子 Agent 的能力来源：用户的 MCP 连接和已启用 Skills，按该 Agent 的绑定临时加载。 */
export type DelegateResources = { mcpRows: McpRow[]; skillRows: SkillRow[] };

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
export type DelegateProgress = { agentId: string; agentName: string; status: "running" | "done" | "error" | "awaiting-approval"; steps: DelegateStep[]; text: string; error?: string; pending?: { tool: string; label: string; input: unknown } };

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
      yield { ...p };
      // 按绑定加载 MCP 与 Skills。Skill 脚本可运行：委派本身已在主对话中经用户批准（见 chat.server toolApproval）。
      // MCP 写操作：子 Agent 调用时不执行，子任务在此暂停，交回主对话由 delegate_action 弹卡片请用户批准。
      const mcp = await loadMcpTools(res.mcpRows, agent.mcp_tool_ids ?? []);
      const skills = res.skillRows.filter(s => (agent.skill_ids ?? []).includes(s.id));
      const skillSet = skillTools(skills);
      const writeNames = new Set(Object.keys(mcp.tools).filter(needsApproval));
      const mcpTools: ToolSet = Object.fromEntries(Object.entries(mcp.tools).map(([name, t]) => [name, writeNames.has(name)
        ? tool({ description: `${t.description ?? ""}（需用户批准：调用后子任务暂停，等待用户确认）`, inputSchema: t.inputSchema as never, execute: async () => "已提交给用户批准，请停止调用工具并简要说明你要做什么。" })
        : t]));
      const label = (name: string) => mcp.labels[name] ?? name;
      try {
        const result = streamText({
          model: provider.responses(agent.model),
          system: `${systemFor(agent)}${skillsPrompt(skills)}${writeNames.size ? `\n以下操作会修改外部数据，调用后会暂停等待用户批准：${[...writeNames].map(label).join("、")}。` : ""}`,
          prompt: task,
          tools: { ...pickTools(agent.tool_ids.filter(id => id !== "run_js")), ...mcpTools, ...skillSet }, // 浏览器端工具无法在子 Agent 中执行
          stopWhen: [stepCountIs(50), ({ steps }) => !!steps.at(-1)?.toolCalls.some(c => writeNames.has(c.toolName))],
          abortSignal: signal,
          providerOptions: OPENAI_OPTIONS,
        });
        const running = (name: string) => [...p.steps].reverse().find(x => x.tool === label(name) && x.state === "running");
        let last = 0;
        for await (const part of result.fullStream) {
          if (part.type === "tool-call" && writeNames.has(part.toolName)) { p.pending ??= { tool: part.toolName, label: label(part.toolName), input: part.input }; p.steps.push({ tool: label(part.toolName), state: "running", detail: "等待你批准" }); }
          else if (part.type === "tool-result" && writeNames.has(part.toolName)) continue;
          else if (part.type === "tool-call") p.steps.push({ tool: label(part.toolName), state: "running", detail: JSON.stringify(part.input) });
          else if (part.type === "tool-result") { const s = running(part.toolName); if (s) s.state = "done"; }
          else if (part.type === "tool-error") { const s = running(part.toolName); if (s) { s.state = "error"; s.detail = String((part.error as Error)?.message ?? part.error); } }
          else if (part.type === "text-delta") p.text += part.text;
          else if (part.type === "error") throw part.error instanceof Error ? part.error : new Error("子 Agent 执行失败");
          else continue;
          const now = Date.now();
          if (part.type !== "text-delta" || now - last > 250) { last = now; yield { ...p, steps: p.steps.map(s => ({ ...s })) }; }
        }
      } finally {
        await mcp.close();
      }
      yield { ...p, status: p.pending ? "awaiting-approval" as const : "done" as const, steps: p.steps.map(s => ({ ...s })) };
    },
    toModelOutput: ({ output }) => ({ type: "text", value: `【${output.agentName} 的结果】\n${output.text}${output.pending ? `\n\n子任务已暂停：它请求执行「${output.pending.label}」，参数 ${JSON.stringify(output.pending.input)}。请立即调用 delegate_action（agent_id=${output.agentId}，tool=${output.pending.tool}，input 原样传入）请用户批准；批准执行后如仍有后续步骤，可再次委派。` : ""}` }),
  });
}

/** 执行子 Agent 暂停时请求的写操作；主对话对它强制人工批准。 */
export function delegateActionTool(agents: AgentConfig[], res: DelegateResources) {
  return tool({
    description: "执行被委派 Agent 暂停时请求的外部写操作（删除、发送等）。调用前会弹卡片等用户批准。",
    inputSchema: z.object({ agent_id: z.string(), tool: z.string(), input: z.record(z.string(), z.unknown()).default({}) }),
    async execute({ agent_id, tool: name, input }, opts) {
      const agent = agents.find(a => a.id === agent_id);
      if (!agent) throw new Error(`未找到 Agent：${agent_id}`);
      const mcp = await loadMcpTools(res.mcpRows, agent.mcp_tool_ids ?? []);
      try {
        const t = mcp.tools[name];
        if (!t?.execute) throw new Error(`「${agent.name}」没有绑定该操作：${name}`);
        return await (t.execute as (i: unknown, o: unknown) => unknown)(input, { toolCallId: opts.toolCallId, messages: [], abortSignal: opts.abortSignal });
      } finally { await mcp.close(); }
    },
  });
}

export function allAgents(custom: AgentConfig[]) { return [...BUILTIN_AGENTS, ...custom]; }
