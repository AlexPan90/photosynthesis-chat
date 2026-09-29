import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Check, Github, LoaderCircle, Plus, RefreshCw, Rss, Search, SquarePen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageResponse } from "@/components/ai-elements/message";
import { CodeBlock, CodeBlockCopyButton, CodeBlockFilename, CodeBlockHeader, CodeBlockTitle, CodeBlockActions } from "@/components/ai-elements/code-block";
import { FileCode2, FileText, Folder, Eye, Code2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { installSkillDefs, installSkills, readSkillIndex, scanSkillSource, type SkillDef } from "@/lib/orchestra.functions";
import { useSkills, type Skill } from "./data";

type Remote = { name: string; description: string; path: string; files: string[] };
const FEATURED = [{ repo: "anthropics/skills", note: "Anthropic 官方示例 Skills（文档处理、设计、测试等）" }];
const TEMPLATE = "---\nname: my-skill\ndescription: 一句话说明什么时候使用这个 Skill\n---\n\n# 使用说明\n\n1. 第一步……\n2. 第二步……\n";
const meta = (md: string) => { const fm = md.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? ""; const g = (k: string) => fm.match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? ""; return { name: g("name"), description: g("description") }; };

export function SkillsPage() {
  const { items, loading, reload } = useSkills();
  const scan = useServerFn(scanSkillSource);
  const install = useServerFn(installSkills);
  const readIndex = useServerFn(readSkillIndex);
  const installDefs = useServerFn(installSkillDefs);
  const [sel, setSel] = useState<string | "add" | null>(null);
  const [mode, setMode] = useState<"repo" | "hub" | "manual">("repo");
  const [repo, setRepo] = useState("");
  const [found, setFound] = useState<{ source: string; ref: string; skills: Remote[] } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [indexUrl, setIndexUrl] = useState("");
  const [hub, setHub] = useState<SkillDef[] | null>(null);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState(TEMPLATE);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const current = items.find(s => s.id === sel);
  const installedPaths = new Set(items.map(s => `${s.source_url}#${s.path}`));

  const run = async (fn: () => Promise<void>) => { setBusy(true); setMsg(""); try { await fn(); } catch (e) { setMsg((e as Error).message || "操作失败"); } setBusy(false); };
  const doScan = (r = repo) => run(async () => { setRepo(r); const res = await scan({ data: { repo: r } }); setFound(res); setPicked(res.skills.filter(s => !installedPaths.has(`${res.source}#${s.path}`)).map(s => s.path)); if (!res.skills.length) setMsg("这个仓库里没有找到 SKILL.md"); });
  const doInstall = () => run(async () => { if (!found) return; const r = await install({ data: { repo: found.source.replace("https://github.com/", ""), items: picked.map(path => ({ path })) } }); await reload(); setMsg(`已安装 ${r.installed} 个 Skill`); setPicked([]); });
  const loadHub = () => run(async () => setHub(await readIndex({ data: { url: indexUrl } })));
  const saveManual = () => run(async () => { const m = meta(draft); if (!m.name) throw new Error("SKILL.md 开头需要 name 字段"); const { data, error } = await supabase.from("skills").insert({ name: m.name.slice(0, 60), description: m.description.slice(0, 500), source_type: "manual", content: draft }).select("id").single(); if (error) throw new Error("保存失败"); await reload(); setSel(data.id); });
  const installHub = (h: SkillDef) => run(async () => { if (h.repo) await install({ data: { repo: h.repo, items: [{ path: h.path }] } }); else await installDefs({ data: { url: indexUrl, names: [h.name] } }); await reload(); setMsg("已安装"); });
  const refresh = (s: Skill) => run(async () => { if (!s.source_url) return; if (s.source_type === "url") { await installDefs({ data: { url: s.source_url, names: [s.path ?? s.name] } }); await reload(); setMsg("已拉取最新版本"); return; } await install({ data: { repo: s.source_url.replace("https://github.com/", ""), items: [{ path: s.path ?? "" }] } }); await reload(); setMsg("已拉取最新版本"); });
  const toggle = async (s: Skill, enabled: boolean) => { await supabase.from("skills").update({ enabled }).eq("id", s.id); await reload(); };
  const remove = async (s: Skill) => { if (!confirm(`删除 Skill「${s.name}」？`)) return; await supabase.from("skills").delete().eq("id", s.id); setSel(null); await reload(); };
  const saveEdit = (s: Skill, content: string) => run(async () => { const m = meta(content); await supabase.from("skills").update({ content, name: (m.name || s.name).slice(0, 60), description: (m.description || s.description).slice(0, 500) }).eq("id", s.id); await reload(); setMsg("已保存"); });

  return <div className="skills-glass grid h-full grid-cols-[272px_minmax(0,1fr)] gap-2 p-2">
    <aside className="glass-pane flex min-h-0 flex-col">
      <div className="flex h-11 items-center gap-2 border-b px-3"><span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]"/><span className="font-display text-[12px] font-semibold tracking-wide">Skills</span><span className="rounded-sm bg-secondary px-1.5 font-mono text-[10px] text-muted-foreground">{items.length}</span>
        <button onClick={() => { setSel("add"); setMsg(""); }} className="ml-auto flex h-7 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 text-[11px] font-medium text-primary transition hover:bg-primary/20" aria-label="安装 Skill"><Plus className="size-3.5"/>安装</button></div>
      <div className="soft-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
      {loading ? <p className="px-2 py-2 text-xs text-muted-foreground">加载中…</p> : items.length === 0 && <button onClick={() => setSel("add")} className="m-1 w-[calc(100%-8px)] rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground hover:bg-secondary">+ 安装第一个 Skill</button>}
      {items.map(s => <button key={s.id} onClick={() => { setSel(s.id); setMsg(""); }} className={`group relative mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs transition hover:bg-secondary/70 ${sel === s.id ? "bg-primary/10 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary" : ""}`}>
        <span className={`grid size-7 shrink-0 place-items-center rounded-md border ${sel === s.id ? "border-primary/40 bg-primary/15 text-primary" : "bg-secondary/60 text-muted-foreground"}`}>{s.source_type === "github" ? <Github className="size-3.5"/> : <SquarePen className="size-3.5"/>}</span>
        <span className="min-w-0 flex-1"><span className={`flex items-center gap-1.5 truncate font-medium ${s.enabled ? "" : "text-muted-foreground"}`}><span className="truncate">{s.name}</span>{s.enabled && <span className="size-1 shrink-0 rounded-full bg-primary"/>}</span><span className="block truncate text-[11px] text-muted-foreground">{s.description || "无描述"}</span></span>
      </button>)}
      </div>
    </aside>

    <section className="glass-pane soft-scroll min-h-0 overflow-y-auto">
      {!sel ? <div className="flex h-full flex-col items-center justify-center gap-3 text-xs text-muted-foreground"><BookOpen className="size-6"/>Skills 是给 Agent 的方法手册，用到时才会加载<Button size="sm" variant="outline" onClick={() => setSel("add")}><Plus className="size-3.5"/>安装 Skill</Button></div>
      : sel === "add" ? <div className="mx-auto max-w-[720px] space-y-5 px-8 py-6">
        <h2 className="text-base font-semibold">安装 Skill</h2>
        <div className="flex gap-1.5">{([["repo", "远程仓库", Github], ["hub", "订阅源", Rss], ["manual", "手动编写", SquarePen]] as const).map(([v, l, I]) => <button key={v} onClick={() => { setMode(v); setMsg(""); }} className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs ${mode === v ? "border-primary bg-primary/5 font-medium" : "hover:bg-secondary"}`}><I className="size-3.5"/>{l}</button>)}</div>
        {msg && <p className={`rounded-md border px-3 py-2 text-xs ${msg.startsWith("已") ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{msg}</p>}

        {mode === "repo" && <>
          <div className="flex gap-2"><Input value={repo} onChange={e => setRepo(e.target.value)} onKeyDown={e => e.key === "Enter" && repo && doScan()} placeholder="GitHub 仓库，例如 anthropics/skills 或完整链接" className="h-8 font-mono text-xs"/><Button size="sm" className="text-xs" disabled={busy || !repo.trim()} onClick={() => doScan()}>{busy ? <LoaderCircle className="size-3.5 animate-spin"/> : <Search className="size-3.5"/>}扫描</Button></div>
          {!found && <div className="space-y-1.5"><p className="text-[11px] text-muted-foreground">推荐</p>{FEATURED.map(f => <button key={f.repo} onClick={() => doScan(f.repo)} className="flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs hover:bg-secondary"><Github className="size-3.5"/><span className="font-mono font-medium">{f.repo}</span><span className="text-muted-foreground">{f.note}</span></button>)}</div>}
          {found && found.skills.length > 0 && <div>
            <div className="mb-1.5 flex items-center text-xs"><span className="font-medium">找到 {found.skills.length} 个 Skill</span><span className="ml-2 font-mono text-[11px] text-muted-foreground">@{found.ref}</span>
              <button className="ml-auto text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setPicked(picked.length ? [] : found.skills.map(s => s.path))}>{picked.length ? "取消全选" : "全选"}</button></div>
            <div className="divide-y rounded-lg border">{found.skills.map(s => { const has = installedPaths.has(`${found.source}#${s.path}`);
              return <label key={s.path} className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-secondary/50"><Checkbox className="mt-0.5" checked={picked.includes(s.path)} onCheckedChange={v => setPicked(v ? [...picked, s.path] : picked.filter(p => p !== s.path))}/>
                <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-xs font-medium">{s.name}{has && <span className="text-[10px] font-normal text-muted-foreground">已安装 · 勾选则更新</span>}</span><span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-muted-foreground">{s.description || "无描述"}</span><span className="mt-0.5 block font-mono text-[10px] text-muted-foreground/70">{s.path || "/"} · {s.files.length} 个附带文件</span></span></label>; })}</div>
            <Button size="sm" className="mt-3 text-xs" disabled={busy || !picked.length} onClick={doInstall}>{busy && <LoaderCircle className="size-3.5 animate-spin"/>}安装所选（{picked.length}）</Button>
          </div>}
        </>}

        {mode === "hub" && <>
          <p className="text-xs leading-5 text-muted-foreground">填一个返回 JSON 的远程地址（数组或 <code className="rounded bg-[color:var(--code-bg)] px-1 font-mono text-[11px] text-[color:var(--code-fg)]">{`{"skills":[…]}`}</code>）。每项含 <code className="rounded bg-[color:var(--code-bg)] px-1 font-mono text-[11px] text-[color:var(--code-fg)]">name</code>、<code className="rounded bg-[color:var(--code-bg)] px-1 font-mono text-[11px] text-[color:var(--code-fg)]">description</code>，再任选其一：<code className="rounded bg-[color:var(--code-bg)] px-1 font-mono text-[11px] text-[color:var(--code-fg)]">repo</code>+<code className="rounded bg-[color:var(--code-bg)] px-1 font-mono text-[11px] text-[color:var(--code-fg)]">path</code>（GitHub 仓库）、<code className="rounded bg-[color:var(--code-bg)] px-1 font-mono text-[11px] text-[color:var(--code-fg)]">url</code>（SKILL.md 链接）或 <code className="rounded bg-[color:var(--code-bg)] px-1 font-mono text-[11px] text-[color:var(--code-fg)]">content</code>（直接写正文）。</p>
          <div className="flex gap-2"><Input value={indexUrl} onChange={e => setIndexUrl(e.target.value)} placeholder="https://…/skills-index.json" className="h-8 font-mono text-xs"/><Button size="sm" className="text-xs" disabled={busy || !indexUrl} onClick={loadHub}>{busy && <LoaderCircle className="size-3.5 animate-spin"/>}加载</Button></div>
          {hub && <><Input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索" className="h-8 text-xs"/>
            <div className="divide-y rounded-lg border">{hub.filter(h => !q || (h.name + h.description).toLowerCase().includes(q.toLowerCase())).map(h => { const has = h.repo ? installedPaths.has(`https://github.com/${h.repo.replace(/^https:\/\/github\.com\//, "")}#${h.path}`) : installedPaths.has(`${indexUrl}#${h.name}`);
              return <div key={(h.repo ?? h.url ?? "inline") + h.path + h.name} className="flex items-center gap-3 px-3 py-2.5"><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-xs font-medium">{h.name}<span className="rounded bg-secondary px-1 font-mono text-[10px] font-normal text-muted-foreground">{h.repo ? "GitHub" : h.url ? "链接" : "内联"}</span></span><span className="block truncate text-[11px] text-muted-foreground">{h.description}</span></span>{has ? <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Check className="size-3"/>已安装</span> : <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => installHub(h)}>安装</Button>}</div>; })}</div></>}
        </>}

        {mode === "manual" && <>
          <div className="grid gap-2 lg:grid-cols-2"><Textarea value={draft} onChange={e => setDraft(e.target.value)} rows={18} className="border-[color:var(--code-border)] bg-[color:var(--code-bg)] font-mono text-xs leading-5 text-[color:var(--code-fg)]"/><CodeBlock code={draft} language="markdown" showLineNumbers className="max-h-[420px] overflow-auto"><CodeBlockHeader><CodeBlockTitle><FileCode2 className="size-3.5"/><CodeBlockFilename>SKILL.md · 预览</CodeBlockFilename></CodeBlockTitle></CodeBlockHeader></CodeBlock></div>
          <Button size="sm" className="text-xs" disabled={busy} onClick={saveManual}>保存 Skill</Button>
        </>}
      </div>
      : current && <SkillDetail key={current.id} s={current} busy={busy} msg={msg} onToggle={v => toggle(current, v)} onRefresh={() => refresh(current)} onRemove={() => remove(current)} onSave={c => saveEdit(current, c)}/>}
    </section>
  </div>;
}

const extIcon = (f: string) => f.endsWith("/") ? Folder : /\.(md|txt)$/i.test(f) ? FileText : FileCode2;
const extLang = (f: string) => f.split(".").pop()?.toLowerCase() ?? "";

function SkillDetail({ s, busy, msg, onToggle, onRefresh, onRemove, onSave }: { s: Skill; busy: boolean; msg: string; onToggle: (v: boolean) => void; onRefresh: () => void; onRemove: () => void; onSave: (c: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(s.content);
  const [view, setView] = useState<"preview" | "source">("source");
  const lines = s.content.split("\n").length;
  return <div className="grid min-h-full grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px]">
    <div className="min-w-0">
      <div className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b bg-card/80 px-4 backdrop-blur">
        <span className="text-[11px] text-muted-foreground">Skills</span><span className="text-muted-foreground/50">›</span><h2 className="truncate font-display text-[13px] font-semibold">{s.name}</h2>
        <span className={`rounded-sm border px-1.5 font-mono text-[10px] ${s.enabled ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground"}`}>{s.enabled ? "ACTIVE" : "OFF"}</span>
        <div className="ml-auto flex items-center gap-1.5"><Switch checked={s.enabled} onCheckedChange={onToggle} aria-label="启用"/>
          {s.source_type === "github" ? <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={onRefresh}><RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`}/>重新拉取</Button>
            : <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => editing ? (onSave(content), setEditing(false)) : setEditing(true)}>{editing ? "保存" : <><SquarePen className="size-3.5"/>编辑</>}</Button>}
          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={onRemove} aria-label="删除"><Trash2 className="size-3.5"/></Button></div>
      </div>
      <div className="space-y-4 px-5 py-5">
        <p className="text-[13px] leading-6 text-muted-foreground">{s.description}</p>
        {msg && <p className={`rounded-md border px-3 py-2 text-xs ${msg.startsWith("已") ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{msg}</p>}
        {editing ? <Textarea value={content} onChange={e => setContent(e.target.value)} rows={22} className="border-[color:var(--code-border)] bg-[color:var(--code-bg)] font-mono text-xs leading-5 text-[color:var(--code-fg)]"/>
        : view === "source" ? <CodeBlock code={s.content} language="markdown" showLineNumbers>
            <CodeBlockHeader><CodeBlockTitle><FileCode2 className="size-3.5"/><CodeBlockFilename>SKILL.md</CodeBlockFilename><span className="font-mono text-[10px] opacity-60">{lines} lines</span></CodeBlockTitle>
              <CodeBlockActions><ViewToggle view={view} setView={setView}/><CodeBlockCopyButton/></CodeBlockActions></CodeBlockHeader></CodeBlock>
        : <div className="overflow-hidden rounded-lg border bg-card"><div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground"><span className="flex items-center gap-2"><Eye className="size-3.5"/>SKILL.md · 渲染</span><ViewToggle view={view} setView={setView}/></div><div className="px-5 py-4 text-[13px] leading-6"><MessageResponse>{s.content.replace(/^---[\s\S]*?---\s*/, "")}</MessageResponse></div></div>}
      </div>
    </div>
    <aside className="border-t p-4 xl:border-l xl:border-t-0">
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">元数据</div>
      <dl className="space-y-2 rounded-lg border bg-secondary/30 p-3 text-[11px]">
        <div className="flex gap-2"><dt className="w-10 text-muted-foreground">来源</dt><dd className="min-w-0 flex-1 truncate font-mono">{s.source_type === "github" ? <a className="text-primary hover:underline" href={s.source_url ?? "#"} target="_blank" rel="noreferrer">{s.source_url?.replace("https://github.com/", "")}{s.path ? `/${s.path}` : ""}</a> : "manual"}</dd></div>
        {s.ref && <div className="flex gap-2"><dt className="w-10 text-muted-foreground">版本</dt><dd className="truncate font-mono">{s.ref}</dd></div>}
        <div className="flex gap-2"><dt className="w-10 text-muted-foreground">更新</dt><dd className="font-mono">{new Date(s.updated_at).toLocaleString("zh-CN")}</dd></div>
      </dl>
      <div className="mb-2 mt-5 flex items-center text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">附带文件<span className="ml-auto rounded-sm bg-secondary px-1.5 font-mono normal-case tracking-normal">{s.files.length}</span></div>
      {s.files.length === 0 ? <p className="rounded-lg border border-dashed px-3 py-4 text-center text-[11px] text-muted-foreground">没有附带文件</p>
      : <div className="overflow-hidden rounded-lg border border-[color:var(--code-border)] bg-[color:var(--code-bg)] py-1">{s.files.slice(0, 60).map(f => { const I = extIcon(f); return <div key={f} className="flex items-center gap-2 px-2.5 py-1 font-mono text-[11px] text-[color:var(--code-fg)] hover:bg-white/5"><I className="size-3 shrink-0 text-[color:var(--code-muted)]"/><span className="min-w-0 flex-1 truncate">{f}</span><span className="text-[9.5px] uppercase text-[color:var(--code-muted)]">{extLang(f)}</span></div>; })}</div>}
    </aside>
  </div>;
}

function ViewToggle({ view, setView }: { view: "preview" | "source"; setView: (v: "preview" | "source") => void }) {
  return <div className="flex rounded-md border border-current/20 p-0.5">{([["source", Code2, "源码"], ["preview", Eye, "渲染"]] as const).map(([v, I, l]) => <button key={v} onClick={() => setView(v)} className={`flex h-5 items-center gap-1 rounded px-1.5 text-[10.5px] ${view === v ? "bg-primary/25 text-primary" : "opacity-70 hover:opacity-100"}`}><I className="size-3"/>{l}</button>)}</div>;
}
