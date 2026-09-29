import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Check, Github, LoaderCircle, Plus, RefreshCw, Rss, Search, SquarePen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageResponse } from "@/components/ai-elements/message";
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

  return <div className="grid h-full grid-cols-[260px_1fr]">
    <aside className="soft-scroll overflow-y-auto border-r p-2">
      <div className="flex items-center px-2 py-1.5 text-[11px] font-medium text-muted-foreground">已安装<button onClick={() => { setSel("add"); setMsg(""); }} className="ml-auto rounded p-1 hover:bg-secondary" aria-label="安装 Skill"><Plus className="size-3.5"/></button></div>
      {loading ? <p className="px-2 py-2 text-xs text-muted-foreground">加载中…</p> : items.length === 0 && <button onClick={() => setSel("add")} className="m-1 w-[calc(100%-8px)] rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground hover:bg-secondary">+ 安装第一个 Skill</button>}
      {items.map(s => <button key={s.id} onClick={() => { setSel(s.id); setMsg(""); }} className={`mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-secondary ${sel === s.id ? "bg-secondary" : ""}`}>
        {s.source_type === "github" ? <Github className="size-3.5 shrink-0 text-muted-foreground"/> : <SquarePen className="size-3.5 shrink-0 text-muted-foreground"/>}
        <span className="min-w-0 flex-1"><span className={`block truncate font-medium ${s.enabled ? "" : "text-muted-foreground"}`}>{s.name}</span><span className="block truncate text-[11px] text-muted-foreground">{s.description || "无描述"}</span></span>
      </button>)}
    </aside>

    <section className="soft-scroll overflow-y-auto">
      {!sel ? <div className="flex h-full flex-col items-center justify-center gap-3 text-xs text-muted-foreground"><BookOpen className="size-6"/>Skills 是给 Agent 的方法手册，用到时才会加载<Button size="sm" variant="outline" onClick={() => setSel("add")}><Plus className="size-3.5"/>安装 Skill</Button></div>
      : sel === "add" ? <div className="mx-auto max-w-[720px] space-y-5 px-8 py-6">
        <h2 className="text-base font-semibold">安装 Skill</h2>
        <div className="flex gap-1.5">{([["repo", "远程仓库", Github], ["hub", "订阅源", Rss], ["manual", "手动编写", SquarePen]] as const).map(([v, l, I]) => <button key={v} onClick={() => { setMode(v); setMsg(""); }} className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs ${mode === v ? "border-primary bg-primary/5 font-medium" : "hover:bg-secondary"}`}><I className="size-3.5"/>{l}</button>)}</div>
        {msg && <p className={`text-xs ${msg.startsWith("已") ? "text-success" : "text-destructive"}`}>{msg}</p>}

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
          <p className="text-xs leading-5 text-muted-foreground">填一个返回 JSON 的远程地址（数组或 <code className="font-mono text-[11px]">{`{"skills":[…]}`}</code>）。每项含 <code className="font-mono text-[11px]">name</code>、<code className="font-mono text-[11px]">description</code>，再任选其一：<code className="font-mono text-[11px]">repo</code>+<code className="font-mono text-[11px]">path</code>（GitHub 仓库）、<code className="font-mono text-[11px]">url</code>（SKILL.md 链接）或 <code className="font-mono text-[11px]">content</code>（直接写正文）。</p>
          <div className="flex gap-2"><Input value={indexUrl} onChange={e => setIndexUrl(e.target.value)} placeholder="https://…/skills-index.json" className="h-8 font-mono text-xs"/><Button size="sm" className="text-xs" disabled={busy || !indexUrl} onClick={loadHub}>{busy && <LoaderCircle className="size-3.5 animate-spin"/>}加载</Button></div>
          {hub && <><Input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索" className="h-8 text-xs"/>
            <div className="divide-y rounded-lg border">{hub.filter(h => !q || (h.name + h.description).toLowerCase().includes(q.toLowerCase())).map(h => { const has = h.repo ? installedPaths.has(`https://github.com/${h.repo.replace(/^https:\/\/github\.com\//, "")}#${h.path}`) : installedPaths.has(`${indexUrl}#${h.name}`);
              return <div key={(h.repo ?? h.url ?? "inline") + h.path + h.name} className="flex items-center gap-3 px-3 py-2.5"><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-xs font-medium">{h.name}<span className="rounded bg-secondary px-1 font-mono text-[10px] font-normal text-muted-foreground">{h.repo ? "GitHub" : h.url ? "链接" : "内联"}</span></span><span className="block truncate text-[11px] text-muted-foreground">{h.description}</span></span>{has ? <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Check className="size-3"/>已安装</span> : <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => installHub(h)}>安装</Button>}</div>; })}</div></>}
        </>}

        {mode === "manual" && <>
          <Textarea value={draft} onChange={e => setDraft(e.target.value)} rows={16} className="font-mono text-xs leading-5"/>
          <Button size="sm" className="text-xs" disabled={busy} onClick={saveManual}>保存 Skill</Button>
        </>}
      </div>
      : current && <SkillDetail key={current.id} s={current} busy={busy} msg={msg} onToggle={v => toggle(current, v)} onRefresh={() => refresh(current)} onRemove={() => remove(current)} onSave={c => saveEdit(current, c)}/>}
    </section>
  </div>;
}

function SkillDetail({ s, busy, msg, onToggle, onRefresh, onRemove, onSave }: { s: Skill; busy: boolean; msg: string; onToggle: (v: boolean) => void; onRefresh: () => void; onRemove: () => void; onSave: (c: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(s.content);
  return <div className="mx-auto max-w-[720px] space-y-4 px-8 py-6">
    <div className="flex items-center gap-2"><h2 className="text-base font-semibold">{s.name}</h2>
      <div className="ml-auto flex items-center gap-1.5"><span className="text-[11px] text-muted-foreground">启用</span><Switch checked={s.enabled} onCheckedChange={onToggle} aria-label="启用"/>
        {s.source_type === "github" ? <Button size="sm" variant="outline" className="text-xs" disabled={busy} onClick={onRefresh}><RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`}/>重新拉取</Button>
          : <Button size="sm" variant="outline" className="text-xs" onClick={() => editing ? (onSave(content), setEditing(false)) : setEditing(true)}>{editing ? "保存" : <><SquarePen className="size-3.5"/>编辑</>}</Button>}
        <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={onRemove}><Trash2 className="size-3.5"/></Button></div></div>
    <p className="text-xs text-muted-foreground">{s.description}</p>
    {msg && <p className={`text-xs ${msg.startsWith("已") ? "text-success" : "text-destructive"}`}>{msg}</p>}
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
      <span>来源：{s.source_type === "github" ? <a className="underline underline-offset-2" href={s.source_url ?? "#"} target="_blank" rel="noreferrer">{s.source_url?.replace("https://github.com/", "")}{s.path ? `/${s.path}` : ""}</a> : "手动编写"}</span>
      {s.ref && <span>版本：<span className="font-mono">{s.ref}</span></span>}
      <span>更新于 {new Date(s.updated_at).toLocaleString("zh-CN")}</span>
    </div>
    {s.files.length > 0 && <div><div className="mb-1 text-xs font-medium">附带文件 <span className="font-normal text-muted-foreground">{s.files.length}</span></div><div className="flex flex-wrap gap-1">{s.files.slice(0, 40).map(f => <span key={f} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">{f}</span>)}</div></div>}
    <div className="rounded-lg border px-5 py-4 text-[13px] leading-6">{editing ? <Textarea value={content} onChange={e => setContent(e.target.value)} rows={18} className="font-mono text-xs"/> : <MessageResponse>{s.content.replace(/^---[\s\S]*?---\s*/, "")}</MessageResponse>}</div>
  </div>;
}
