import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, LoaderCircle, Plus, Trash2, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SUPPORTED_MODELS, type ConfiguredModel } from "@/lib/ai/model-catalog";
import { saveModel, removeModel, fetchProviderModels } from "@/lib/ai/model-management.functions";
import { notifyModelsChanged, useModels } from "./useModels";

type Draft = { id?: string; modelId: string; label: string; version: string; description: string; reasoningEffort: "low" | "medium" | "high"; connectionType: "gateway" | "direct"; providerName: string; baseUrl: string; apiKey: string };
const initialDraft = (): Draft => ({ modelId: "", label: "", version: "", description: "", reasoningEffort: "medium", connectionType: "direct", providerName: "OpenAI", baseUrl: "", apiKey: "" });
const fromModel = (m: ConfiguredModel): Draft => ({ id: m.id, modelId: m.model_id, label: m.label, version: m.version ?? "", description: m.description ?? "", reasoningEffort: m.parameters?.reasoningEffort ?? "medium", connectionType: m.connection_type === "direct" ? "direct" : "gateway", providerName: m.provider, baseUrl: m.base_url ?? "", apiKey: "" });

export function ModelSettings({ userId }: { userId: string | undefined }) {
  const { models, reload, loaded } = useModels(userId);
  const saved = models.filter(m => m.enabled);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<string[] | null>(null);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const lastDiscovery = useRef("");
  const patch = (p: Partial<Draft>) => { setDraft(v => v ? { ...v, ...p } : v); if ("baseUrl" in p || "apiKey" in p || "providerName" in p) setCatalog(null); };
  const edit = (m: ConfiguredModel) => { lastDiscovery.current = ""; setCatalog(null); setDraft(fromModel(m)); };
  useEffect(() => {
    if (!draft || draft.connectionType !== "direct" || !draft.baseUrl.startsWith("https://") || (!draft.apiKey && !draft.id)) return;
    const signature = `${draft.id ?? ""}|${draft.baseUrl}|${draft.apiKey}`;
    if (lastDiscovery.current === signature) return;
    const timer = window.setTimeout(() => { lastDiscovery.current = signature; void loadCatalog(); }, 900);
    return () => window.clearTimeout(timer);
  }, [draft?.id, draft?.connectionType, draft?.baseUrl, draft?.apiKey]);
  async function loadCatalog() {
    if (!draft?.baseUrl) { toast.error("请填写服务地址"); return; }
    setCatalogBusy(true);
    try { const result = await fetchProviderModels({ data: { id: draft.id, baseUrl: draft.baseUrl, apiKey: draft.apiKey || undefined } }); setCatalog(result.models); if (!result.models.length) toast.message("目录为空，可手动添加模型 ID"); }
    catch (e) { setCatalog(null); toast.error((e as Error).message || "无法读取目录，可手动添加"); }
    finally { setCatalogBusy(false); }
  }
  const refresh = async () => { await reload(); notifyModelsChanged(); };

  async function save() {
    if (!draft || busy) return;
    if (!draft.modelId.trim() || !draft.label.trim()) { toast.error("请填写模型 ID 和显示名称"); return; }
    if (draft.connectionType === "direct" && !draft.apiKey && !draft.id) { toast.error("请填写 OpenAI API Key"); return; }
    setBusy(true);
    try {
      await saveModel({ data: draft });
      await refresh(); setDraft(null);
      toast.success("已验证并保存，模型现在可在对话中切换");
    } catch (e) { toast.error((e as Error).message || "保存失败"); }
    finally { setBusy(false); }
  }
  async function remove(m: ConfiguredModel) {
    if (!window.confirm(`从模型菜单移除「${m.label}」？已有对话不会删除。`)) return;
    setBusy(true);
    try { await removeModel({ data: { id: m.id } }); await refresh(); setDraft(null); toast.success("已从模型菜单移除"); }
    catch (e) { toast.error((e as Error).message || "移除失败"); }
    finally { setBusy(false); }
  }

  return <div className="py-5">
    <div className="mb-5">
      <h4 className="text-[15px] font-semibold">模型</h4>
      <p className="mt-2 text-[12px] text-muted-foreground">连接服务并管理对话可用的模型。</p>
    </div>
    {!userId && <p className="mb-4 text-xs text-muted-foreground">登录后可管理模型。</p>}
    {loaded && (saved.length > 0 || editing) && <div className="relay-model-card">
      <div className="flex h-14 items-center gap-2 px-4">
        <span className="text-[13px] font-semibold">模型服务</span>
        {saved.length > 0 && <span className="relay-model-status size-2 rounded-full bg-success" aria-label="已连接"/>}
        {!editing && <Button variant="outline" size="sm" className="ml-auto h-8 rounded-md px-4" onClick={() => setEditing(true)} disabled={!userId}>编辑</Button>}
        {editing && <Button variant="ghost" size="sm" className="ml-auto h-8" onClick={() => { setEditing(false); setDraft(null); }}><ArrowLeft className="size-3.5"/>返回</Button>}
      </div>
      {editing && <div className="relay-model-editor mx-3 mb-3 rounded-lg p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2 text-[12px] font-medium">已配置模型 <span className="text-muted-foreground">{saved.length}</span></div>
        <div className="space-y-1.5">{saved.map(m => <div key={m.id} className="relay-model-edit-row flex min-w-0 items-center gap-3 rounded-md border border-border/60 p-2.5">
          <span className="relay-model-status size-1.5 shrink-0 rounded-full bg-success"/>
          <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-medium">{m.label} <span className="font-normal text-muted-foreground">{m.version}</span></div><div className="truncate font-mono text-[10.5px] text-muted-foreground">{m.model_id} · {m.connection_type === "direct" ? m.provider : "应用服务"}</div></div>
          <Button variant="outline" size="sm" className="h-7 shrink-0 text-[11px]" onClick={() => edit(m)}>编辑</Button>
          <Button variant="ghost" size="icon-sm" aria-label={`移除 ${m.label}`} title={`移除 ${m.label}`} className="size-7 shrink-0 text-muted-foreground hover:text-destructive" disabled={busy} onClick={() => void remove(m)}><Trash2 className="size-3.5"/></Button>
        </div>)}</div>
        {!draft && <Button variant="outline" className="relay-model-add mt-3 h-9 w-full border-dashed" onClick={() => setDraft(initialDraft())}><Plus className="size-3.5"/>添加模型</Button>}
        {draft && <div className="mt-3 rounded-lg border border-border bg-background p-3 sm:p-4">
          <div className="mb-4 flex items-center justify-between"><strong className="text-[12px]">{draft.id ? "编辑模型" : "添加模型"}</strong><Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setDraft(null)}>取消</Button></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-[11px] text-muted-foreground">连接方式<select aria-label="连接方式" className="relay-model-select h-9 w-full rounded-md px-2.5 text-[12px]" value={draft.connectionType} onChange={e => patch({ connectionType: e.target.value as Draft["connectionType"], modelId: "", providerName: "OpenAI", baseUrl: "" })}><option value="direct">厂商 API</option><option value="gateway">应用服务</option></select></label>
            <label className="space-y-1.5 text-[11px] text-muted-foreground">模型 ID{draft.connectionType === "gateway" ? <select aria-label="模型 ID" className="relay-model-select h-9 w-full rounded-md px-2.5 text-[12px]" value={draft.modelId} onChange={e => { const found = SUPPORTED_MODELS.find(m => m.model_id === e.target.value); patch({ modelId: e.target.value, label: draft.label || found?.label || "" }); }}><option value="">选择模型</option>{SUPPORTED_MODELS.map(m => <option key={m.model_id} value={m.model_id}>{m.model_id}</option>)}</select> : <Input aria-label="模型 ID" placeholder="从目录选择或手动输入" className="relay-model-input h-9" value={draft.modelId} onChange={e => patch({ modelId: e.target.value })}/>}</label>
            <label className="space-y-1.5 text-[11px] text-muted-foreground">显示名称<Input aria-label="显示名称" placeholder="在模型菜单中显示" className="relay-model-input h-9" maxLength={80} value={draft.label} onChange={e => patch({ label: e.target.value })}/></label>
            <label className="space-y-1.5 text-[11px] text-muted-foreground">版本<Input aria-label="版本" placeholder="例如 2026-09" className="relay-model-input h-9" maxLength={80} value={draft.version} onChange={e => patch({ version: e.target.value })}/></label>
          </div>
          {draft.connectionType === "direct" && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-[11px] text-muted-foreground">厂商名称<Input aria-label="厂商名称" className="relay-model-input h-9" value={draft.providerName} maxLength={80} onChange={e => patch({ providerName: e.target.value })}/></label><label className="space-y-1.5 text-[11px] text-muted-foreground">服务地址（以 /v1 结尾）<Input aria-label="服务地址" placeholder="https://api.example.com/v1" className="relay-model-input h-9" value={draft.baseUrl} onChange={e => patch({ baseUrl: e.target.value })}/></label></div>}
          {draft.connectionType === "direct" && draft.baseUrl && <div className="mt-3"><Button variant="outline" size="sm" disabled={catalogBusy || (!draft.apiKey && !draft.id)} onClick={() => void loadCatalog()}>{catalogBusy ? <LoaderCircle className="size-3.5 animate-spin"/> : <RefreshCw className="size-3.5"/>}刷新模型目录</Button>{catalog && <label className="mt-2 block space-y-1.5 text-[11px] text-muted-foreground">已发现 {catalog.length} 个模型<select aria-label="已发现模型" className="relay-model-select h-9 w-full rounded-md px-2.5 text-[12px]" value={catalog.includes(draft.modelId) ? draft.modelId : ""} onChange={e => patch({ modelId: e.target.value, label: draft.label || e.target.value })}><option value="">选择模型，或在上方手动填写 ID</option>{catalog.map(id => <option key={id} value={id}>{id}</option>)}</select></label>}</div>}
          <label className="mt-3 block space-y-1.5 text-[11px] text-muted-foreground">描述<Input aria-label="描述" placeholder="模型用途与特点" className="relay-model-input h-9" maxLength={500} value={draft.description} onChange={e => patch({ description: e.target.value })}/></label>
          {draft.connectionType === "direct" ? <label className="mt-3 block space-y-1.5 text-[11px] text-muted-foreground">API Key<Input aria-label="API Key" type="password" autoComplete="new-password" placeholder={draft.id ? "留空沿用已保存的密钥" : "填写厂商 API Key"} className="relay-model-input h-9" value={draft.apiKey} onChange={e => patch({ apiKey: e.target.value })}/><span className="block text-[10px]">密钥只用于服务端拉取与验证，不会回显。目录不兼容时可手动填写模型 ID。</span></label> : <p className="mt-3 text-[11px] text-muted-foreground">应用服务使用现有连接，无需填写 API Key。</p>}
          <div className="mt-3 border-t border-border pt-2"><Button variant="ghost" size="sm" className="-ml-2 h-8 text-[11px]" onClick={() => setExpanded(v => !v)}>{expanded ? <ChevronDown className="size-3.5"/> : <ChevronRight className="size-3.5"/>}请求参数</Button>{expanded && <label className="mt-2 block space-y-1.5 text-[11px] text-muted-foreground">推理强度<select aria-label="推理强度" className="relay-model-select h-9 w-full rounded-md px-2.5 text-[12px]" value={draft.reasoningEffort} onChange={e => patch({ reasoningEffort: e.target.value as Draft["reasoningEffort"] })}><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label>}</div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setDraft(null)} disabled={busy}>取消</Button><Button size="sm" disabled={busy || !draft.modelId || !draft.label} onClick={() => void save()}>{busy ? <LoaderCircle className="size-3.5 animate-spin"/> : <Check className="size-3.5"/>}验证并保存</Button></div>
        </div>}
      </div>}
    </div>}
    {loaded && !editing && <Button variant="outline" className="relay-model-add mt-3 h-10 w-full justify-center rounded-lg border-dashed text-[12px]" disabled={!userId} onClick={() => { setEditing(true); setDraft(initialDraft()); }}><Plus className="size-3.5"/>添加模型</Button>}
  </div>;
}