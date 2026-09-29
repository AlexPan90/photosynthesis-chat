export type AgentConfig = {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  model: string;
  tool_ids: string[];
  mcp_tool_ids?: string[];
  skill_ids?: string[];
  delegate_ids?: string[];
  sort_order?: number;
  builtin?: boolean;
};

export const TOOL_CATALOG = [
  { id: "web_search", label: "网页搜索" },
  { id: "read_webpage", label: "读取网页" },
  { id: "get_current_time", label: "获取当前时间" },
  { id: "calculate", label: "计算" },
] as const;

export const BUILTIN_AGENTS: AgentConfig[] = [
  {
    id: "builtin:researcher", name: "调研员", builtin: true, model: "openai/gpt-6-astra",
    description: "阅读网页资料并整理成有出处的要点",
    system_prompt: "你负责资料调研：优先用 read_webpage 读取给定链接，提炼关键事实，标注来源链接，不编造信息。",
    tool_ids: ["read_webpage", "get_current_time"],
  },
  {
    id: "builtin:analyst", name: "数据分析师", builtin: true, model: "openai/gpt-6-astra",
    description: "做数值计算、对比和结构化表格",
    system_prompt: "你负责定量分析：所有数值都用 calculate 精确计算，结论用表格呈现并说明计算过程。",
    tool_ids: ["calculate", "get_current_time"],
  },
];

// 需人工批准的写操作：MCP 工具名中含删除/发送/创建/修改等动词（读类前缀 get/list/read/search 除外）。
const WRITE_VERBS = new Set("delete remove destroy drop purge send post publish reply comment create add update edit write patch put merge close archive move rename assign invite transfer pay execute run upload set".split(" "));
const READ_VERBS = new Set("get list read search fetch find query describe show view lookup resolve ask".split(" "));
export function needsApproval(toolName: string) {
  const words = toolName.replace(/^m\d+_/, "").replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (!words.length || READ_VERBS.has(words[0]!)) return false;
  return words.some(w => WRITE_VERBS.has(w));
}
