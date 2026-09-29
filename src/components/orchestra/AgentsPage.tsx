import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, Bot, GripVertical, LoaderCircle, Play, Plug, Plus, Trash2, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { BUILTIN_AGENTS, TOOL_CATALOG, type AgentConfig } from "@/lib/ai/agents.shared";
import { useAgents } from "@/components/studio/Agents";
import { liveModelGroups } from "@/components/studio/LiveChat";
import { useMcpConnections, useSkills } from "./data";

type Kind = "tool" | "mcp" | "skill" | "agent";
type Cap = { kind: Kind; id: string; label: string; hint?: string };
type Form = { name: string; description: string; system_prompt: string; model: string; tool_ids: string[]; mcp_tool_ids: string[]; skill_ids: string[]; delegate_ids: string[] };
const FIELD: Record<Kind, keyof Form> = { tool: "tool_ids", mcp: "mcp_tool_ids", skill: "skill_ids", agent: "delegate_ids" };
const ICON = { tool: Wrench, mcp: Plug, skill: BookOpen, agent: Bot };
const KIND_LABEL: Record<Kind, string> = { tool: "内置工具", mcp: "MCP 工具", skill: "Skills", agent: "可委派 Agent" };
const MIME = "application/x-relay-cap";
const models = liveModelGroups.flatMap(g => g.models.map(m => ({ id: m.id, label: m.label })));
const toForm = (a?: AgentConfig): Form => ({ name: a?.name ?? "", description: a?.description ?? "", system_prompt: a?.system_prompt ?? "", model: a?.model ?? "openai/gpt-6-astra", tool_ids: a?.tool_ids ?? [], mcp_tool_ids: a?.mcp_tool_ids ?? [], skill_ids: a?.skill_ids ?? [], delegate_ids: a?.delegate_ids ?? [] });

export function AgentsPage() {
  const navigate = useNavigate();
  const { custom, reload } = useAgents();
  const mcp = useMcpConnections();
  const skills = useSkills();
  const [order, setOrder] = useState<AgentConfig[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(toForm());
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dragAgent, setDragAgent] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  useEffect(() => { setOrder(custom); }, [custom]);
  const current = sel && sel !== "new" ? [...BUILTIN_AGENTS, ...custom].find(a => a.id === sel) : undefined;
  const readOnly = !!current?.builtin;
  function pick(a?: AgentConfig | "new") {
    if (dirty && !confirm("有未保存的修改，确定切换？")) return;
    setSel(a === "new" ? "new" : a?.id ?? null); setForm(toForm(a === "new" ? undefined : a)); setDirty(false); setMsg("");
  }
  const patch = (p: Partial<Form>) => { setForm(f => ({ ...f, ...p })); setDirty(true); };

  const palette = useMemo(() => {
    const groups: { kind: Kind; title: string; items: Cap[]; empty: string }[] = [
      { kind: "tool", title: "内置工具", items: TOOL_CATALOG.map(t => ({ kind: "tool" as const, id: t.id, label: t.label })), empty: "" },
      { kind: "mcp", title: "MCP 工具", items: mcp.items.filter(c => c.state === "ready").flatMap(c => c.tools.filter(t => !c.disabled_tools.includes(t.name)).map(t => ({ kind: "mcp" as const, id: `mcp:${c.id}:${t.name}`, label: t.name, hint: c.name }))), empty: "去「MCP 连接」添加服务" },
      { kind: "skill", title: "Skills", items: skills.items.filter(s => s.enabled).map(s => ({ kind: "skill" as const, id: s.id, label: s.name, hint: s.description })), empty: "去「Skills」安装" },
      { kind: "agent", title: "Agent（委派）", items: [...BUILTIN_AGENTS, ...custom].filter(a => a.id !== sel).map(a => ({ kind: "agent" as const, id: a.id, label: a.name, hint: a.description })), empty: "" },
    ];
    return groups;
  }, [mcp.items, skills.items, custom, sel]);
  const capLabel = (kind: Kind, id: string) => palette.find(g => g.kind === kind)?.items.find(i => i.id === id) ?? { kind, id, label: kind === "mcp" ? id.split(":").slice(2).join(":") + "（已失效）" : id, hint: undefined };

  function add(c: { kind: Kind; id: string }) {
    const f = FIELD[c.kind];
    if ((form[f] as string[]).includes(c.id)) return;
    patch({ [f]: [...(form[f] as string[]), c.id] } as Partial<Form>);
  }
  const remove = (kind: Kind, id: string) => patch({ [FIELD[kind]]: (form[FIELD[kind]] as string[]).filter(x => x !== id) } as Partial<Form>);
  function onDropCap(e: DragEvent, before?: { kind: Kind; id: string }) {
    e.preventDefault(); e.stopPropagation(); setOver(false);
    const raw = e.dataTransfer.getData(MIME); if (!raw || readOnly) return;
    const c = JSON.parse(raw) as { kind: Kind; id: string };
    const f = FIELD[c.kind];
    const list = (form[f] as string[]).filter(x => x !== c.id);
    const idx = before && before.kind === c.kind ? list.indexOf(before.id) : -1;
    idx >= 0 ? list.splice(idx, 0, c.id) : list.push(c.id);
    patch({ [f]: list } as Partial<Form>);
  }
  const dragCap = (c: { kind: Kind; id: string }) => (e: DragEvent) => { e.dataTransfer.setData(MIME, JSON.stringify({ kind: c.kind, id: c.id })); e.dataTransfer.effectAllowed = "copyMove"; };

  async function dropAgent(target: string) {
    if (!dragAgent || dragAgent === target) return;
    const list = order.filter(a => a.id !== dragAgent);
    list.splice(list.findIndex(a => a.id === target), 0, order.find(a => a.id === dragAgent)!);
    setOrder(list); setDragAgent(null);
    await Promise.all(list.map((a, i) => supabase.from("agents").update({ sort_order: i }).eq("id", a.id)));
    await reload();
  }

  async function save() {
    if (!form.name.trim()) return setMsg("请填写名称");
    setBusy(true); setMsg("");
    const payload = { ...form, name: form.name.trim().slice(0, 40), description: form.description.trim().slice(0, 120) };
    const res = sel === "new"
      ? await supabase.from("agents").insert({ ...payload, sort_order: order.length }).select("id").single()
      : await supabase.from("agents").update(payload).eq("id", sel!).select("id").single();
    setBusy(false);
    if (res.error) return setMsg("保存失败，请重试");
    setDirty(false); setSel(res.data.id); setMsg("已保存"); await reload();
  }
  async function del() {
    if (!current || readOnly || !confirm(`删除 Agent「${current.name}」？`)) return;
    await supabase.from("agents").delete().eq("id", current.id); setSel(null); setDirty(false); await reload();
  }
  async function tryRun() {
    if (!sel || sel === "new") return;
    const { data, error } = await supabase.from("threads").insert({ title: `试运行 · ${form.name}`, agent_id: sel, model: form.model, permission: localStorage.getItem("relay-default-permission") ?? "ask" }).select("id").single();
    if (error || !data) return setMsg("创建试运行对话失败");
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
  }

  const chips = (Object.keys(FIELD) as Kind[]).flatMap(k => (form[FIELD[k]] as string[]).map(id => ({ ...capLabel(k, id), kind: k })));

  return <div className="grid h-full grid-cols-[240px_1fr_280px]">
    {/* 左：Agent 列表 */}
    <aside className="soft-scroll overflow-y-auto border-r p-2">
      <div className="flex items-center px-2 py-1.5 text-[11px] font-medium text-muted-foreground">我的 Agent<button onClick={() => pick("new")} className="ml-auto rounded p-1 hover:bg-secondary" aria-label="新建 Agent"><Plus className="size-3.5"/></button></div>
      {order.length === 0 && <button onClick={() => pick("new")} className="m-1 w-[calc(100%-8px)] rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground hover:bg-secondary">+ 新建第一个 Agent</button>}
      {sel === "new" && <div className="mb-0.5 rounded-md bg-secondary px-2 py-2 text-xs font-medium">新 Agent（未保存）</div>}
      {order.map(a => <div key={a.id} draggable onDragStart={() => setDragAgent(a.id)} onDragOver={e => e.preventDefault()} onDrop={() => dropAgent(a.id)} onClick={() => pick(a)}
        className={`group mb-0.5 flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-2 text-xs hover:bg-secondary ${sel === a.id ? "bg-secondary" : ""} ${dragAgent === a.id ? "opacity-40" : ""}`}>
        <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/50 group-hover:text-muted-foreground"/>
        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{a.name}</span><span className="block truncate text-[11px] text-muted-foreground">{a.description || "未填写职责"}</span></span>
      </div>)}
      <div className="px-2 pb-1.5 pt-4 text-[11px] font-medium text-muted-foreground">内置</div>
      {BUILTIN_AGENTS.map(a => <div key={a.id} onClick={() => pick(a)} className={`mb-0.5 cursor-pointer rounded-md px-2 py-2 text-xs hover:bg-secondary ${sel === a.id ? "bg-secondary" : ""}`}><span className="block truncate font-medium">{a.name}</span><span className="block truncate text-[11px] text-muted-foreground">{a.description}</span></div>)}
      <p className="px-2 pt-4 text-[10.5px] leading-5 text-muted-foreground/80">拖动左侧手柄调整顺序，输入框模型菜单按此顺序显示。</p>
    </aside>

    {/* 中：编辑区 */}
    <section className="soft-scroll min-w-0 overflow-y-auto">
      {!sel ? <div className="flex h-full flex-col items-center justify-center gap-3 text-xs text-muted-foreground"><Bot className="size-6"/>选择一个 Agent 编辑，或新建一个<Button size="sm" variant="outline" onClick={() => pick("new")}><Plus className="size-3.5"/>新建 Agent</Button></div> :
      <div className="mx-auto max-w-[680px] space-y-5 px-8 py-6">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{form.name || "未命名 Agent"}</h2>
          {readOnly && <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">内置 · 只读</span>}
          {dirty && <span className="text-[11px] text-muted-foreground">· 未保存</span>}
          <div className="ml-auto flex gap-1.5">
            {sel !== "new" && <Button size="sm" variant="outline" className="text-xs" onClick={tryRun} disabled={dirty}><Play className="size-3.5"/>试运行</Button>}
            {!readOnly && sel !== "new" && <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={del}><Trash2 className="size-3.5"/></Button>}
            {!readOnly && <Button size="sm" className="text-xs" onClick={save} disabled={busy || !dirty}>{busy && <LoaderCircle className="size-3.5 animate-spin"/>}保存</Button>}
          </div>
        </div>
        {msg && <p className={`text-xs ${msg === "已保存" ? "text-success" : "text-destructive"}`}>{msg}</p>}
        <fieldset disabled={readOnly} className="space-y-4">
          <div className="grid grid-cols-[1fr_180px] gap-3">
            <label className="space-y-1 text-xs"><span className="text-muted-foreground">名称</span><Input value={form.name} onChange={e => patch({ name: e.target.value })} placeholder="例如：周报助手" className="h-8 text-xs"/></label>
            <label className="space-y-1 text-xs"><span className="text-muted-foreground">默认模型</span><select value={form.model} onChange={e => patch({ model: e.target.value })} className="block h-8 w-full rounded-md border bg-background px-2 text-xs">{models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
          </div>
          <label className="block space-y-1 text-xs"><span className="text-muted-foreground">一句话职责（委派时 AI 据此判断）</span><Input value={form.description} onChange={e => patch({ description: e.target.value })} className="h-8 text-xs"/></label>
          <label className="block space-y-1 text-xs"><span className="text-muted-foreground">系统提示词</span><Textarea value={form.system_prompt} onChange={e => patch({ system_prompt: e.target.value })} rows={7} className="text-xs leading-5"/></label>
        </fieldset>
        <div>
          <div className="mb-1.5 flex items-baseline text-xs"><span className="font-medium">能力</span><span className="ml-2 text-[11px] text-muted-foreground">从右侧拖入，或点击 + 添加；拖动卡片调整顺序</span></div>
          <div onDragOver={e => { if (!readOnly) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)} onDrop={e => onDropCap(e)}
            className={`min-h-[120px] rounded-lg border border-dashed p-2 transition-colors ${over ? "border-primary bg-primary/5" : ""}`}>
            {chips.length === 0 && <p className="py-9 text-center text-xs text-muted-foreground">把工具、MCP、Skills 或其他 Agent 拖到这里</p>}
            {(Object.keys(FIELD) as Kind[]).map(k => { const list = chips.filter(c => c.kind === k); if (!list.length) return null; const Icon = ICON[k];
              return <div key={k} className="mb-1.5"><div className="px-1 pb-1 pt-1 text-[10.5px] text-muted-foreground">{KIND_LABEL[k]}</div><div className="flex flex-wrap gap-1.5">
                {list.map(c => <span key={c.id} draggable={!readOnly} onDragStart={dragCap(c)} onDragOver={e => e.preventDefault()} onDrop={e => onDropCap(e, c)} title={c.hint}
                  className="flex h-7 cursor-grab items-center gap-1.5 rounded-md border bg-card pl-2 pr-1 text-xs"><Icon className="size-3 text-muted-foreground"/>{c.label}{c.kind === "mcp" && c.hint && <span className="text-[10.5px] text-muted-foreground">· {c.hint}</span>}
                  {!readOnly && <button onClick={() => remove(c.kind, c.id)} className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="移除"><X className="size-3"/></button>}</span>)}
              </div></div>; })}
          </div>
          {!readOnly && form.delegate_ids.length === 0 && <p className="mt-1.5 text-[11px] text-muted-foreground">未添加可委派 Agent 时，这个 Agent 不会把任务交给别人。</p>}
        </div>
      </div>}
    </section>

    {/* 右：能力库 */}
    <aside className="soft-scroll overflow-y-auto border-l p-3">
      <div className="pb-2 text-[11px] font-medium text-muted-foreground">能力库</div>
      {palette.map(g => { const Icon = ICON[g.kind]; return <div key={g.kind} className="mb-4">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium"><Icon className="size-3 text-muted-foreground"/>{g.title}<span className="text-muted-foreground">{g.items.length}</span></div>
        {g.items.length === 0 && <p className="px-1 text-[11px] text-muted-foreground">{g.empty}</p>}
        {g.items.map(c => { const added = (form[FIELD[c.kind]] as string[]).includes(c.id);
          return <div key={c.id} draggable={!!sel && !readOnly} onDragStart={dragCap(c)} className={`group flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs ${sel && !readOnly ? "cursor-grab hover:bg-secondary" : ""}`} title={c.hint}>
            <GripVertical className="size-3 shrink-0 text-muted-foreground/40"/>
            <span className="min-w-0 flex-1"><span className={`block truncate ${added ? "text-muted-foreground" : ""}`}>{c.label}</span>{c.hint && <span className="block truncate text-[10.5px] text-muted-foreground">{c.hint}</span>}</span>
            {sel && !readOnly && (added ? <span className="text-[10px] text-muted-foreground">已添加</span> : <button onClick={() => add(c)} className="rounded p-0.5 opacity-0 hover:bg-background group-hover:opacity-100" aria-label={`添加 ${c.label}`}><Plus className="size-3.5"/></button>)}
          </div>; })}
      </div>; })}
    </aside>
  </div>;
}
