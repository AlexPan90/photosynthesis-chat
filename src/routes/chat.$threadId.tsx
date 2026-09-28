import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/studio/Studio";
export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({ meta: [
    { title: "对话 — Relay Studio" },
    { name: "description", content: "在 Relay Studio 中查看 Agent 对话、执行步骤与浏览器活动。" },
    { property: "og:title", content: "对话 — Relay Studio" },
    { property: "og:description", content: "Relay Studio 对话工作空间与 Agent 执行视图。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ThreadPage,
});
function ThreadPage() { const { threadId } = Route.useParams(); return <Studio threadId={threadId}/>; }
