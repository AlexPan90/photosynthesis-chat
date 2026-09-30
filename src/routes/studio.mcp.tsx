import { createFileRoute } from "@tanstack/react-router";
import { McpPage } from "@/components/orchestra/McpPage";

export const Route = createFileRoute("/studio/mcp")({
  head: () => ({ meta: [
    { title: "MCP 连接 — Relay Studio" },
    { name: "description", content: "连接远程 MCP 服务，查看并管理它提供的工具。" },
    { property: "og:title", content: "MCP 连接 — Relay Studio" },
    { property: "og:description", content: "把外部服务的工具接入你的 Agent。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: McpPage,
});
