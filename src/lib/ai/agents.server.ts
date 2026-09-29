import { stepCountIs, streamText, tool, type ToolSet } from "ai";
import type { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { chatTools } from "./tools.server";
import { BUILTIN_AGENTS, type AgentConfig } from "./agents.shared";

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
export function delegateTool(provider: Provider, agents: AgentConfig[], signal: AbortSignal) {
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
      const result = streamText({
        model: provider.responses(agent.model),
        system: systemFor(agent),
        prompt: task,
        tools: pickTools(agent.tool_ids.filter(id => id !== "run_js")), // 浏览器端工具无法在子 Agent 中执行
        stopWhen: stepCountIs(50),
        abortSignal: signal,
        providerOptions: OPENAI_OPTIONS,
      });
      const running = (name: string) => [...p.steps].reverse().find(x => x.tool === name && x.state === "running");
      let last = 0;
      for await (const part of result.fullStream) {
        if (part.type === "tool-call") p.steps.push({ tool: part.toolName, state: "running", detail: JSON.stringify(part.input) });
        else if (part.type === "tool-result") { const s = running(part.toolName); if (s) s.state = "done"; }
        else if (part.type === "tool-error") { const s = running(part.toolName); if (s) { s.state = "error"; s.detail = String((part.error as Error)?.message ?? part.error); } }
        else if (part.type === "text-delta") p.text += part.text;
        else if (part.type === "error") throw part.error instanceof Error ? part.error : new Error("子 Agent 执行失败");
        else continue;
        const now = Date.now();
        if (part.type !== "text-delta" || now - last > 250) { last = now; yield { ...p, steps: p.steps.map(s => ({ ...s })) }; }
      }
      yield { ...p, status: "done" as const, steps: p.steps.map(s => ({ ...s })) };
    },
    toModelOutput: ({ output }) => ({ type: "text", value: `【${output.agentName} 的结果】\n${output.text}` }),
  });
}

export function allAgents(custom: AgentConfig[]) { return [...BUILTIN_AGENTS, ...custom]; }
