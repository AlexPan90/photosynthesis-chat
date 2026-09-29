import { useEffect, useState } from "react";
import { Bot, Check, CircleAlert, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageResponse } from "@/components/ai-elements/message";
import { supabase } from "@/integrations/supabase/client";
import { BUILTIN_AGENTS, TOOL_CATALOG, type AgentConfig } from "@/lib/ai/agents.shared";

export const toolLabel = (id: string) => TOOL_CATALOG.find(t => t.id === id)?.label ?? id;

export function useAgents() {
  const [custom, setCustom] = useState<AgentConfig[]>([]);
  const reload = async () => {
    const { data } = await supabase.from("agents").select("id,name,description,system_prompt,model,tool_ids").order("created_at");
    setCustom((data ?? []) as AgentConfig[]);
  };
  useEffect(() => { reload(); }, []);
  return { agents: [...BUILTIN_AGENTS, ...custom], custom, reload };
}

const empty = { name: "", description: "", system_prompt: "", model: "openai/gpt-6-astra", tool_ids: [] as string[] };

export function AgentManager({ open, onOpenChange, custom, reload, models }: { open: boolean; onOpenChange: (v: boolean) => void; custom: AgentConfig[]; reload: () => Promise<void>; models: { id: string; label: string }[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  function edit(a?: AgentConfig) { setErr(""); setEditing(a?.id ?? "new"); setForm(a ? { name: a.name, description: a.description, system_prompt: a.system_prompt, model: a.model, tool_ids: a.tool_ids } : empty); }
  async function save() {
    if (!form.name.trim()) return setErr("请填写名称");
    setSaving(true); setErr("");
    const payload = { ...form, name: form.name.trim().slice(0, 40), description: form.description.trim().slice(0, 120) };
    const { error } = editing === "new" ? await supabase.from("agents").insert(payload) : await supabase.from("agents").update(payload).eq("id", editing!);
    setSaving(false);
    if (error) return setErr("保存失败，请重试");
    await reload(); setEditing(null);
  }
  async function remove(id: string) { await supabase.from("agents").delete().eq("id", id); await reload(); if (editing === id) setEditing(null); }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-[720px] gap-0 p-0">
    <DialogHeader className="border-b px-5 py-4"><DialogTitle className="text-sm">Agent</DialogTitle><DialogDescription className="text-xs">在输入框右下角像选模型一样选用 Agent；任何对话中也可以让 AI 把子任务委派给它们。</DialogDescription></DialogHeader>
    <div className="grid min-h-[420px] grid-cols-[220px_1fr]">
      <div className="soft-scroll space-y-0.5 overflow-y-auto border-r p-2">
        <div className="px-2 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">内置</div>
        {BUILTIN_AGENTS.map(a => <div key={a.id} className="rounded-md px-2 py-1.5 text-xs text-muted-foreground"><div className="font-medium text-foreground">{a.name}</div><div className="truncate text-[11px]">{a.description}</div></div>)}
        <div className="flex items-center px-2 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">我的<button className="ml-auto rounded p-0.5 hover:bg-secondary" aria-label="新建 Agent" onClick={() => edit()}><Plus className="size-3.5"/></button></div>
        {custom.length === 0 && <p className="px-2 py-1 text-[11px] text-muted-foreground">还没有自定义 Agent</p>}
        {custom.map(a => <button key={a.id} onClick={() => edit(a)} className={`group flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs hover:bg-secondary ${editing === a.id ? "bg-secondary" : ""}`}><span className="min-w-0 flex-1"><span className="block truncate font-medium">{a.name}</span><span className="block truncate text-[11px] text-muted-foreground">{a.description || "未填写说明"}</span></span></button>)}
      </div>
      {editing ? <div className="space-y-3 p-5">
        <label className="block space-y-1 text-xs"><span className="text-muted-foreground">名称</span><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="例如：周报助手" className="h-8 text-xs"/></label>
        <label className="block space-y-1 text-xs"><span className="text-muted-foreground">一句话职责（用于委派时让 AI 判断）</span><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="h-8 text-xs"/></label>
        <label className="block space-y-1 text-xs"><span className="text-muted-foreground">系统提示词</span><Textarea value={form.system_prompt} onChange={e => setForm({ ...form, system_prompt: e.target.value })} rows={5} className="text-xs"/></label>
        <div className="flex gap-6 text-xs">
          <div className="space-y-1.5"><span className="text-muted-foreground">默认模型</span><select value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="block h-8 rounded-md border bg-background px-2 text-xs">{models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
          <div className="space-y-1.5"><span className="text-muted-foreground">可用工具</span><div className="flex flex-wrap gap-3 pt-1.5">{TOOL_CATALOG.map(t => <label key={t.id} className="flex items-center gap-1.5"><Checkbox checked={form.tool_ids.includes(t.id)} onCheckedChange={v => setForm({ ...form, tool_ids: v ? [...form.tool_ids, t.id] : form.tool_ids.filter(x => x !== t.id) })}/>{t.label}</label>)}</div></div>
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
        <div className="flex items-center gap-2 pt-2">
          {editing !== "new" && <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => remove(editing)}><Trash2 className="size-3.5"/>删除</Button>}
          <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setEditing(null)}>取消</Button>
          <Button size="sm" className="text-xs" disabled={saving} onClick={save}>{saving && <LoaderCircle className="size-3.5 animate-spin"/>}保存</Button>
        </div>
      </div> : <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-xs text-muted-foreground"><Bot className="size-6"/>选择左侧 Agent 编辑，或新建一个<Button size="sm" variant="outline" className="text-xs" onClick={() => edit()}><Plus className="size-3.5"/>新建 Agent</Button></div>}
    </div>
  </DialogContent></Dialog>;
}

type Progress = { agentName: string; status: "running" | "done" | "error"; steps: { tool: string; state: "running" | "done" | "error"; detail?: string }[]; text: string };

/** 委派执行记录：子 Agent 的每一步工具调用 + 流式结果。 */
export function DelegateCard({ task, output, errorText, preliminary }: { task?: string; output?: Progress; errorText?: string; preliminary?: boolean }) {
  const running = !errorText && (!output || preliminary || output.status === "running");
  return <div className="my-2 rounded-lg border bg-card/60 px-3.5 py-3 text-xs">
    <div className="flex items-center gap-2"><Bot className="size-3.5 text-primary"/><span className="font-medium">委派给 {output?.agentName ?? "Agent"}</span>
      <span className={`ml-auto flex items-center gap-1 text-[11px] ${errorText ? "text-destructive" : running ? "text-primary" : "text-success"}`}>{errorText ? <><CircleAlert className="size-3"/>失败</> : running ? <><LoaderCircle className="size-3 animate-spin"/>执行中</> : <><Check className="size-3"/>完成</>}</span></div>
    {task && <p className="mt-1.5 text-muted-foreground">{task}</p>}
    {!!output?.steps.length && <ol className="mt-2.5 space-y-1 border-l pl-3">{output.steps.map((s, i) => <li key={i} className="flex items-center gap-2"><span className={`size-1.5 shrink-0 rounded-full ${s.state === "done" ? "bg-success" : s.state === "error" ? "bg-destructive" : "animate-pulse bg-primary"}`}/><span className={s.state === "error" ? "text-destructive" : ""}>{toolLabel(s.tool)}</span><span className="truncate font-mono text-[10.5px] text-muted-foreground">{s.detail}</span></li>)}</ol>}
    {output?.text && <div className="mt-2.5 border-t pt-2.5 text-[12.5px] leading-6"><MessageResponse>{output.text}</MessageResponse></div>}
    {errorText && <p className="mt-2 text-destructive">{errorText}</p>}
  </div>;
}
