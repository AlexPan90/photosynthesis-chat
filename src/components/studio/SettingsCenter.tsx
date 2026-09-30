import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Blocks, Bot, Keyboard, Moon, Plug, Settings2, SlidersHorizontal, Sparkles, Sun, X, Cpu, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SkillsDock } from "./SkillsDock";
import { ModelSettings } from "./ModelSettings";

type Props = {
  open: boolean; onOpenChange: (v: boolean) => void;
  dark: boolean; setDark: (v: boolean) => void;
  fontSize: number; setFontSize: (v: number) => void;
  language: string; setLanguage: (v: string) => void;
  userEmail?: string | undefined; userId?: string | undefined; canInvoke: boolean;
  onSignOut: () => void;
};

const tabs = [
  { id: "general", label: "通用", icon: SlidersHorizontal },
  { id: "appearance", label: "外观", icon: Sun },
  { id: "models", label: "模型", icon: Cpu },
  { id: "skills", label: "技能", icon: Sparkles },
  { id: "orchestra", label: "编排中心", icon: Blocks },
  { id: "keys", label: "快捷键", icon: Keyboard },
] as const;

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-6 border-b border-border/60 py-4 last:border-0">
    <div className="min-w-0"><p className="text-[13px] font-medium">{title}</p>{desc && <p className="mt-1 text-[11.5px] text-muted-foreground">{desc}</p>}</div>
    <div className="shrink-0">{children}</div>
  </div>;
}

export function SettingsCenter(p: Props) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("general");
  return <Dialog open={p.open} onOpenChange={p.onOpenChange}>
    <DialogContent className="relay-settings-surface flex h-[min(666px,92vh)] w-[min(668px,94vw)] max-w-none gap-0 overflow-hidden rounded-[20px] p-0 [&>button:last-child]:hidden">
      <nav className="flex w-12 shrink-0 flex-col bg-sidebar p-2 sm:w-[164px] sm:p-2.5">
        <DialogTitle className="flex h-12 items-center justify-center gap-2 px-1 text-[14px] font-medium sm:justify-start sm:px-2"><Settings2 className="size-4 shrink-0 sm:hidden"/><span className="hidden sm:inline">Settings</span></DialogTitle>
        {tabs.map(t => <Button key={t.id} variant="ghost" size="sm" title={t.label} aria-label={t.label} onClick={() => setTab(t.id)} className={`mb-0.5 flex h-8 w-full items-center justify-center gap-2.5 rounded-md px-2 text-[12px] sm:justify-start ${tab === t.id ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"}`}><t.icon className="size-4 shrink-0"/><span className="hidden sm:inline">{t.label}</span></Button>)}

      </nav>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-end px-3">
          <div className="flex items-center gap-1">
            {tab !== "models" && <Button asChild variant="outline" size="sm" className="hidden h-7 text-[11px] sm:inline-flex"><Link to="/studio/agents" onClick={() => p.onOpenChange(false)}>打开编排中心<ArrowUpRight className="size-3.5"/></Link></Button>}
            <Button variant="ghost" size="icon" className="size-7" onClick={() => p.onOpenChange(false)} aria-label="关闭"><X className="size-4"/></Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-0 sm:px-3 sm:pr-5">
          {tab === "general" && <>
            <Row title="界面语言"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8 gap-1.5">{p.language}<ChevronDown className="size-3"/></Button></DropdownMenuTrigger><DropdownMenuContent className="relay-settings-surface">{["简体中文", "English"].map(l => <DropdownMenuItem key={l} onClick={() => p.setLanguage(l)}>{l}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></Row>
            <Row title="账号" desc={p.userEmail ? `对话已保存到云端（${p.userEmail}）` : "登录后对话会保存到云端"}>{p.userEmail ? <Button variant="outline" size="sm" className="h-8" onClick={p.onSignOut}>退出登录</Button> : <Button asChild size="sm" className="h-8"><Link to="/auth">去登录</Link></Button>}</Row>
            <PermissionRow signedIn={!!p.userId} />
          </>}
          {tab === "appearance" && <>
            <div className="border-b border-border/60 py-4">
              <p className="mb-3 text-[13px] font-medium">主题</p>
              <div className="grid grid-cols-2 gap-3">
                {[{ v: false, l: "浅色", I: Sun }, { v: true, l: "深色", I: Moon }].map(o => <button key={o.l} onClick={() => p.setDark(o.v)} className={`flex h-24 flex-col items-center justify-center gap-2 rounded-xl border text-[13px] transition-colors ${p.dark === o.v ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/40" : "border-border/60 text-muted-foreground hover:bg-accent/40"}`}><o.I className="size-5"/>{o.l}</button>)}
              </div>
            </div>
            <div className="py-4">
              <div className="mb-4 flex justify-between"><div><p className="text-[13px] font-medium">界面字体大小</p><p className="mt-1 text-[11.5px] text-muted-foreground">缩放全部页面、表格与弹窗文字</p></div><span className="font-mono text-xs text-muted-foreground">{p.fontSize}px</span></div>
              <Slider value={[p.fontSize]} min={12} max={18} step={1} onValueChange={v => p.setFontSize(v[0] ?? 14)}/>
            </div>
          </>}
          {tab === "models" && <ModelSettings userId={p.userId}/>}
          {tab === "skills" && <div className="py-3">
            <p className="mb-2 text-[11.5px] text-muted-foreground">已启用的技能。点击 ▶ 在当前对话中调用；安装和管理请前往 Skills 页面。</p>
            <div className="-mx-3 rounded-xl"><SkillsDock userId={p.userId} canInvoke={p.canInvoke}/></div>
            <Button asChild variant="outline" size="sm" className="mt-3 h-8"><Link to="/studio/skills" onClick={() => p.onOpenChange(false)}>管理技能<ArrowUpRight className="size-3.5"/></Link></Button>
          </div>}
          {tab === "orchestra" && <div className="grid gap-3 py-4 sm:grid-cols-3">
            {[{ to: "/studio/agents", t: "Agent", d: "提示词、模型与工具编排", I: Bot }, { to: "/studio/mcp", t: "MCP 连接", d: "远程服务地址、密钥与代理", I: Plug }, { to: "/studio/skills", t: "Skills", d: "安装、启用与预览技能", I: Sparkles }].map(c => <Link key={c.to} to={c.to} onClick={() => p.onOpenChange(false)} className="group rounded-xl border border-border/60 p-4 transition-colors hover:border-primary/50 hover:bg-accent/40">
              <c.I className="size-5 text-primary"/><p className="mt-3 flex items-center text-[13px] font-medium">{c.t}<ArrowUpRight className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-100"/></p><p className="mt-1 text-[11.5px] text-muted-foreground">{c.d}</p>
            </Link>)}
          </div>}
          {tab === "keys" && [["发送消息", "Enter"], ["换行", "Shift + Enter"], ["新建对话", "⌘ K"], ["搜索对话", "⌘ F"], ["快捷指令", "/"]].map(([l, k]) => <Row key={l} title={l!}><kbd className="rounded-md border bg-muted px-2 py-0.5 font-mono text-[11px]">{k}</kbd></Row>)}
        </div>
      </section>
    </DialogContent>
  </Dialog>;
}

const permOpts = { ask: { name: "操作前确认", desc: "删除、发送、运行脚本前弹卡片确认" }, auto: { name: "自动执行", desc: "不再询问，直接执行所有工具" }, readonly: { name: "只读", desc: "禁止任何写操作和脚本" } } as const;
type Perm = keyof typeof permOpts;
function PermissionRow({ signedIn }: { signedIn: boolean }) {
  const [v, setV] = useState<Perm>("ask");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const s = localStorage.getItem("relay-default-permission"); if (s === "ask" || s === "auto" || s === "readonly") setV(s); }, []);
  async function pick(k: Perm) {
    if (!signedIn) { toast.error("登录后才能设置权限"); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("threads").update({ permission: k }).eq("user_id", u.user?.id ?? "");
    setBusy(false);
    if (error) { toast.error("保存失败，请重试"); return; }
    localStorage.setItem("relay-default-permission", k); setV(k);
    window.dispatchEvent(new CustomEvent("relay-permission", { detail: k }));
    toast.success(`已将所有对话权限设为「${permOpts[k].name}」`);
  }
  return <Row title="默认权限" desc="修改后同步到全部对话和之后新建的对话；单个对话仍可用 /permission 单独调整">
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={busy} className="h-8 gap-1.5">{permOpts[v].name}<ChevronDown className="size-3"/></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="relay-settings-surface w-60">{(Object.keys(permOpts) as Perm[]).map(k => <DropdownMenuItem key={k} onClick={() => void pick(k)} className="flex flex-col items-start gap-0.5 text-xs"><span className="font-medium">{permOpts[k].name}{v === k ? " ✓" : ""}</span><span className="text-[11px] text-muted-foreground">{permOpts[k].desc}</span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
  </Row>;
}
