import { useState } from "react";
import { Check, LoaderCircle, Pencil, Plus, RotateCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORTED_MODELS, type ConfiguredModel } from "@/lib/ai/model-catalog";
import { verifyModel } from "@/lib/ai/model-verify.functions";
import { notifyModelsChanged, useModels } from "./useModels";

export function ModelSettings({ userId }: { userId: string | undefined }) {
  const { models, reload, loaded } = useModels(userId);
  const [editing, setEditing] = useState<ConfiguredModel | "new" | null>(null);
  const [modelId, setModelId] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const current = SUPPORTED_MODELS.find(m => m.model_id === modelId);
  const shown = models.filter(m => m.enabled);
  const openEdit = (m: ConfiguredModel | "new") => { setEditing(m); setModelId(m === "new" ? "" : m.model_id); setLabel(m === "new" ? "" : m.label); };
  const refresh = async () => { await reload(); notifyModelsChanged(); };
  async function check(id: string, rowId?: string) {
    setChecking(id);
    try {
      const result = await verifyModel({ data: { modelId: id } });
      if (rowId) {
        const { error } = await supabase.from("ai_models").update({ verified_at: result.verifiedAt }).eq("id", rowId);
        if (error) throw error;
        await refresh();
      }
      toast.success("模型已验证可用");
      return result.verifiedAt;
    } catch (e) { toast.error((e as Error).message || "模型验证失败"); return null; }
    finally { setChecking(null); }
  }
  async function save() {
    if (!userId) { toast.error("请先登录"); return; }
    if (!current) { toast.error("请选择当前服务支持的模型"); return; }
    const name = label.trim().slice(0, 80);
    if (!name) { toast.error("请输入显示名称"); return; }
    setBusy(true);
    try {
      const existing = models.find(m => m.model_id === current.model_id);
      const verifiedAt = existing?.verified_at ?? await check(current.model_id);
      if (!verifiedAt) return;
      const record = { user_id: userId, model_id: current.model_id, label: name, provider: current.provider, verified_at: verifiedAt, enabled: true };
      const { error } = await supabase.from("ai_models").upsert(record, { onConflict: "user_id,model_id" });
      if (error) throw error;
      await refresh(); setEditing(null); toast.success("模型已保存");
    } catch { toast.error("保存失败，请重试"); }
    finally { setBusy(false); }
  }
  async function remove(m: ConfiguredModel) {
    if (!confirm(`从模型菜单移除「${m.label}」？已有对话记录不会删除。`)) return;
    const { error } = await supabase.from("ai_models").update({ enabled: false }).eq("id", m.id);
    if (error) { toast.error("移除失败"); return; }
    await refresh(); if (editing !== "new" && editing?.id === m.id) setEditing(null); toast.success("已从模型菜单移除");
  }
  return <div className="py-5">
    <div className="mb-5 flex items-start justify-between gap-4"><div><h4 className="text-[14px] font-semibold">模型提供商</h4><p className="mt-1.5 text-[12px] text-muted-foreground">仅显示已保存并验证可用的模型。</p></div><Button size="sm" onClick={() => openEdit("new")} disabled={!userId}><Plus className="size-3.5"/>添加模型</Button></div>
    {!userId && <p className="mb-4 text-xs text-muted-foreground">登录后可管理模型。</p>}
    {shown.length > 0 ? <div className="space-y-2">{[...new Set(shown.map(m => m.provider))].map(provider => <div className="relay-model-card p-4" key={provider}>
      <div className="mb-3 flex items-center gap-2"><span className="text-[13px] font-medium">{provider}</span><span className="relay-model-status size-1.5 rounded-full bg-success"/><span className="ml-auto text-[11px] text-muted-foreground">已连接 · {shown.filter(m => m.provider === provider).length} 个模型</span></div>
      <div className="space-y-1">{shown.filter(m => m.provider === provider).map(m => <div key={m.id} className="relay-model-row group flex min-w-0 items-center gap-3 rounded-lg px-2 py-2">
        <div className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium">{m.label}</span><span className="block truncate font-mono text-[10px] text-muted-foreground">{m.model_id}</span></div>
        <span className="hidden shrink-0 items-center gap-1 text-[11px] text-success sm:flex"><Check className="size-3"/>已验证</span>
        <Button variant="ghost" size="icon-sm" aria-label={`编辑 ${m.label}`} title="编辑" onClick={() => openEdit(m)}><Pencil className="size-3.5"/></Button>
        <Button variant="ghost" size="icon-sm" aria-label={`移除 ${m.label}`} title="移除" onClick={() => void remove(m)}><Trash2 className="size-3.5"/></Button>
      </div>)}</div>
    </div>)}</div> : loaded && <div className="relay-model-card px-4 py-8 text-center text-xs text-muted-foreground">暂无可用模型，点击「添加模型」开始。</div>}
    {editing && <div className="relay-model-editor mt-5 space-y-4 rounded-xl p-4">
      <div className="flex items-center justify-between text-[13px] font-medium"><span>{editing === "new" ? "添加模型" : "编辑模型"}</span><Button variant="ghost" size="icon-sm" aria-label="关闭编辑" onClick={() => setEditing(null)}><X className="size-4"/></Button></div>
      <label className="block space-y-1.5 text-[11px] text-muted-foreground">模型<select aria-label="选择模型" value={modelId} onChange={e => { const next = SUPPORTED_MODELS.find(m => m.model_id === e.target.value); setModelId(e.target.value); setLabel(next?.label ?? ""); }} disabled={editing !== "new"} className="relay-model-select block h-9 w-full rounded-lg border px-3 text-[12px] text-foreground"><option value="">选择已接入的模型</option>{SUPPORTED_MODELS.map(m => <option key={m.model_id} value={m.model_id}>{m.provider} · {m.label}</option>)}</select></label>
      <label className="block space-y-1.5 text-[11px] text-muted-foreground">显示名称<Input value={label} onChange={e => setLabel(e.target.value)} maxLength={80} placeholder="模型显示名称" className="h-9 text-[12px]"/></label>
      {current && <p className="text-[11px] text-muted-foreground">{current.provider} · {current.model_id}。保存前会验证是否可用。</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">{editing !== "new" && <Button variant="outline" size="sm" disabled={!!checking} onClick={() => void check(modelId, editing.id)}>{checking ? <LoaderCircle className="size-3.5 animate-spin"/> : <RotateCw className="size-3.5"/>}重新验证</Button>}<Button size="sm" disabled={busy || !!checking || !current || !label.trim()} onClick={() => void save()}>{busy ? <LoaderCircle className="size-3.5 animate-spin"/> : <Check className="size-3.5"/>}保存</Button></div>
    </div>}
  </div>;
}
