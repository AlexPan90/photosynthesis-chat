import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, ChevronLeft, CircleAlert, Copy, ExternalLink, LoaderCircle, MoreHorizontal, Play, Plug, Plus, RefreshCw, Search, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { saveMcpConnection, testMcpConnection, callMcpTool } from "@/lib/orchestra.functions";
import { useMcpConnections, type McpConn } from "./data";

const PRESETS = [
  { name: "DeepWiki", url: "https://mcp.deepwiki.com/mcp", auth_type: "none" as const },
  { name: "Context7", url: "https://mcp.context7.com/mcp", auth_type: "none" as const },
  { name: "GitHub", url: "https://api.githubcopilot.com/mcp/", auth_type: "api_key" as const },
  { name: "Hugging Face", url: "https://huggingface.co/mcp", auth_type: "api_key" as const },
  { name: "Linear", url: "https://mcp.linear.app/mcp", auth_type: "api_key" as const },
];
type Form = { id?: string; name: string; url: string; auth_type: "none" | "api_key"; header_name: string; secret: string; proxy_url: string };
const empty: Form = { name: "", url: "", auth_type: "none", header_name: "Authorization", secret: "", proxy_url: "" };
type ToolInfo = McpConn["tools"][number];

function Status({ item }: { item: McpConn }) {
  return <span className={`inline-flex items-center gap-1.5 text-[11px] ${item.state === "ready" ? "text-success" : item.state === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
    <span className={`size-1.5 rounded-full ${item.state === "ready" ? "bg-success" : item.state === "failed" ? "bg-destructive" : "bg-muted-foreground"}`}/>
    {item.state === "ready" ? "已连接" : item.state === "failed" ? "连接失败" : "待测试"}
  </span>;
}

function Field({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return <label className="block space-y-1.5 text-xs font-medium text-foreground"><span>{title}</span>{children}{note && <span className="block text-[11px] font-normal leading-4 text-muted-foreground">{note}</span>}</label>;
}

export function McpPage() {
  const { items, loading, reload } = useMcpConnections();
  const save = useServerFn(saveMcpConnection);
  const test = useServerFn(testMcpConnection);
  const call = useServerFn(callMcpTool);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [editor, setEditor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolSearch, setToolSearch] = useState("");
  const [args, setArgs] = useState("{}");
  const [result, setResult] = useState("");
  const [running, setRunning] = useState(false);
  const [confirmRun, setConfirmRun] = useState(false);
  const current = items.find(item => item.id === selected);
  const tool = current?.tools.find(t => t.name === activeTool);
  const filteredTools = current?.tools.filter(t => `${t.name} ${t.description}`.toLowerCase().includes(toolSearch.toLowerCase())) ?? [];

  function start(formValue: Form = empty) { setForm(formValue); setError(""); setEditor(true); }
  function open(item: McpConn) { setSelected(item.id); setActiveTool(null); setResult(""); setError(""); }
  function edit(item: McpConn) { start({ id: item.id, name: item.name, url: item.url, auth_type: item.auth_type === "api_key" ? "api_key" : "none", header_name: item.header_name, secret: "", proxy_url: item.proxy_url ?? "" }); }
  async function submit() {
    if (!form.name.trim() || !form.url.trim()) { setError("请填写名称和服务地址"); return; }
    if (form.auth_type === "api_key" && !form.secret && !form.id) { setError("请填写密钥"); return; }
    setBusy(true); setError("");
    try {
      const saved = await save({ data: { ...form, secret: form.secret || undefined, proxy_url: form.proxy_url.trim() } });
      await reload(); setSelected(saved.id); setEditor(false); setActiveTool(null);
      if (saved.state === "failed") setError(`已保存，但连接失败：${saved.last_error ?? "未知错误"}`);
    } catch (e) { setError((e as Error).message || "保存失败"); }
    finally { setBusy(false); }
  }
  async function retry(id: string) {
    setBusy(true); setError("");
    try { const r = await test({ data: { id } }); if (r.state === "failed") setError(r.last_error ?? "连接失败"); await reload(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function remove(item: McpConn) {
    if (!window.confirm(`删除「${item.name}」？绑定它的 Agent 将无法再调用这些工具。`)) return;
    const { error: e } = await supabase.from("mcp_connections").delete().eq("id", item.id);
    if (e) { setError(e.message); return; }
    setSelected(null); setError(""); await reload();
  }
  async function toggleTool(item: McpConn, name: string, on: boolean) {
    const disabled_tools = on ? item.disabled_tools.filter(t => t !== name) : [...item.disabled_tools, name];
    const { error: e } = await supabase.from("mcp_connections").update({ disabled_tools }).eq("id", item.id);
    if (e) setError(e.message); else await reload();
  }
  function selectTool(next: ToolInfo) {
    setActiveTool(next.name); setResult(""); setConfirmRun(false);
    const defaults = Object.fromEntries(Object.entries(next.inputSchema?.properties ?? {}).filter(([key]) => next.inputSchema?.required?.includes(key)).map(([key, value]) => [key, value.type === "array" ? [] : value.type === "object" ? {} : value.type === "number" || value.type === "integer" ? 0 : value.type === "boolean" ? false : ""]));
    setArgs(JSON.stringify(defaults, null, 2));
  }
  async function run() {
    if (!current || !tool) return;
    let parsed: unknown;
    try { parsed = JSON.parse(args); if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error(); }
    catch { setResult("参数必须是 JSON 对象"); return; }
    if (!confirmRun) { setConfirmRun(true); return; }
    setRunning(true); setResult("");
    try { const r = await call({ data: { id: current.id, name: tool.name, args: parsed as Record<string, unknown>, confirmed: confirmRun } }); setResult((r.isError ? "工具返回错误\n" : "") + r.content); }
    catch (e) { setResult(`调用失败：${(e as Error).message}`); }
    finally { setRunning(false); setConfirmRun(false); }
  }

  return <div className="soft-scroll h-full min-w-0 overflow-y-auto bg-background px-4 py-5 sm:px-7">
    <div className="mx-auto max-w-[1020px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-[17px] font-semibold">MCP 服务</h2><p className="mt-1 text-xs text-muted-foreground">管理远程服务与工具调用</p></div>
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm"><Plus className="size-3.5"/>添加服务<ChevronDown className="size-3.5"/></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48"> <DropdownMenuItem onClick={() => start()}>手动添加 HTTP 服务</DropdownMenuItem>{PRESETS.map(p => <DropdownMenuItem key={p.name} onClick={() => start({ ...empty, ...p })}>{p.name}</DropdownMenuItem>)}</DropdownMenuContent>
        </DropdownMenu>
      </div>
      {!current ? <>
        {loading ? <p className="py-12 text-center text-xs text-muted-foreground">加载连接…</p> : items.length === 0 ? <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border text-muted-foreground"><Plug className="size-6"/><p className="text-xs">尚未连接服务</p><Button size="sm" variant="outline" onClick={() => start()}><Plus/>添加服务</Button></div> :
          <div className="grid gap-3 md:grid-cols-2">{items.map(item => <div key={item.id} className="group flex min-h-40 flex-col rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/50">
            <div className="flex min-w-0 items-start gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"><Plug className="size-4"/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><Status item={item}/></div>
              <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`${item.name} 操作`}><MoreHorizontal/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => edit(item)}>编辑连接</DropdownMenuItem><DropdownMenuItem onClick={() => void retry(item.id)}>重新测试</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => void remove(item)}>删除连接</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
            </div>
            <p className="mt-4 truncate rounded-md bg-secondary/60 px-3 py-2 font-mono text-[11px] text-muted-foreground" title={item.url}>{item.url}</p>
            <div className="mt-auto flex items-center justify-between pt-4"><span className="text-[11px] text-muted-foreground">HTTP · {item.tools.length} 个工具</span><Button size="sm" variant="ghost" onClick={() => open(item)}>查看工具 <ExternalLink className="size-3"/></Button></div>
          </div>)}</div>}
      </> : <>
        <div className="mb-5 flex flex-wrap items-center gap-3"><Button size="icon-sm" variant="ghost" aria-label="返回服务列表" onClick={() => { setSelected(null); setError(""); }}><ChevronLeft/></Button><div className="min-w-0 flex-1"><h3 className="truncate text-base font-semibold">{current.name}</h3><Status item={current}/></div><Button size="sm" variant="outline" disabled={busy} onClick={() => void retry(current.id)}><RefreshCw className={busy ? "animate-spin" : ""}/>测试连接</Button><Button size="sm" variant="outline" onClick={() => edit(current)}><Settings2/>配置</Button></div>
        {error && <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border pb-4 text-xs"><span className="text-muted-foreground">传输 <strong className="ml-1 font-medium text-foreground">Streamable HTTP</strong></span><span className="text-muted-foreground">鉴权 <strong className="ml-1 font-medium text-foreground">{current.auth_type === "api_key" ? "请求头密钥" : "无"}</strong></span><span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground" title={current.url}>{current.url}</span></div>
        {current.state === "failed" && current.last_error && <p role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-xs text-destructive">{current.last_error}</p>}
        <div className="grid min-h-[390px] gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="min-w-0 rounded-lg border border-border p-3"><p className="mb-3 text-xs font-semibold">工具 <span className="text-muted-foreground">{current.tools.length}</span></p><div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground"/><Input value={toolSearch} onChange={e => setToolSearch(e.target.value)} placeholder="搜索工具" className="h-8 pl-8 text-xs"/></div>
            <div className="soft-scroll mt-3 max-h-[370px] space-y-1 overflow-y-auto">{filteredTools.map(t => <Button key={t.name} variant="ghost" onClick={() => selectTool(t)} className={`h-auto w-full flex-col items-start gap-0.5 whitespace-normal px-2 py-2 text-left ${activeTool === t.name ? "bg-accent" : ""}`}><span className="max-w-full break-all font-mono text-xs">{t.name}</span><span className="line-clamp-2 text-[11px] font-normal text-muted-foreground">{t.description}</span></Button>)}{filteredTools.length === 0 && <p className="py-5 text-center text-xs text-muted-foreground">暂无工具</p>}</div>
          </aside>
          <section className="min-w-0 rounded-lg border border-border p-4">{tool ? <>
            <div className="flex items-start gap-3 border-b border-border pb-4"><div className="min-w-0 flex-1"><h4 className="break-all font-mono text-sm font-semibold">{tool.name}</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">{tool.description || "此工具没有描述"}</p></div><Switch checked={!current.disabled_tools.includes(tool.name)} onCheckedChange={on => void toggleTool(current, tool.name, on)} aria-label={`启用 ${tool.name}`}/></div>
            <div className="space-y-3 pt-4"><p className="text-xs font-semibold">调用测试</p>{Object.entries(tool.inputSchema?.properties ?? {}).map(([key, prop]) => <div key={key} className="flex flex-wrap gap-2 text-[11px]"><code className="font-mono text-foreground">{key}{tool.inputSchema?.required?.includes(key) && <span className="text-destructive"> *</span>}</code><span className="text-muted-foreground">{prop.type ?? "any"}{prop.description ? ` · ${prop.description}` : ""}</span></div>)}
              <Field title="参数 (JSON)" note="按上方字段填写；对象、数组等复杂参数也可直接编辑。"><textarea aria-label="参数 (JSON)" value={args} onChange={e => { setArgs(e.target.value); setConfirmRun(false); }} spellCheck={false} className="h-36 w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-5 text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"/></Field>
              {confirmRun && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs"><CircleAlert className="size-4 text-destructive"/><span className="flex-1">确认调用 {tool.name}？此工具可能修改远程数据，操作可能无法撤销。</span><Button size="sm" variant="ghost" onClick={() => setConfirmRun(false)}>取消</Button><Button size="sm" variant="destructive" onClick={() => void run()}>确认执行</Button></div>}
              {!confirmRun && <Button size="sm" disabled={running || current.disabled_tools.includes(tool.name) || current.state !== "ready"} onClick={() => void run()}>{running ? <LoaderCircle className="animate-spin"/> : <Play/>}运行测试</Button>}
              {result && <div className="space-y-2"><div className="flex items-center justify-between"><p className="text-xs font-semibold">返回结果</p><Button size="icon-sm" variant="ghost" title="复制结果" aria-label="复制结果" onClick={() => void navigator.clipboard.writeText(result)}><Copy/></Button></div><pre className="soft-scroll max-h-64 overflow-auto rounded-md bg-secondary p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap break-all">{result}</pre></div>}
            </div>
          </> : <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 text-xs text-muted-foreground"><Plug className="size-6"/>选择一个工具查看参数并测试</div>}</section>
        </div>
      </>}
      {error && !current && <p role="alert" className="mt-4 text-xs text-destructive">{error}</p>}
    </div>
    <Dialog open={editor} onOpenChange={v => { if (!busy) setEditor(v); }}><DialogContent className="relay-settings-surface soft-scroll max-h-[min(740px,90dvh)] w-[min(560px,94vw)] max-w-none overflow-y-auto p-0 [&>button:last-child]:hidden">
      <div className="border-b border-border px-6 py-4"><div className="flex items-center justify-between"><DialogTitle className="text-base">{form.id ? "编辑 MCP 服务" : "添加 MCP 服务"}</DialogTitle><Button size="icon-sm" variant="ghost" aria-label="关闭表单" onClick={() => setEditor(false)}><ChevronDown className="rotate-90"/></Button></div><DialogDescription className="mt-1 text-xs">连接远程 Streamable HTTP 服务，保存时自动获取工具列表。</DialogDescription></div>
      <div className="space-y-4 px-6 py-5">
        <Field title="服务名称 *"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="例如：我的知识库" className="h-9 text-xs"/></Field>
        <Field title="服务地址 *" note="仅支持 HTTPS 远程 MCP。服务器上的本地进程 (stdio) 不适用于此应用。"><Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/mcp" className="h-9 font-mono text-xs"/></Field>
        <fieldset className="space-y-2"><legend className="text-xs font-medium">鉴权方式</legend><div className="flex gap-2">{([ ["none", "无需鉴权"], ["api_key", "请求头密钥"] ] as const).map(([key, label]) => <Button key={key} type="button" size="sm" variant={form.auth_type === key ? "secondary" : "outline"} className={form.auth_type === key ? "border border-primary/50" : ""} onClick={() => setForm({ ...form, auth_type: key })}>{label}</Button>)}</div></fieldset>
        {form.auth_type === "api_key" && <div className="grid gap-3 sm:grid-cols-[160px_1fr]"><Field title="请求头名称"><Input value={form.header_name} onChange={e => setForm({ ...form, header_name: e.target.value })} className="h-9 font-mono text-xs"/></Field><Field title="密钥" note={form.id ? "已保存的密钥不回显，留空则保持不变。" : "保存在服务端，不会回显。"}><Input type="password" autoComplete="off" value={form.secret} onChange={e => setForm({ ...form, secret: e.target.value })} placeholder={form.id ? "留空保持原密钥" : "输入密钥或 Bearer token"} className="h-9 text-xs"/></Field></div>}
        <details className="rounded-md border border-border p-3 text-xs"><summary className="cursor-pointer font-medium">高级设置 · 代理</summary><div className="pt-3"><Field title="代理地址" note="仅适用于将目标地址拼接在路径末尾的 HTTPS 中转服务。"><Input value={form.proxy_url} onChange={e => setForm({ ...form, proxy_url: e.target.value })} placeholder="https://proxy.example.com/" className="h-9 font-mono text-xs"/></Field></div></details>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div><div className="flex justify-end gap-2 border-t border-border px-6 py-4"><Button size="sm" variant="outline" onClick={() => setEditor(false)} disabled={busy}>取消</Button><Button size="sm" onClick={() => void submit()} disabled={busy}>{busy && <LoaderCircle className="animate-spin"/>}{form.id ? "保存并测试" : "添加并测试"}</Button></div>
    </DialogContent></Dialog>
  </div>;
}
