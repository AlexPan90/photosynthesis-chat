import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ConfiguredModel } from "@/lib/ai/model-catalog";
import { saveModel, removeModel, fetchProviderModels } from "@/lib/ai/model-management.functions";
import { getOpenAIConnection, testOpenAIConnection } from "@/lib/ai/openai-connection.functions";
import { notifyModelsChanged, useModels } from "./useModels";

type Draft = { id?: string; modelId: string; label: string; version: string; description: string; reasoningEffort: "low" | "medium" | "high"; connectionType: "gateway" | "direct"; providerName: string; baseUrl: string; apiKey: string };
const fresh = (providerName: string, baseUrl = ""): Draft => ({ modelId: "", label: "", version: "", description: "", reasoningEffort: "medium", connectionType: providerName === "OpenAI" ? "gateway" : "direct", providerName, baseUrl, apiKey: "" });
const fromModel = (m: ConfiguredModel): Draft => ({ id: m.id, modelId: m.model_id, label: m.label, version: m.version ?? "", description: m.description ?? "", reasoningEffort: m.parameters?.reasoningEffort ?? "medium", connectionType: m.connection_type === "direct" ? "direct" : "gateway", providerName: m.provider, baseUrl: m.base_url ?? "", apiKey: "" });
const providerPresets = [
  { name: "DeepSeek", url: "https://api.deepseek.com/v1" },
  { name: "Groq", url: "https://api.groq.com/openai/v1" },
  { name: "Mistral", url: "https://api.mistral.ai/v1" },
  { name: "Together", url: "https://api.together.xyz/v1" },
  { name: "Fireworks", url: "https://api.fireworks.ai/inference/v1" },
] as const;

export function ModelSettings({ userId }: { userId: string | undefined }) {
  const { models, loaded, reload } = useModels(userId);
  const [active, setActive] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [preset, setPreset] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>(providerPresets[0].name);
  const [rows, setRows] = useState<Draft[]>([]);
  const [removed, setRemoved] = useState<ConfiguredModel[]>([]);
  const [details, setDetails] = useState<number | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [key, setKey] = useState("");
  const [connected, setConnected] = useState(false);
  const [directory, setDirectory] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [providerName, setProviderName] = useState("");
  const [providerId, setProviderId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [protocol, setProtocol] = useState("openai-completions");
  const [customKey, setCustomKey] = useState("");
  const [connectionChecked, setConnectionChecked] = useState(false);
  const providers = [...new Set(["OpenAI", ...models.map(m => m.provider)])];
  const availablePresets = providerPresets.filter(p => !providers.includes(p.name));
  const canSee = active !== "OpenAI" || connected;
  const inputStyle = "relay-model-input h-8 text-[12px]";
  const label = (text: string, children: React.ReactNode) => <label className="relay-model-field">{text}{children}</label>;
  const refresh = async () => { await reload(); notifyModelsChanged(); };
  const patchRow = (index: number, patch: Partial<Draft>) => setRows(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r));
  function reset() { setActive(null); setCustom(false); setPreset(false); setRows([]); setRemoved([]); setDetails(null); setCatalog([]); setKey(""); setAdvanced(false); setConnectionChecked(false); setProviderId(""); setProviderName(""); setBaseUrl(""); setCustomKey(""); }
  function open(name: string) {
    if (active === name) { reset(); return; }
    setActive(name); setCustom(false); setPreset(false); setRows(models.filter(m => m.provider === name && m.enabled).map(fromModel)); setRemoved([]); setCatalog([]); setDetails(null); setAdvanced(false); setKey("");
    setBaseUrl(models.find(m => m.provider === name)?.base_url ?? "");
    setConnectionChecked(false);
  }
  useEffect(() => {
    if (active !== "OpenAI" || !userId) return;
    let current = true;
    void getOpenAIConnection().then(r => { if (current) { setConnected(r.connected); setDirectory(r.models); setConnectionChecked(true); } }).catch(() => { if (current) { setConnected(false); setDirectory([]); setConnectionChecked(true); } });
    return () => { current = false; };
  }, [active, userId]);
  async function testConnection() {
    if (!key.trim()) return;
    setBusy(true);
    try { const r = await testOpenAIConnection({ data: { apiKey: key } }); setConnected(true); setDirectory(r.models); setKey(""); setConnectionChecked(true); await refresh(); toast.success(`已连接 OpenAI，发现 ${r.models.length} 个模型`); }
    catch (e) { setConnected(false); setDirectory([]); setConnectionChecked(true); await refresh(); toast.error((e as Error).message || "连接失败"); }
    finally { setBusy(false); }
  }
  async function fetchModels() {
    if (active === "OpenAI") {
      if (!connected) { toast.error("请先测试 OpenAI 连接"); return; }
      setFetching(true);
      try { const r = await getOpenAIConnection(); setConnected(r.connected); setDirectory(r.models); toast.success(`发现 ${r.models.length} 个模型`); }
      catch (e) { toast.error((e as Error).message || "无法读取模型目录"); }
      finally { setFetching(false); }
      return;
    }
    const url = custom || preset ? baseUrl : baseUrl || rows[0]?.baseUrl;
    const apiKey = custom || preset ? customKey : key || rows[0]?.apiKey;
    if (!url) { toast.error("请填写 Base URL"); return; }
    setFetching(true);
    try { const r = await fetchProviderModels({ data: { id: custom || preset ? undefined : rows.find(x => x.id)?.id, baseUrl: url, apiKey: apiKey || undefined } }); setCatalog(r.models); toast.success(`发现 ${r.models.length} 个模型`); }
    catch (e) { toast.error((e as Error).message || "无法读取目录，可以手动添加模型"); }
    finally { setFetching(false); }
  }
  async function apply() {
    if (busy) return;
    if (custom && (!providerName.trim() || !baseUrl.trim() || !customKey.trim())) { toast.error("请填写服务商名称、Base URL 和 API Key"); return; }
    if (preset && (!baseUrl.trim() || !customKey.trim())) { toast.error("请填写 API Key 和服务地址"); return; }
    if (active === "OpenAI" && !connected && rows.some(r => r.connectionType === "direct")) { toast.error("请先测试 OpenAI 连接"); return; }
    const dirty = rows.filter(r => !r.id || JSON.stringify({ modelId:r.modelId, label:r.label, version:r.version, description:r.description, reasoningEffort:r.reasoningEffort, connectionType:r.connectionType, providerName:r.providerName, baseUrl:r.baseUrl }) !== JSON.stringify((() => { const old = models.find(m => m.id === r.id); if (!old) return {}; const x = fromModel(old); return { modelId:x.modelId, label:x.label, version:x.version, description:x.description, reasoningEffort:x.reasoningEffort, connectionType:x.connectionType, providerName:x.providerName, baseUrl:x.baseUrl }; })()));
    if (dirty.some(r => !r.modelId.trim() || !r.label.trim())) { toast.error("请填写模型 ID 和显示名称"); return; }
    if ((custom || preset) && !rows.length) { setAdvanced(true); toast.error("请先拉取或手动添加至少一个模型"); return; }
    setBusy(true);
    try {
      for (const m of removed) await removeModel({ data: { id: m.id } });
      for (const r of dirty) await saveModel({ data: { ...r, providerName: custom ? providerName.trim() : preset ? selectedPreset : r.providerName, baseUrl: r.connectionType === "direct" ? (custom || preset ? baseUrl : baseUrl || r.baseUrl) : "", apiKey: r.connectionType === "direct" ? (custom || preset ? customKey : key || r.apiKey) : "" } });
      await refresh(); reset(); toast.success("模型配置已保存");
    } catch (e) { await refresh(); toast.error((e as Error).message || "保存失败，请检查模型配置"); }
    finally { setBusy(false); }
  }
  const editRows = canSee ? rows : [];
  const renderRows = () => <>
    {editRows.length === 0 && <div className="relay-model-empty">{active === "OpenAI" && !connected ? "Connect your API key to view and manage models." : "No models yet. Add one manually or fetch available models."}</div>}
    <div className="space-y-1.5">{editRows.map(r => {
      const index = rows.indexOf(r);
      return <div key={r.id ?? `new-${index}`} className="relay-model-row-wrap">
        <div className="relay-model-row">
          <Input aria-label={`模型 ID ${index + 1}`} className={`${inputStyle} min-w-0 flex-[1.35]`} placeholder="Model ID" value={r.modelId} onChange={e => patchRow(index, { modelId: e.target.value })}/>
          <Input aria-label={`显示名称 ${index + 1}`} className={`${inputStyle} min-w-0 flex-1`} placeholder="Display name" value={r.label} onChange={e => patchRow(index, { label: e.target.value })}/>
          <Button variant="ghost" size="icon-sm" className="size-7 shrink-0" aria-label={`更多模型参数 ${index + 1}`} onClick={() => setDetails(details === index ? null : index)}>{details === index ? <ChevronDown className="size-3.5"/> : <ChevronRight className="size-3.5"/>}</Button>
          <Button variant="ghost" size="icon-sm" className="size-7 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`移除模型 ${index + 1}`} onClick={() => { if (r.id) { const m = models.find(m => m.id === r.id); if (m) setRemoved(prev => [...prev, m]); } setRows(prev => prev.filter((_, i) => i !== index)); setDetails(null); }}><Trash2 className="size-3.5"/></Button>
        </div>
        {details === index && <div className="grid grid-cols-2 gap-2 px-2 pb-2 pt-1">
          {label("Version", <Input aria-label={`版本 ${index + 1}`} className={inputStyle} placeholder="e.g. 2026-09" value={r.version} onChange={e => patchRow(index, { version: e.target.value })}/>)}
          {label("Reasoning", <select aria-label={`推理强度 ${index + 1}`} className="relay-model-select h-8 w-full rounded-md px-2 text-[12px]" value={r.reasoningEffort} onChange={e => patchRow(index, { reasoningEffort: e.target.value as Draft["reasoningEffort"] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>)}
          <div className="col-span-2">{label("Description", <Input aria-label={`描述 ${index + 1}`} className={inputStyle} placeholder="What this model is best for" value={r.description} onChange={e => patchRow(index, { description: e.target.value })}/>)}</div>
          {active === "OpenAI" && <div className="col-span-2">{label("Connection", <select aria-label={`连接方式 ${index + 1}`} className="relay-model-select h-8 w-full rounded-md px-2 text-[12px]" value={r.connectionType} onChange={e => patchRow(index, { connectionType: e.target.value as Draft["connectionType"], modelId: "" })}><option value="gateway">Application service</option><option value="direct" disabled={!connected}>OpenAI API</option></select>)}</div>}
        </div>}
      </div>;
    })}</div>
    {catalog.length > 0 && <select aria-label="已发现模型" className="relay-model-select mt-2 h-8 w-full rounded-md px-2 text-[12px]" value="" onChange={e => { if (e.target.value && !rows.some(r => r.modelId === e.target.value)) setRows(prev => [...prev, { ...fresh(custom ? providerName : preset ? selectedPreset : active ?? "OpenAI", baseUrl), modelId:e.target.value, label:e.target.value, apiKey: custom || preset ? customKey : key }]); }}><option value="">Choose a discovered model to add</option>{catalog.map(id => <option key={id} value={id}>{id}</option>)}</select>}
    <Button variant="outline" size="sm" className="mt-2 h-7 rounded-full px-2 text-[11px]" disabled={active === "OpenAI" && !connected} onClick={() => setRows(prev => [...prev, { ...fresh(custom ? providerName : preset ? selectedPreset : active ?? "OpenAI", baseUrl), connectionType: "direct", apiKey: custom || preset ? customKey : key }])}><Plus className="size-3"/>Add model</Button>
  </>;
  return <div className="relay-models py-3">
    <h4 className="text-[14px] font-medium">Models</h4>
    <p className="mb-5 mt-2 text-[12px] text-muted-foreground">Enter your API keys to use models from the following providers.</p>
    {loaded && providers.map(name => <div key={name} className="mb-2.5">
      <div className="relay-model-provider flex h-11 items-center gap-2 px-3"><span className="truncate text-[12px] font-medium">{name}</span>{(name === "OpenAI" ? connected : models.some(m => m.provider === name && m.connection_type === "direct" && m.enabled && m.verified_at)) && <span className="size-1.5 shrink-0 rounded-full bg-success" aria-label="已连接"/>}<Button variant="outline" size="sm" className="ml-auto h-7 px-2 text-[11px]" disabled={!userId} onClick={() => open(name)}>Edit</Button></div>
      {active === name && <div className="relay-model-editor mt-2 p-3.5">
        {name === "OpenAI" ? <><div className="text-[12px] font-medium">OpenAI <span className="ml-1 text-[11px] font-normal text-muted-foreground">{connected ? "Connected" : "Not connected"}</span></div>
          {label("API key", <div className="flex gap-2"><Input aria-label="OpenAI API Key" type="password" autoComplete="new-password" className={`${inputStyle} min-w-0 flex-1`} placeholder={connected ? "Enter a new key to replace the saved one" : "Enter OpenAI API key"} value={key} onChange={e => setKey(e.target.value)}/><Button variant="outline" size="sm" className="h-8 shrink-0 text-[11px]" disabled={!key.trim() || busy} onClick={() => void testConnection()}>{busy ? <LoaderCircle className="size-3 animate-spin"/> : "Test connection"}</Button></div>)}
          <p className="mt-1.5 text-[11px] text-muted-foreground">{connected ? `${directory.length} models available · key saved securely` : connectionChecked ? "Direct OpenAI models stay hidden until the key is verified." : "Checking connection…"}</p></> : <>{label("API key", <Input aria-label="厂商 API Key" type="password" autoComplete="new-password" className={inputStyle} placeholder="Leave blank to keep the saved key" value={key} onChange={e => setKey(e.target.value)}/>)}</>}
        <div className="relay-model-divider mt-3 pt-2"><Button variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-[11px] text-muted-foreground" onClick={() => setAdvanced(v => !v)}>{advanced ? <ChevronDown className="size-3"/> : <ChevronRight className="size-3"/>}Customized settings</Button>
          {advanced && <div className="pb-2">{label("Base URL", <Input aria-label="服务地址" className={inputStyle} value={name === "OpenAI" ? "https://api.openai.com/v1" : baseUrl} readOnly={name === "OpenAI"} onChange={e => setBaseUrl(e.target.value)}/>)}</div>}
        </div>
        <div className="relay-model-divider mt-1 pt-3"><div className="flex items-center justify-between gap-2 text-[11px]"><span>Models</span><Button variant="ghost" size="sm" className="h-6 px-1 text-[11px] text-muted-foreground" disabled={fetching || name === "OpenAI" && !connected} onClick={() => void fetchModels()}>{fetching ? <LoaderCircle className="size-3 animate-spin"/> : null}Fetch available models</Button></div>
          <p className="mb-2 text-[11px] text-muted-foreground">{name === "OpenAI" ? connected ? "Connected model catalog" : "Connect to reveal direct models" : "Customized model catalog"}</p>{renderRows()}
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button variant="outline" size="sm" className="h-8 text-[11px]" onClick={reset}>Cancel</Button><Button size="sm" className="relay-model-apply h-8 text-[11px]" disabled={busy} onClick={() => void apply()}>{busy ? <LoaderCircle className="size-3 animate-spin"/> : null}Apply</Button></div>
      </div>}
    </div>)}
    {loaded && !custom && !preset && !active && <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" className="relay-model-add h-9 border-dashed text-[12px]" disabled={!userId || availablePresets.length === 0} onClick={() => { const first = availablePresets[0]; if (!first) return; reset(); setPreset(true); setSelectedPreset(first.name); setBaseUrl(first.url); }}><Plus className="size-3.5"/>Add provider</Button><Button variant="outline" className="relay-model-add h-9 border-dashed text-[12px]" disabled={!userId} onClick={() => { reset(); setCustom(true); }}><Plus className="size-3.5"/>Add a custom provider</Button></div>}
    {preset && <div className="relay-model-editor p-3.5"><div className="space-y-3">
      {label("Provider", <Select value={selectedPreset} onValueChange={value => { const next = providerPresets.find(p => p.name === value); if (!next) return; setSelectedPreset(next.name); setBaseUrl(next.url); setCustomKey(""); setRows([]); setCatalog([]); setAdvanced(false); }}>
        <SelectTrigger aria-label="Provider" className="relay-model-provider-trigger h-9 w-full px-3 text-[12px] font-medium"><SelectValue placeholder="Choose a provider">{selectedPreset}</SelectValue></SelectTrigger>
        <SelectContent position="popper" align="start" sideOffset={5} className="relay-model-provider-menu z-[100] max-h-64 rounded-lg p-1 shadow-lg">
          {availablePresets.map(p => <SelectItem key={p.name} value={p.name} textValue={p.name} className="relay-model-provider-option min-h-11 rounded-md py-1.5 pl-3 pr-8 text-[12px]">
            <span className="flex min-w-0 flex-col gap-0.5"><span className="font-medium">{p.name}</span><span className="truncate text-[10px] text-muted-foreground">{p.url.replace(/^https:\/\//, "")}</span></span>
          </SelectItem>)}
        </SelectContent>
      </Select>)}
      {label("API key", <Input aria-label="Provider API key" type="password" autoComplete="new-password" className={inputStyle} placeholder="Enter an API key" value={customKey} onChange={e => setCustomKey(e.target.value)}/>)}
      <div className="relay-model-divider pt-2"><Button variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-[11px] text-muted-foreground" onClick={() => setAdvanced(v => !v)}>{advanced ? <ChevronDown className="size-3"/> : <ChevronRight className="size-3"/>}Customized settings</Button></div>
      {advanced && <div className="space-y-3">{label("Base URL", <Input aria-label="Provider Base URL" className={inputStyle} value={baseUrl} onChange={e => { setBaseUrl(e.target.value); setCatalog([]); }}/>) }
        <div className="relay-model-divider pt-3"><div className="flex items-center justify-between text-[11px]"><span>Models</span><Button variant="ghost" size="sm" className="h-6 px-1 text-[11px] text-muted-foreground" disabled={!customKey.trim() || fetching} onClick={() => void fetchModels()}>{fetching ? <LoaderCircle className="size-3 animate-spin"/> : null}Fetch available models</Button></div><p className="mb-2 text-[11px] text-muted-foreground">{selectedPreset} model catalog</p>{renderRows()}</div>
      </div>}
      <div className="flex justify-end gap-2"><Button variant="outline" size="sm" className="h-8 text-[11px]" onClick={reset}>Cancel</Button><Button size="sm" className="relay-model-apply h-8 text-[11px]" disabled={busy || !customKey.trim()} onClick={() => void apply()}>{busy ? <LoaderCircle className="size-3 animate-spin"/> : null}Apply</Button></div>
    </div></div>}
    {custom && <div className="relay-model-editor p-3.5"><h5 className="text-[12px] font-medium">Custom provider</h5><div className="mt-3 space-y-3">
      {label("Provider ID", <Input aria-label="Provider ID" className={inputStyle} placeholder="acme-gateway" value={providerId} onChange={e => setProviderId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}/>)}
      <p className="-mt-2 text-[11px] text-muted-foreground">A lowercase identifier for this provider.</p>
      {label("Display name", <Input aria-label="Display name" className={inputStyle} placeholder="Provider name" value={providerName} onChange={e => setProviderName(e.target.value)}/>)}
      {label("Base URL", <Input aria-label="Base URL" className={inputStyle} placeholder="https://gateway.example/v1" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}/>)}
      {label("API protocol", <select aria-label="API protocol" className="relay-model-select h-8 w-full max-w-52 rounded-md px-2 text-[12px]" value={protocol} onChange={e => setProtocol(e.target.value)}><option value="openai-completions">openai-completions</option></select>)}
      {label("API key", <Input aria-label="API key" type="password" autoComplete="new-password" className={inputStyle} placeholder="Enter your API key" value={customKey} onChange={e => setCustomKey(e.target.value)}/>)}
      <div className="relay-model-divider pt-3"><div className="flex items-center justify-between text-[11px]"><span>Models</span><Button variant="ghost" size="sm" className="h-6 px-1 text-[11px] text-muted-foreground" disabled={!baseUrl || !customKey || fetching} onClick={() => void fetchModels()}>{fetching ? <LoaderCircle className="size-3 animate-spin"/> : null}Fetch available models</Button></div><p className="mb-2 text-[11px] text-muted-foreground">Customized model catalog</p>{renderRows()}</div>
      <div className="flex justify-end gap-2"><Button variant="outline" size="sm" className="h-8 text-[11px]" onClick={reset}>Cancel</Button><Button size="sm" className="relay-model-apply h-8 text-[11px]" disabled={busy || !providerId.trim() || !providerName.trim() || !baseUrl || !customKey || !rows.length} onClick={() => void apply()}>{busy ? <LoaderCircle className="size-3 animate-spin"/> : null}Create provider</Button></div>
    </div></div>}
  </div>;
}
