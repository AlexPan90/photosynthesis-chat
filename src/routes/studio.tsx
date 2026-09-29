import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ArrowLeft, Bot, BookOpen, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/studio")({
  ssr: false,
  head: () => ({ meta: [
    { title: "编排中心 — Relay Studio" },
    { name: "description", content: "管理 Agent、MCP 连接与 Skills，像模型一样编排你的 AI 能力。" },
    { property: "og:title", content: "编排中心 — Relay Studio" },
    { property: "og:description", content: "拖拽编排 Agent 的提示词、工具、MCP 与 Skills。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: StudioLayout,
});

const tabs = [
  { to: "/studio/agents", label: "Agent", icon: Bot },
  { to: "/studio/mcp", label: "MCP 连接", icon: Plug },
  { to: "/studio/skills", label: "Skills", icon: BookOpen },
] as const;

function StudioLayout() {
  const [state, setState] = useState<"loading" | "in" | "out">("loading");
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setState(data.user ? "in" : "out")); }, []);
  return <div className="flex h-screen flex-col bg-background text-foreground">
    <header className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
      <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground"><Link to="/"><ArrowLeft className="size-3.5"/>返回对话</Link></Button>
      <span className="mx-2 h-4 w-px bg-border"/>
      <span className="mr-4 text-sm font-semibold">编排中心</span>
      {tabs.map(t => <Link key={t.to} to={t.to} className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-secondary" activeProps={{ className: "bg-secondary font-medium text-foreground" }}><t.icon className="size-3.5"/>{t.label}</Link>)}
    </header>
    <main className="min-h-0 flex-1">
      {state === "loading" ? null : state === "out"
        ? <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">登录后才能管理 Agent、MCP 和 Skills<Button asChild size="sm"><Link to="/auth">去登录</Link></Button></div>
        : <Outlet/>}
    </main>
  </div>;
}
