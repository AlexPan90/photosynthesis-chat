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
export type DelegateProgress = { agentId: string; agentName: string; status: "running" | "done" | "error"; steps: DelegateStep[]; text: string; error?: string };

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
      // 按绑定加载 MCP 与 Skills；需要人工批准的写操作/脚本不交给子 Agent（子流程无法暂停等待确认）。
      const mcp = await loadMcpTools(res.mcpRows, agent.mcp_tool_ids ?? []);
      const skills = res.skillRows.filter(s => (agent.skill_ids ?? []).includes(s.id));
      const { run_skill_script: _skip, ...skillSet } = skillTools(skills);
      const mcpTools = Object.fromEntries(Object.entries(mcp.tools).filter(([name]) => !needsApproval(name)));
      const withheld = Object.keys(mcp.tools).filter(n => !(n in mcpTools)).map(n => mcp.labels[n] ?? n);
      if (_skip) withheld.push("运行 Skill 脚本");
      const label = (name: string) => mcp.labels[name] ?? name;
      try {
        const result = streamText({
          model: provider.responses(agent.model),
          system: `${systemFor(agent)}${skillsPrompt(skills)}${withheld.length ? `\n以下操作需要用户确认，你无法直接执行；如确有必要，请在结果中说明需要主 Agent 执行的具体操作和参数：${withheld.join("、")}。` : ""}`,
          prompt: task,
          tools: { ...pickTools(agent.tool_ids.filter(id => id !== "run_js")), ...mcpTools, ...skillSet }, // 浏览器端工具无法在子 Agent 中执行
          stopWhen: stepCountIs(50),
          abortSignal: signal,
          providerOptions: OPENAI_OPTIONS,
        });
        const running = (name: string) => [...p.steps].reverse().find(x => x.tool === label(name) && x.state === "running");
        let last = 0;
        for await (const part of result.fullStream) {
          if (part.type === "tool-call") p.steps.push({ tool: label(part.toolName), state: "running", detail: JSON.stringify(part.input) });
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
      yield { ...p, status: "done" as const, steps: p.steps.map(s => ({ ...s })) };
    },
    toModelOutput: ({ output }) => ({ type: "text", value: `【${output.agentName} 的结果】\n${output.text}` }),
  });
}

export function allAgents(custom: AgentConfig[]) { return [...BUILTIN_AGENTS, ...custom]; }
