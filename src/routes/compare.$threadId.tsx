import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { ArrowLeft, Check, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { supabase } from "@/integrations/supabase/client";
import { buildBranches, metaOf, type Row } from "@/lib/branches";
import { modelLabel } from "@/components/studio/LiveChat";

export const Route = createFileRoute("/compare/$threadId")({
  head: () => ({ meta: [
    { title: "分支对比 — Relay Studio" },
    { name: "description", content: "并排查看每条 AI 回复的全部版本，一键切换到想要的那一版。" },
    { property: "og:title", content: "分支对比 — Relay Studio" },
    { property: "og:description", content: "并排对比 AI 回复的各个版本。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ComparePage,
});

type Group = { question: UIMessage; versions: UIMessage[]; current: string };
const textOf = (m: UIMessage) => m.parts.filter(p => p.type === "text").map(p => (p as { text: string }).text).join("\n");
type DiffLine = { kind: "same" | "add" | "del"; text: string; a?: number; b?: number };
/** 行级 LCS 差异：base → target。 */
function diffLines(base: string, target: string): DiffLine[] {
  const A = base.split("\n"), B = target.split("\n");
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = A[i] === B[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: DiffLine[] = []; let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { out.push({ kind: "same", text: B[j]!, a: i + 1, b: j + 1 }); i++; j++; }
    else if (j < m && (i >= n || dp[i]![j + 1]! >= dp[i + 1]![j]!)) { out.push({ kind: "add", text: B[j]!, b: j + 1 }); j++; }
    else { out.push({ kind: "del", text: A[i]!, a: i + 1 }); i++; }
  }
  return out;
}

function DiffView({ lines }: { lines: DiffLine[] }) {
  return <div className="font-mono text-[11.5px] leading-5">
    {lines.map((l, k) => <div key={k} className={`flex ${l.kind === "add" ? "bg-success/10" : l.kind === "del" ? "bg-destructive/10 text-muted-foreground line-through decoration-destructive/40" : ""}`}>
      <span className="w-9 shrink-0 select-none pr-2 text-right text-muted-foreground/60">{l.b ?? ""}</span>
      <span className={`w-4 shrink-0 select-none text-center ${l.kind === "add" ? "text-success" : l.kind === "del" ? "text-destructive" : "text-transparent"}`}>{l.kind === "add" ? "+" : l.kind === "del" ? "−" : " "}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words pr-2">{l.text || " "}</span>
    </div>)}
  </div>;
}

const time = (s?: string) => s ? new Date(s).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

function ComparePage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [onlyBranched, setOnlyBranched] = useState(true);
  const [mode, setMode] = useState<"diff" | "render">("diff");

  useEffect(() => {
    void supabase.from("threads").select("title").eq("id", threadId).maybeSingle().then(({ data }) => setTitle(data?.title ?? ""));
    void supabase.from("messages").select("id,role,parts,parent_id,metadata,selected_at,created_at").eq("thread_id", threadId).order("created_at").then(({ data, error }) => {
      if (error) { setError("加载失败，请确认已登录且对话存在。"); return; }
      const { messages, versions } = buildBranches((data ?? []) as Row[]);
      const shown = new Set(messages.map(m => m.id));
      setGroups(messages.filter(m => m.role === "user" && versions[m.id]?.length).map(q => {
        const list = [...versions[q.id]!].sort((a, b) => (metaOf(a).createdAt ?? "").localeCompare(metaOf(b).createdAt ?? ""));
        return { question: q, versions: list, current: list.find(v => shown.has(v.id))?.id ?? list[list.length - 1]!.id };
      }));
    });
  }, [threadId]);

  async function pick(g: Group, v: UIMessage) {
    const now = new Date().toISOString();
    const { error } = await supabase.from("messages").update({ selected_at: now, parent_id: g.question.id }).eq("id", v.id);
    if (error) { setError("切换未保存，请重试。"); return; }
    void navigate({ to: "/chat/$threadId", params: { threadId }, hash: `msg-${v.id}` });
  }

  const list = groups?.filter(g => !onlyBranched || g.versions.length > 1) ?? [];
  return <div className="soft-scroll h-dvh overflow-y-auto bg-background">
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-5 py-3 backdrop-blur">
      <Button variant="ghost" size="sm" asChild><Link to="/chat/$threadId" params={{ threadId }}><ArrowLeft className="size-4"/>返回对话</Link></Button>
      <div className="min-w-0"><h1 className="font-display text-sm font-semibold">分支对比</h1><p className="truncate text-[11px] text-muted-foreground">{title}</p></div>
      <div className="ml-auto flex rounded-md border p-0.5 text-[11px]">{(["diff", "render"] as const).map(k => <button key={k} type="button" onClick={() => setMode(k)} className={`rounded px-2 py-0.5 ${mode === k ? "bg-secondary font-medium" : "text-muted-foreground"}`}>{k === "diff" ? "差异" : "排版"}</button>)}</div>
      <label className=" flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={onlyBranched} onChange={e => setOnlyBranched(e.target.checked)}/>只看有多个版本的回复</label>
    </header>
    <main className="mx-auto max-w-[1400px] space-y-8 px-5 py-6">
      {mode === "diff" && !!list.length && <p className="text-[11px] text-muted-foreground">以「当前」版本为基准：<span className="text-success">绿色</span>是该版本新增的行，<span className="text-destructive">红色删除线</span>是基准里有、该版本没有的行。</p>}
      {error && <p className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive">{error}</p>}
      {!groups && !error && <Shimmer>正在加载版本...</Shimmer>}
      {groups && !list.length && <p className="py-20 text-center text-sm text-muted-foreground">{onlyBranched ? "这个对话还没有重新生成过的回复。" : "这个对话还没有回复。"}</p>}
      {list.map(g => <section key={g.question.id}>
        <div className="mb-3 flex items-start gap-2"><span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold">提问</span><p className="line-clamp-2 text-sm font-medium">{textOf(g.question)}</p><span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{g.versions.length} 个版本</span></div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {g.versions.map((v, i) => {
            const m = metaOf(v); const active = v.id === g.current;
            const base = g.versions.find(x => x.id === g.current)!;
            const lines = diffLines(textOf(base), textOf(v));
            const adds = lines.filter(l => l.kind === "add").length, dels = lines.filter(l => l.kind === "del").length;
            return <article key={v.id} className={`flex max-h-[520px] w-[380px] shrink-0 flex-col rounded-lg border bg-card ${active ? "border-primary/60 ring-1 ring-primary/30" : ""}`}>
              <div className="flex items-center gap-2 border-b px-3 py-2 text-[11px]">
                <span className="font-semibold">版本 {i + 1}</span>
                {m.regeneratedFrom && <span className="flex items-center gap-1 text-muted-foreground"><GitBranch className="size-3"/>重新生成</span>}
                <span className="text-muted-foreground">{m.model ? modelLabel(m.model) : ""} {time(m.createdAt)}</span>
                {!active && mode === "diff" && <span className="font-mono"><span className="text-success">+{adds}</span> <span className="text-destructive">−{dels}</span></span>}
                {active && <span className="ml-auto flex items-center gap-1 text-primary"><Check className="size-3"/>当前</span>}
              </div>
              <div className={`soft-scroll flex-1 overflow-y-auto text-[12.5px] leading-6 ${mode === "diff" ? "py-2" : "px-3 py-2.5"}`}>{mode === "diff" ? <DiffView lines={lines}/> : textOf(v) ? <MessageResponse>{textOf(v)}</MessageResponse> : <span className="text-muted-foreground">（仅工具调用，无文字回复）</span>}</div>
              <div className="border-t px-3 py-2"><Button size="sm" variant={active ? "outline" : "default"} className="w-full" onClick={() => pick(g, v)}>{active ? "跳转到这条消息" : "切换到此版本并跳转"}</Button></div>
            </article>;
          })}
        </div>
      </section>)}
    </main>
  </div>;
}
