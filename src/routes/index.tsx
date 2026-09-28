import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/studio/Studio";
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Relay Studio — AI Agent 对话界面" },
    { name: "description", content: "Relay Studio 的 AI Agent 对话界面设计稿，涵盖会话管理、工具执行、浏览器视图与亮暗模式。" },
    { property: "og:title", content: "Relay Studio — AI Agent 对话界面" },
    { property: "og:description", content: "高保真 AI Agent 对话界面设计稿与交互状态展示。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <Studio />,
});
