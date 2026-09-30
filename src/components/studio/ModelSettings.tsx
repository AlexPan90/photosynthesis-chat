import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, LoaderCircle, Plus, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SUPPORTED_MODELS, type ConfiguredModel } from "@/lib/ai/model-catalog";
import { saveModel, removeModel, fetchProviderModels } from "@/lib/ai/model-management.functions";
import { getOpenAIConnection, testOpenAIConnection } from "@/lib/ai/openai-connection.functions";
import { notifyModelsChanged, useModels } from "./useModels";

type Draft = { id?: string; modelId: string; label: string; version: string; description: string; reasoningEffort: "low" | "medium" | "high"; connectionType: "gateway" | "direct"; providerName: string; baseUrl: string; apiKey: string };
const initialDraft = (providerName = "OpenAI", baseUrl = ""): Draft => ({ modelId: "", label: "", version: "", description: "", reasoningEffort: "medium", connectionType: "direct", providerName, baseUrl, apiKey: "" });
const fromModel = (m: ConfiguredModel): Draft => ({ id: m.id, modelId: m.model_id, label: m.label, version: m.version ?? "", description: m.description ?? "", reasoningEffort: m.parameters?.reasoningEffort ?? "medium", connectionType: m.connection_type === "direct" ? "direct" : "gateway", providerName: m.provider, baseUrl: m.base_url ?? "", apiKey: "" });

export function ModelSettings({ userId }: { userId: string | undefined }) {
  const { models, reload, loaded } = useModels(userId);
  const saved = models.filter(m => m.enabled && (m.connection_type !== "direct" || m.verified_at));
  const providers = [...new Set(["OpenAI", ...models.map(m => m.provider)])];
  const [provider, setProvider] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<string[] | null>(null);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [openAIKey, setOpenAIKey] = useState("");
  const [openAITesting, setOpenAITesting] = useState(false);
  const [openAIConnected, setOpenAIConnected] = useState(false);
  const [openAIModels, setOpenAIModels] = useState<string[]>([]);
  const lastDiscovery = useRef("");
  const patch = (p: Partial<Draft>) => { setDraft(v => v ? { ...v, ...p } : v); if ("baseUrl" in p || "apiKey" in p || "providerName" in p) setCatalog(null); };
  const refresh = async () => { await reload(); notifyModelsChanged(); };

  useEffect(() => {
    if (!userId || provider !== "OpenAI") return;
    let current = true;
    void getOpenAIConnection().then(result => { if (current) { setOpenAIConnected(result.connected); setOpenAIModels(result.models); } }).catch(() => { if (current) { setOpenAIConnected(false); setOpenAIModels([]); } });
    return () => { current = false; };
  }, [userId, provider]);
  useEffect(() => {
    if (!draft || draft.connectionType !== "direct" || !draft.baseUrl.startsWith("https://") || (!draft.apiKey && !draft.id)) return;
    const signature = `${draft.id ?? ""}|${draft.baseUrl}|${draft.apiKey}`;
    if (lastDiscovery.current === signature) return;
    const timer = window.setTimeout(() => { lastDiscovery.current = signature; void loadCatalog(); }, 900);
    return () => window.clearTimeout(timer);
  }, [draft?.id, draft?.connectionType, draft?.baseUrl, draft?.apiKey]);

  async function testOpenAI() {
    if (!openAIKey.trim()) { toast.error("请填写 OpenAI API Key"); return; }
    setOpenAITesting(true); setOpenAIConnected(false); setOpenAIModels([]);
    try { const result = await testOpenAIConnection({ data: { apiKey: openAIKey } }); setOpenAIConnected(true); setOpenAIModels(result.models); setOpenAIKey(""); await refresh(); toast.success(`连接成功，发现 ${result.models.length} 个模型`); }
    catch (error) { await refresh(); toast.error((error as Error).message || "连接失败"); }
    finally { setOpenAITesting(false); }
  }
  async function loadCatalog() {
    if (!draft?.baseUrl) { toast.error("请填写服务地址"); return; }
    setCatalogBusy(true);
    try { const result = await fetchProviderModels({ data: { id: draft.id, baseUrl: draft.baseUrl, apiKey: draft.apiKey || undefined } }); setCatalog(result.models); if (!result.models.length) toast.message("目录为空，可手动添加模型 ID"); }
    catch (e) { setCatalog(null); toast.error((e as Error).message || "无法读取目录，可手动添加"); }
    finally { setCatalogBusy(false); }
  }
  async function save() {
    if (!draft || busy) return;
    if (draft.connectionType === "direct" && draft.providerName === "OpenAI" && !draft.baseUrl && !openAIConnected) { toast.error("请先测试 OpenAI 连接"); return; }
    if (!draft.modelId.trim() || !draft.label.trim()) { toast.error("请填写模型 ID 和显示名称"); return; }
    if (draft.connectionType === "direct" && !draft.apiKey && !draft.id && !(draft.providerName === "OpenAI" && openAIConnected)) { toast.error("请先测试连接或填写 API Key"); return; }
    setBusy(true);
    try { await saveModel({ data: draft }); await refresh(); setDraft(null); setCreating(false); toast.success("已验证并保存，模型现在可在对话中切换"); }
    catch (e) { toast.error((e as Error).message || "保存失败"); }
    finally { setBusy(false); }
  }
  async function remove(m: ConfiguredModel) {
    if (!window.confirm(`从模型菜单移除「${m.label}」？已有对话不会删除。`)) return;
    setBusy(true);
    try { await removeModel({ data: { id: m.id } }); await refresh(); setDraft(null); toast.success("已从模型菜单移除"); }
    catch (e) { toast.error((e as Error).message || "移除失败"); }
    finally { setBusy(false); }
  }
  const directOpenAI = provider === "OpenAI";
  const visible = saved.filter(m => m.provider === provider && (m.connection_type !== "direct" || !directOpenAI || openAIConnected));
  const inputClass = "relay-model-input h-8 text-[12px]";
  const field = (name: string, child: React.ReactNode) => <label className="relay-model-field">{name}{child}</label>;
  const openProvider = (name: string) => { setProvider(provider === name ? null : name); setCreating(false); setDraft(null); setAdvanced(false); };

  return <div className="relay-models py-4">
    <h4 className="text-[14px] font-medium">Models</h4>
    <p className="mt-2 mb-5 text-[12px] text-muted-foreground">Enter your API keys to use models from the following providers.</p>
    {!userId && <p className="mb-4 text-xs text-muted-foreground">登录后可管理模型。</p>}
    {loaded && providers.map(name => {
      const count = saved.filter(m => m.provider === name && (m.connection_type !== "direct" || name !== "OpenAI" || openAIConnected)).length;
      return <div key={name} className="mb-3">
        <div className="relay-model-provider flex h-11 items-center gap-2 px-3">
          <span className="truncate text-[12px] font-medium">{name === "OpenAI" && count > 0 ? "OpenAI" : name}</span>
          {(count > 0 || (name === "OpenAI" && openAIConnected)) && <span className="size-1.5 shrink-0 rounded-full bg-success" aria-label="已连接"/>}
          <Button variant="outline" size="sm" className="ml-auto h-7 px-2 text-[11px]" disabled={!userId} onClick={() => openProvider(name)}>{provider === name ? "Done" : "Edit"}</Button>
        </div>
        {provider === name && <div className="relay-model-editor mt-2 p-3 sm:p-3.5">
          <div className="flex items-center gap-2 text-[12px] font-medium">{name}<span className="text-[11px] font-normal text-muted-foreground">{name === "OpenAI" ? "official · gateway" : "custom provider"}</span></div>
          {directOpenAI ? <div className="mt-4">
            {field("API key", <div className="flex flex-wrap gap-2 sm:flex-nowrap"><Input aria-label="OpenAI API Key" type="password" autoComplete="new-password" placeholder={openAIConnected ? "Connected · enter a new key to replace" : "Enter an API key"} className={`${inputClass} flex-1`} value={openAIKey} onChange={e => { setOpenAIKey(e.target.value); setOpenAIConnected(false); setOpenAIModels([]); }}/><Button variant="outline" size="sm" className="h-8 shrink-0 text-[11px]" disabled={openAITesting || !openAIKey.trim()} onClick={() => void testOpenAI()}>{openAITesting ? <LoaderCircle className="size-3 animate-spin"/> : <RefreshCw className="size-3"/>}Test connection</Button></div>)}
            <p className="mt-1 text-[11px] text-muted-foreground">{openAIConnected ? `Verified · ${openAIModels.length} models available` : "Connect to show direct OpenAI models. Keys are stored securely."}</p>
          </div> : <div className="mt-4 space-y-3">{field("Base URL", <Input aria-label="服务地址" className={inputClass} placeholder="https://api.example.com/v1" value={draft?.baseUrl ?? models.find(m => m.provider === name)?.base_url ?? ""} onChange={e => { if (!draft) setDraft(initialDraft(name, e.target.value)); else patch({ baseUrl: e.target.value }); }}/>)}</div>}
          <div className="relay-model-divider mt-3 pt-2">
            <Button variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-[11px] text-muted-foreground" onClick={() => setAdvanced(v => !v)}>{advanced ? <ChevronDown className="size-3"/> : <ChevronRight className="size-3"/>}Customized settings</Button>
            {advanced && <p className="pb-2 text-[11px] text-muted-foreground">{name === "OpenAI" ? "OpenAI API · https://api.openai.com/v1" : "OpenAI-compatible API · /v1/models"}</p>}
          </div>
          <div className="relay-model-divider mt-1 pt-3">
            <div className="flex items-center justify-between gap-2 text-[11px]"><span>Models</span><Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-muted-foreground" disabled={!directOpenAI && !draft?.baseUrl || catalogBusy} onClick={() => { if (directOpenAI) { void getOpenAIConnection().then(r => { setOpenAIConnected(r.connected); setOpenAIModels(r.models); }); } else void loadCatalog(); }}>{catalogBusy ? <LoaderCircle className="size-3 animate-spin"/> : null}Fetch available models</Button></div>
            <p className="mb-2 text-[11px] text-muted-foreground">{directOpenAI ? (openAIConnected ? "Connected model catalog" : "Connect to reveal available models") : catalog ? `${catalog.length} available from provider` : "Customized model catalog"}</p>
            {visible.length ? <div className="space-y-1.5">{visible.map(m => <div key={m.id} className="relay-model-row">
              <div className="min-w-0 flex-1"><div className="truncate text-[11px]" title={m.model_id}>{m.model_id}</div></div>
              <div className="min-w-0 flex-1"><div className="truncate text-[11px]" title={m.label}>{m.label}</div></div>
              <Button variant="ghost" size="icon-sm" title={`编辑 ${m.label}`} aria-label={`编辑 ${m.label}`} className="size-6 shrink-0 text-muted-foreground" onClick={() => { setDraft(fromModel(m)); setExpanded(false); }}><ChevronRight className="size-3"/></Button>
              <Button variant="ghost" size="icon-sm" aria-label={`移除 ${m.label}`} title={`移除 ${m.label}`} className="size-6 shrink-0 text-muted-foreground hover:text-destructive" disabled={busy} onClick={() => void remove(m)}><Trash2 className="size-3"/></Button>
            </div>)}</div> : <div className="relay-model-empty">No models will be shown in the selector. Add a model or connect a provider.</div>}
            {draft && <div className="relay-model-draft mt-2 space-y-3 p-2.5">
              <div className="flex items-center justify-between text-[11px] font-medium">{draft.id ? "Edit model" : "New model"}<Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]" onClick={() => setDraft(null)}>Cancel</Button></div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{field("Model ID", draft.connectionType === "gateway" ? <select aria-label="模型 ID" className="relay-model-select h-8 w-full rounded-md px-2 text-[11px]" value={draft.modelId} onChange={e => { const found = SUPPORTED_MODELS.find(m => m.model_id === e.target.value); patch({ modelId: e.target.value, label: draft.label || found?.label || "" }); }}><option value="">Select model</option>{SUPPORTED_MODELS.map(m => <option key={m.model_id} value={m.model_id}>{m.model_id}</option>)}</select> : <Input aria-label="模型 ID" className={inputClass} placeholder="Model ID" value={draft.modelId} onChange={e => patch({ modelId: e.target.value })}/>)}
              {field("Display name", <Input aria-label="显示名称" className={inputClass} placeholder="Display name" maxLength={80} value={draft.label} onChange={e => patch({ label: e.target.value })}/>)}</div>
              {draft.connectionType === "direct" && ((directOpenAI && openAIConnected) || catalog) && <select aria-label="已发现模型" className="relay-model-select h-8 w-full rounded-md px-2 text-[11px]" value={(directOpenAI ? openAIModels : catalog ?? []).includes(draft.modelId) ? draft.modelId : ""} onChange={e => patch({ modelId: e.target.value, label: draft.label || e.target.value })}><option value="">Select a discovered model, or enter an ID above</option>{(directOpenAI ? openAIModels : catalog ?? []).map(id => <option key={id} value={id}>{id}</option>)}</select>}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{field("Version", <Input aria-label="版本" className={inputClass} placeholder="Version" value={draft.version} onChange={e => patch({ version: e.target.value })}/>)}{field("Reasoning", <select aria-label="推理强度" className="relay-model-select h-8 w-full rounded-md px-2 text-[11px]" value={draft.reasoningEffort} onChange={e => patch({ reasoningEffort: e.target.value as Draft["reasoningEffort"] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>)}</div>
              {field("Description", <Input aria-label="描述" className={inputClass} placeholder="What this model is best for" maxLength={500} value={draft.description} onChange={e => patch({ description: e.target.value })}/>)}
              {draft.connectionType === "direct" && !directOpenAI && field("API key", <Input aria-label="API Key" type="password" autoComplete="new-password" className={inputClass} placeholder={draft.id ? "Leave blank to keep saved key" : "Enter provider API key"} value={draft.apiKey} onChange={e => patch({ apiKey: e.target.value })}/>)}
              {directOpenAI && <label className="flex items-center gap-2 text-[11px] text-muted-foreground"><input type="checkbox" checked={draft.connectionType === "gateway"} onChange={e => patch({ connectionType: e.target.checked ? "gateway" : "direct", modelId: "" })}/>Use application service instead of provider API</label>}
              <div className="flex justify-end"><Button size="sm" className="h-7 px-3 text-[11px]" disabled={busy || !draft.modelId || !draft.label} onClick={() => void save()}>{busy ? <LoaderCircle className="size-3 animate-spin"/> : null}Apply</Button></div>
            </div>}
            {!draft && <Button variant="outline" size="sm" className="mt-2 h-7 px-2 text-[11px]" onClick={() => { setDraft(initialDraft(name, models.find(m => m.provider === name)?.base_url ?? "")); setExpanded(false); }}><Plus className="size-3"/>Add model</Button>}
            {!directOpenAI && draft?.baseUrl && <Button variant="ghost" size="sm" className="ml-1 h-7 text-[11px] text-muted-foreground" disabled={catalogBusy || (!draft.apiKey && !draft.id)} onClick={() => void loadCatalog()}>Refresh catalog</Button>}
          </div>
          <div className="mt-3 flex justify-end gap-2"><Button variant="outline" size="sm" className="h-8 text-[11px]" onClick={() => { setProvider(null); setDraft(null); }}>Cancel</Button><Button size="sm" className="h-8 text-[11px]" onClick={() => { if (draft) void save(); else setProvider(null); }} disabled={busy}>{draft ? "Apply model" : "Apply"}</Button></div>
        </div>}
      </div>;
    })}
    {loaded && !creating && <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" className="relay-model-add h-9 border-dashed text-[12px]" disabled={!userId} onClick={() => { setCreating(true); setProvider(null); setDraft(initialDraft("Custom")); }}><Plus className="size-3.5"/>Add provider</Button><Button variant="outline" className="relay-model-add h-9 border-dashed text-[12px]" disabled={!userId} onClick={() => { setCreating(true); setProvider(null); setDraft(initialDraft("Custom")); }}><Plus className="size-3.5"/>Add a custom provider</Button></div>}
    {creating && draft && <div className="relay-model-editor p-3.5">
      <h5 className="text-[12px] font-medium">Custom provider</h5>
      <div className="mt-3 space-y-3">{field("Display name", <Input aria-label="新厂商名称" className={inputClass} placeholder="Provider name" value={draft.providerName === "Custom" ? "" : draft.providerName} onChange={e => patch({ providerName: e.target.value })}/>)}
        {field("Base URL", <Input aria-label="新服务地址" className={inputClass} placeholder="https://gateway.example/v1" value={draft.baseUrl} onChange={e => patch({ baseUrl: e.target.value })}/>)}
        {field("API protocol", <select className="relay-model-select h-8 w-full rounded-md px-2 text-[11px]" aria-label="API protocol" defaultValue="openai-completions"><option value="openai-completions">openai-completions</option></select>)}
        {field("API key", <Input aria-label="新 API Key" type="password" autoComplete="new-password" className={inputClass} placeholder="Enter your API key" value={draft.apiKey} onChange={e => patch({ apiKey: e.target.value })}/>)}
        <div className="relay-model-divider pt-3"><div className="flex justify-between text-[11px]"><span>Models</span><Button variant="ghost" size="sm" className="h-6 px-1 text-[11px]" disabled={!draft.baseUrl || !draft.apiKey || catalogBusy} onClick={() => void loadCatalog()}>Fetch available models</Button></div>
          {catalog && <select aria-label="已发现模型" className="relay-model-select my-2 h-8 w-full rounded-md px-2 text-[11px]" value={catalog.includes(draft.modelId) ? draft.modelId : ""} onChange={e => patch({ modelId: e.target.value, label: e.target.value })}><option value="">Select a model</option>{catalog.map(id => <option key={id} value={id}>{id}</option>)}</select>}
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><Input aria-label="新模型 ID" className={inputClass} placeholder="Model ID" value={draft.modelId} onChange={e => patch({ modelId: e.target.value })}/><Input aria-label="新模型名称" className={inputClass} placeholder="Display name" value={draft.label} onChange={e => patch({ label: e.target.value })}/></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><Input aria-label="新模型版本" className={inputClass} placeholder="Version (optional)" value={draft.version} onChange={e => patch({ version: e.target.value })}/><select aria-label="新模型推理强度" className="relay-model-select h-8 w-full rounded-md px-2 text-[11px]" value={draft.reasoningEffort} onChange={e => patch({ reasoningEffort: e.target.value as Draft["reasoningEffort"] })}><option value="low">Low reasoning</option><option value="medium">Medium reasoning</option><option value="high">High reasoning</option></select></div>
          <Input aria-label="新模型描述" className={`${inputClass} mt-2`} placeholder="Description (optional)" value={draft.description} onChange={e => patch({ description: e.target.value })}/>
          <p className="mt-2 text-[11px] text-muted-foreground">Add a model to create this provider. Its connection will be verified before it appears in chat.</p>
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" size="sm" className="h-8" onClick={() => { setCreating(false); setDraft(null); }}>Cancel</Button><Button size="sm" className="h-8" disabled={busy || !draft.providerName.trim() || draft.providerName === "Custom" || !draft.baseUrl || !draft.apiKey || !draft.modelId || !draft.label} onClick={() => void save()}>{busy ? <LoaderCircle className="size-3 animate-spin"/> : null}Create provider</Button></div>
      </div>
    </div>}
  </div>;
}
