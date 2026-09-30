import { useState } from "react";
import { Check, ChevronDown, ChevronRight, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORTED_MODELS, type ConfiguredModel } from "@/lib/ai/model-catalog";
import { verifyModel } from "@/lib/ai/model-verify.functions";
import { notifyModelsChanged, useModels } from "./useModels";

type Draft = { modelId: string; label: string };
const catalog = SUPPORTED_MODELS.filter(m => m.provider === "OpenAI");

export function ModelSettings({ userId }: { userId: string | undefined }) {
  const { models, reload, loaded } = useModels(userId);
  const saved = models.filter(m => m.enabled && m.provider === "OpenAI");
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const begin = (add = false) => {
    const next = saved.map(m => ({ modelId: m.model_id, label: m.label }));
    if (add) {
      const available = catalog.find(m => !next.some(row => row.modelId === m.model_id));
      if (available) next.push({ modelId: available.model_id, label: available.label });
      else if (saved.length) { toast.info("当前服务的模型已全部添加"); return; }
    }
    setRows(next);
    setExpanded(add || !saved.length);
    setEditing(true);
  };
  const cancel = () => { setEditing(false); setRows([]); };
  const addRow = () => {
    const available = catalog.find(m => !rows.some(row => row.modelId === m.model_id));
    if (available) setRows(previous => [...previous, { modelId: available.model_id, label: available.label }]);
  };
  const changeRow = (index: number, patch: Partial<Draft>) => setRows(previous => previous.map((row, i) => i === index ? { ...row, ...patch } : row));
  const refresh = async () => { await reload(); notifyModelsChanged(); };

  async function apply() {
    if (!userId || busy) return;
    if (rows.some(row => !row.modelId || !row.label.trim())) { toast.error("请填写模型名称"); return; }
    if (new Set(rows.map(row => row.modelId)).size !== rows.length) { toast.error("同一模型不能重复添加"); return; }
    const removed = saved.filter(m => !rows.some(row => row.modelId === m.model_id));
    if (removed.length && !window.confirm(`从模型菜单移除 ${removed.map(m => m.label).join("、")}？已有对话记录不会删除。`)) return;
    setBusy(true);
    try {
      // Verify each newly added or previously unverified model before making it available in chat.
      const records: { user_id: string; model_id: string; label: string; provider: string; verified_at: string; enabled: boolean }[] = [];
      for (const row of rows) {
        const original = models.find(m => m.model_id === row.modelId);
        const verifiedAt = original?.verified_at ?? (await verifyModel({ data: { modelId: row.modelId } })).verifiedAt;
        records.push({ user_id: userId, model_id: row.modelId, label: row.label.trim().slice(0, 80), provider: "OpenAI", verified_at: verifiedAt, enabled: true });
      }
      if (records.length) {
        const { error } = await supabase.from("ai_models").upsert(records, { onConflict: "user_id,model_id" });
        if (error) throw error;
      }
      if (removed.length) {
        const { error } = await supabase.from("ai_models").update({ enabled: false }).in("id", removed.map(m => m.id));
        if (error) throw error;
      }
      await refresh();
      cancel();
      toast.success("模型配置已保存");
    } catch (error) { toast.error((error as Error).message || "保存失败，请重试"); }
    finally { setBusy(false); }
  }
  async function recheck(model: ConfiguredModel) {
    setRefreshing(true);
    try {
      const result = await verifyModel({ data: { modelId: model.model_id } });
      const { error } = await supabase.from("ai_models").update({ verified_at: result.verifiedAt }).eq("id", model.id);
      if (error) throw error;
      await refresh(); toast.success("连接已验证");
    } catch (error) { toast.error((error as Error).message || "连接验证失败"); }
    finally { setRefreshing(false); }
  }

  const canAdd = catalog.some(m => !rows.some(row => row.modelId === m.model_id));
  return <div className="py-5">
    <div className="mb-5">
      <h4 className="text-[14px] font-semibold">模型</h4>
      <p className="mt-1.5 text-[12px] text-muted-foreground">管理已接入服务的模型。保存后可在对话中选择。</p>
    </div>
    {!userId && <p className="mb-4 text-xs text-muted-foreground">登录后可管理模型。</p>}
    {loaded && (saved.length > 0 || editing) && <div className="relay-model-card">
      <div className="flex h-14 items-center gap-2 px-4">
        <span className="font-medium text-[13px]">OpenAI</span>
        {!!saved.length && <span className="relay-model-status size-1.5 rounded-full bg-success" aria-label="已连接"/>}
        <span className="ml-auto text-[11px] text-muted-foreground">{saved.length} 个模型</span>
        {!editing && <Button variant="outline" size="sm" className="ml-2 h-7 rounded-lg px-3 text-[11px]" onClick={() => begin()} disabled={!userId}>编辑</Button>}
      </div>
      {editing ? <div className="relay-model-editor mx-3 mb-3 rounded-lg p-4">
        <div className="space-y-1.5">
          <span className="text-[11px] text-muted-foreground">提供商</span>
          <div className="relay-model-readonly flex h-9 items-center rounded-md px-3 text-[12px]">OpenAI <Check className="ml-auto size-3.5 text-success"/></div>
        </div>
        <div className="mt-4 space-y-1.5">
          <span className="text-[11px] text-muted-foreground">API 密钥</span>
          <div className="relay-model-readonly flex min-h-9 items-center rounded-md px-3 text-[11px] text-muted-foreground">由应用服务提供，无需在此填写</div>
        </div>
        <div className="mt-4 border-t border-border/60 pt-3">
          <Button variant="ghost" size="sm" className="-ml-2 h-7 gap-1 text-[11px] text-muted-foreground" onClick={() => setExpanded(v => !v)}>{expanded ? <ChevronDown className="size-3.5"/> : <ChevronRight className="size-3.5"/>}自定义设置</Button>
          {expanded && <div className="pt-3">
            <div className="mb-4 space-y-1.5"><span className="text-[11px] text-muted-foreground">服务地址</span><div className="relay-model-readonly flex min-h-9 items-center rounded-md px-3 font-mono text-[11px]">https://ai.gateway.lovable.dev/v1 <span className="ml-auto font-sans text-[10px] text-muted-foreground">只读</span></div></div>
            <div className="mb-2 text-[11px] text-muted-foreground">模型 <span className="ml-2">添加、重命名或移除已接入的模型</span></div>
            <div className="space-y-2">{rows.map((row, i) => <div className="relay-model-edit-row flex min-w-0 flex-wrap items-center gap-2 rounded-md p-1.5 sm:flex-nowrap" key={row.modelId}>
              <div className="min-w-0 flex-[1.2]">
                {saved.some(m => m.model_id === row.modelId) ? <div className="relay-model-readonly flex h-8 min-w-0 items-center truncate rounded-md px-2.5 font-mono text-[11px]" title={row.modelId}>{row.modelId}</div> : <select aria-label={`选择模型 ${i + 1}`} value={row.modelId} onChange={e => { const option = catalog.find(m => m.model_id === e.target.value); if (option) changeRow(i, { modelId: option.model_id, label: option.label }); }} className="relay-model-select h-8 w-full rounded-md border px-2 font-mono text-[11px]">{catalog.filter(m => m.model_id === row.modelId || !rows.some(r => r.modelId === m.model_id)).map(m => <option key={m.model_id} value={m.model_id}>{m.model_id}</option>)}</select>}
              </div>
              <Input aria-label={`${row.modelId} 显示名称`} value={row.label} maxLength={80} onChange={e => changeRow(i, { label: e.target.value })} className="relay-model-input h-8 min-w-0 flex-1 rounded-md px-2.5 text-[11px]"/>
              <Button variant="ghost" size="icon-sm" aria-label={`移除 ${row.label}`} title={`移除 ${row.label}`} className="size-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setRows(previous => previous.filter((_, index) => index !== i))}><Trash2 className="size-3.5"/></Button>
            </div>)}</div>
            {canAdd && <Button variant="outline" size="sm" className="mt-2 h-7 rounded-md px-2 text-[11px]" onClick={addRow}><Plus className="size-3"/>添加模型</Button>}
            {!rows.length && <p className="py-3 text-[11px] text-muted-foreground">尚无模型。添加模型后即可在对话中切换。</p>}
          </div>}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={cancel} disabled={busy}>取消</Button>
          <Button size="sm" className="h-8" onClick={() => void apply()} disabled={busy || rows.some(row => !row.label.trim())}>{busy && <LoaderCircle className="size-3.5 animate-spin"/>}应用</Button>
        </div>
      </div> : <div className="border-t border-border/60 px-4 py-3">
        <div className="space-y-1.5">{saved.map(model => <div key={model.id} className="relay-model-summary flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5">
          <Button variant="ghost" size="sm" className="min-w-0 flex-1 justify-start gap-2 px-1.5 text-left text-[12px]" onClick={() => begin()}><span className="truncate font-medium">{model.label}</span><span className="ml-auto hidden min-w-0 max-w-[55%] truncate font-mono text-[11px] text-muted-foreground sm:block">{model.model_id}</span><ChevronRight className="size-3.5 shrink-0 text-muted-foreground"/></Button>
          <Button variant="ghost" size="icon-sm" title={`验证 ${model.label}`} aria-label={`验证 ${model.label}`} disabled={refreshing} className="size-6 shrink-0 text-success" onClick={() => void recheck(model)}>{refreshing ? <LoaderCircle className="size-3 animate-spin"/> : <Check className="size-3"/>}</Button>
        </div>)}</div>
      </div>}
    </div>}
    {loaded && <Button variant="outline" className="relay-model-add mt-3 h-10 w-full justify-center rounded-lg border-dashed text-[12px]" disabled={!userId} onClick={() => begin(true)}><Plus className="size-3.5"/>{saved.length ? "添加模型" : "添加提供商"}</Button>}
  </div>;
}
