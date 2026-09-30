import { createFileRoute } from "@tanstack/react-router";
import { AgentsPage } from "@/components/orchestra/AgentsPage";

export const Route = createFileRoute("/studio/agents")({
  head: () => ({ meta: [
    { title: "Agent 编排 — Relay Studio" },
    { name: "description", content: "拖拽添加与排序 Agent，设置提示词、工具、MCP、Skills 与可委派的子 Agent。" },
    { property: "og:title", content: "Agent 编排 — Relay Studio" },
    { property: "og:description", content: "像选模型一样使用你编排好的 Agent。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AgentsPage,
});
