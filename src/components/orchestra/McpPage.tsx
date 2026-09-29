import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, CircleAlert, LoaderCircle, Plug, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { saveMcpConnection, testMcpConnection } from "@/lib/orchestra.functions";
import { useMcpConnections, type McpConn } from "./data";

const PRESETS = [
  { name: "DeepWiki", url: "https://mcp.deepwiki.com/mcp", auth: "none", note: "读取 GitHub 开源仓库文档，无需鉴权" },
  { name: "Context7", url: "https://mcp.context7.com/mcp", auth: "none", note: "最新的开发库文档，无需鉴权" },
  { name: "GitHub", url: "https://api.githubcopilot.com/mcp/", auth: "api_key", note: "填 GitHub 个人访问令牌" },
  { name: "Hugging Face", url: "https://huggingface.co/mcp", auth: "api_key", note: "填 Hugging Face 访问令牌" },
  { name: "Linear", url: "https://mcp.linear.app/mcp", auth: "api_key", note: "填 Linear API Key" },
  { name: "Notion", url: "https://mcp.notion.com/mcp", auth: "oauth", note: "需要 OAuth 授权（即将支持）" },
] as const;

type Form = { id?: string; name: string; url: string; auth_type: "none" | "api_key"; header_name: string; secret: string; proxy_url: string };
const blank: Form = { name: "", url: "", auth_type: "none", header_name: "Authorization", secret: "", proxy_url: "" };

function StateBadge({ c }: { c: McpConn }) {
  if (c.state === "ready") return <span className="flex items-center gap-1 text-[11px] text-success"><Check className="size-3"/>已就绪</span>;
  if (c.state === "failed") return <span className="flex items-center gap-1 text-[11px] text-destructive"><CircleAlert className="size-3"/>失败</span>;
  return <span className="text-[11px] text-muted-foreground">待测试</span>;
}

export function McpPage() {
  const { items, loading, reload } = useMcpConnections();
  const save = useServerFn(saveMcpConnection);
  const test = useServerFn(testMcpConnection);
  const [sel, setSel] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const current = items.find(i => i.id === sel);

  function open(c?: McpConn) { setErr(""); setSel(c?.id ?? "new"); setForm(c ? { id: c.id, name: c.name, url: c.url, auth_type: c.auth_type as Form["auth_type"], header_name: c.header_name, secret: "", proxy_url: c.proxy_url ?? "" } : blank); }
  async function submit() {
    if (!form.name.trim() || !form.url.trim()) return setErr("请填写名称和地址");
    setBusy(true); setErr("");
    try {
      const r = await save({ data: { ...form, secret: form.secret || undefined, proxy_url: form.proxy_url.trim() } });
      await reload(); setSel(r.id); setForm(f => ({ ...f, id: r.id, secret: "" }));
      if (r.state === "failed") setErr(`已保存，但连接失败：${r.last_error ?? "未知错误"}`);
    } catch (e) { setErr((e as Error).message || "保存失败"); }
    setBusy(false);
  }
  async function retry(id: string) { setBusy(true); setErr(""); try { const r = await test({ data: { id } }); if (r.state === "failed") setErr(r.last_error ?? "连接失败"); } catch (e) { setErr((e as Error).message); } await reload(); setBusy(false); }
  async function remove(c: McpConn) { if (!confirm(`断开并删除「${c.name}」？绑定它的 Agent 将不再能使用这些工具。`)) return; await supabase.from("mcp_connections").delete().eq("id", c.id); setSel(null); await reload(); }
  async function toggleTool(c: McpConn, name: string, on: boolean) {
    const disabled_tools = on ? c.disabled_tools.filter(t => t !== name) : [...c.disabled_tools, name];
    await supabase.from("mcp_connections").update({ disabled_tools }).eq("id", c.id); await reload();
  }

  return <div className="grid h-full grid-cols-[260px_1fr]">
    <aside className="soft-scroll overflow-y-auto border-r p-2">
      <div className="flex items-center px-2 py-1.5 text-[11px] font-medium text-muted-foreground">已连接<button onClick={() => open()} className="ml-auto rounded p-1 hover:bg-secondary" aria-label="新建连接"><Plus className="size-3.5"/></button></div>
      {loading ? <p className="px-2 py-2 text-xs text-muted-foreground">加载中…</p> : items.length === 0 && <button onClick={() => open()} className="m-1 w-[calc(100%-8px)] rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground hover:bg-secondary">+ 添加第一个 MCP 服务</button>}
      {items.map(c => <button key={c.id} onClick={() => open(c)} className={`mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-secondary ${sel === c.id ? "bg-secondary" : ""}`}>
        <Plug className="size-3.5 shrink-0 text-muted-foreground"/><span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.name}</span><span className="block truncate text-[11px] text-muted-foreground">{c.tools.length} 个工具</span></span><StateBadge c={c}/>
      </button>)}
    </aside>

    <section className="soft-scroll overflow-y-auto">
      {!sel ? <div className="flex h-full flex-col items-center justify-center gap-3 text-xs text-muted-foreground"><Plug className="size-6"/>连接远程 MCP 服务，把它的工具交给 Agent 使用<Button size="sm" variant="outline" onClick={() => open()}><Plus className="size-3.5"/>新建连接</Button></div> :
      <div className="mx-auto max-w-[680px] space-y-5 px-8 py-6">
        <div className="flex items-center gap-2"><h2 className="text-base font-semibold">{sel === "new" ? "新建 MCP 连接" : current?.name}</h2>{current && <StateBadge c={current}/>}
          {current && <div className="ml-auto flex gap-1.5"><Button size="sm" variant="outline" className="text-xs" disabled={busy} onClick={() => retry(current.id)}><RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`}/>重新测试</Button><Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => remove(current)}><Trash2 className="size-3.5"/>断开</Button></div>}
        </div>

        {sel === "new" && <div><p className="mb-2 text-xs text-muted-foreground">常用服务</p><div className="grid grid-cols-3 gap-2">{PRESETS.map(p => <button key={p.name} disabled={p.auth === "oauth"} onClick={() => setForm({ ...blank, name: p.name, url: p.url, auth_type: p.auth === "oauth" ? "none" : p.auth })}
          className={`rounded-lg border px-3 py-2.5 text-left text-xs transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50 ${form.url === p.url ? "border-primary" : ""}`}><span className="block font-medium">{p.name}</span><span className="mt-0.5 block text-[10.5px] leading-4 text-muted-foreground">{p.note}</span></button>)}</div></div>}

        <div className="space-y-3">
          <div className="grid grid-cols-[180px_1fr] gap-3">
            <label className="space-y-1 text-xs"><span className="text-muted-foreground">名称</span><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-8 text-xs"/></label>
            <label className="space-y-1 text-xs"><span className="text-muted-foreground">服务地址（https）</span><Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/mcp" className="h-8 font-mono text-xs"/></label>
          </div>
          <div className="space-y-1 text-xs"><span className="text-muted-foreground">鉴权方式</span><div className="flex gap-1.5">
            {([["none", "无鉴权"], ["api_key", "API Key / 令牌"], ["oauth", "OAuth（即将支持）"]] as const).map(([v, l]) => <button key={v} disabled={v === "oauth"} onClick={() => setForm({ ...form, auth_type: v as Form["auth_type"] })} className={`h-8 rounded-md border px-3 text-xs disabled:opacity-50 ${form.auth_type === v ? "border-primary bg-primary/5 font-medium" : "hover:bg-secondary"}`}>{l}</button>)}
          </div></div>
          {form.auth_type === "api_key" && <div className="grid grid-cols-[180px_1fr] gap-3">
            <label className="space-y-1 text-xs"><span className="text-muted-foreground">请求头名称</span><Input value={form.header_name} onChange={e => setForm({ ...form, header_name: e.target.value })} className="h-8 font-mono text-xs"/></label>
            <label className="space-y-1 text-xs"><span className="text-muted-foreground">密钥 {current?.auth_type === "api_key" && "（已保存，留空则不修改）"}</span><Input type="password" autoComplete="off" value={form.secret} onChange={e => setForm({ ...form, secret: e.target.value })} placeholder={current?.auth_type === "api_key" ? "••••••••" : "粘贴密钥"} className="h-8 font-mono text-xs"/></label>
          </div>}
          <label className="block space-y-1 text-xs"><span className="text-muted-foreground">代理地址（可选）</span><Input value={form.proxy_url} onChange={e => setForm({ ...form, proxy_url: e.target.value })} placeholder="https://proxy.example.com" className="h-8 font-mono text-xs"/><span className="block text-[11px] text-muted-foreground">填写后请求会发往「代理地址/服务地址」，用于经网关或中转访问受限的 MCP 服务。</span></label>
          <p className="text-[11px] text-muted-foreground">密钥加密保存在服务端，保存后不会再显示。</p>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <Button size="sm" className="text-xs" disabled={busy} onClick={submit}>{busy && <LoaderCircle className="size-3.5 animate-spin"/>}{sel === "new" ? "连接并保存" : "保存修改"}</Button>
        </div>

        {current && <div>
          <div className="mb-1.5 text-xs font-medium">工具 <span className="font-normal text-muted-foreground">{current.tools.length}</span></div>
          {current.state === "failed" && current.last_error && <p className="mb-2 rounded-md bg-destructive/5 px-3 py-2 text-[11px] text-destructive">{current.last_error}</p>}
          {current.tools.length === 0 ? <p className="text-xs text-muted-foreground">暂无工具</p> : <div className="divide-y rounded-lg border">{current.tools.map(t => { const on = !current.disabled_tools.includes(t.name);
            return <div key={t.name} className="flex items-start gap-3 px-3 py-2.5"><span className="min-w-0 flex-1"><span className={`block font-mono text-xs ${on ? "" : "text-muted-foreground line-through"}`}>{t.name}</span>{t.description && <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-muted-foreground">{t.description}</span>}</span><Switch checked={on} onCheckedChange={v => toggleTool(current, t.name, v)} aria-label={`启用 ${t.name}`}/></div>; })}</div>}
          <p className="mt-2 text-[11px] text-muted-foreground">不绑定 Agent 时，通用助手可使用全部已启用工具；到「Agent」页把工具拖给指定 Agent。</p>
        </div>}
      </div>}
    </section>
  </div>;
}
