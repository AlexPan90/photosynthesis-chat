import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { Activity, ArrowUpRight, Bot, Check, ChevronDown, CircleAlert, Clock3, Command, Copy, Folder, Keyboard, LayoutPanelLeft, ListFilter, MessageSquare, MoreHorizontal, PanelRight, Paperclip, Search, Settings2, SlidersHorizontal, SquarePen, Sun, Tags, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse, MessageActions, MessageAction } from "@/components/ai-elements/message";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputButton, PromptInputSubmit, PromptInputTools, usePromptInputAttachments } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { FileCard } from "./FileCard";
import { StoryReader } from "./StoryReader";
import { WorkspacePanel } from "./WorkspacePanel";
import { demoFiles, kindStyles } from "./files";
import { LiveChat, ModelMenu, modelLabel, type LiveModel } from "./LiveChat";
import { updateThreadModel } from "@/lib/orchestra.functions";
import { useSlashCommands, type SlashCommand } from "./slash-commands";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { buildBranches, type Row } from "@/lib/branches";

const trajectory: { title: string; tool: string; ms: string; detail: string; state: "done" | "running" | "error" }[] = [
  { title: "解析任务意图", tool: "planner", ms: "412ms", detail: "拆解为三步：采集定价页面、检索竞品资料、生成对比摘要。", state: "done" },
  { title: "访问定价页面", tool: "browser.open", ms: "1.8s", detail: "https://example.com/pricing · 已提取 3 个方案与 12 条特性。", state: "done" },
  { title: "检索竞品资料", tool: "web.search", ms: "2.3s", detail: "query: AI workspace pricing comparison · 命中 8 条，保留 3 条高相关结果。", state: "done" },
  { title: "写入分析文件", tool: "fs.write", ms: "running", detail: "reports/pricing-summary.md · 正在写入结构化摘要与对比表格。", state: "running" },
];

type Thread = { id: string; title: string; group: string; updatedAt: number; messages: UIMessage[]; live?: boolean; model?: string; agentId?: string | null };
type ToolStep = { title: string; input: Record<string, string>; output?: string; errorText?: string; state: "output-available" | "input-available" | "output-error" | "input-streaming"; icon: "browser" | "search" | "file" };
type DemoMessage = UIMessage & { steps?: ToolStep[] };
type ToolScenario = { label: string; desc: string; steps: ToolStep[]; ms: string[] };
const toolScenarios: Record<string, ToolScenario> = {
  mixed: { label: "混合任务", desc: "成功 + 失败 + 重试 + 进行中", steps: [
    { title: "浏览器 · 访问页面", icon: "browser", state: "output-available", input: { url: "https://example.com/pricing" }, output: "页面加载完成 · 已提取 3 个方案" },
    { title: "网页搜索 · 竞品定价", icon: "search", state: "output-available", input: { query: "AI workspace pricing comparison", region: "global", limit: "8", freshness: "30d" }, output: [
        "找到 8 条相关结果 · 已筛选 3 条高相关内容",
        "",
        "1. Relay Studio — 免费版 200 次/月，团队版 $18/席，含共享工作区与用量看板",
        "2. Harness Desk — 免费版仅本地模型，团队版 $25/席，含审计日志与 SSO",
        "3. Agent Console — 按量计费 $0.02/次，团队包 1 万次 $150，含优先队列",
        "4. FlowPilot — 免费版 50 次/月，团队版 $12/席，功能较基础",
        "5. TaskGrid — 免费版带水印，团队版 $20/席，含 API 访问",
        "6. CoWork AI — 免费版 3 个项目，团队版 $15/席，含权限分组",
        "7. Pilot Hub — 免费版社区支持，团队版 $22/席，含 SLA",
        "8. Northwind Agents — 免费版限速，团队版 $19/席，含私有部署选项",
        "",
        "筛选依据：近 30 天更新、官方来源、含明确团队版定价。",
      ].join("\n") },
    { title: "浏览器 · 抓取 Notion 定价", icon: "browser", state: "output-error", input: { url: "https://notion.so/pricing", timeout: "10s" }, errorText: "请求超时（10s）：目标站点返回 403 Forbidden，已触发反爬限制" },
    { title: "浏览器 · 重试（备用代理）", icon: "browser", state: "output-available", input: { url: "https://notion.so/pricing", proxy: "us-west" }, output: "重试成功 · 提取 4 个方案" },
    { title: "代码 · 计算价格区间", icon: "file", state: "output-error", input: { cmd: "python analyze.py --currency USD" }, errorText: "Traceback (most recent call last):\n  File \"analyze.py\", line 42, in <module>\n    rate = rates[\"CNY\"]\nKeyError: 'CNY'" },
    { title: "文件 · 生成分析摘要", icon: "file", state: "input-available", input: { path: "reports/pricing-summary.md" } },
    { title: "邮件 · 发送报告给团队", icon: "file", state: "input-streaming", input: { to: "team@relay.dev" } },
  ], ms: ["1.2s", "2.3s", "10.0s", "3.1s", "0.8s", "", ""] },
  smooth: { label: "顺利完成", desc: "全部成功 · 耗时较短", steps: [
    { title: "网页搜索 · 行业报告", icon: "search", state: "output-available", input: { query: "AI agent market report 2026" }, output: "找到 5 条结果 · 保留 2 条权威来源" },
    { title: "浏览器 · 阅读报告全文", icon: "browser", state: "output-available", input: { url: "https://reports.example.com/ai-2026" }, output: "已提取 12 个章节 · 4,820 字" },
    { title: "文件 · 保存摘要", icon: "file", state: "output-available", input: { path: "notes/market-summary.md" }, output: "已写入 1.2 KB" },
  ], ms: ["1.8s", "4.6s", "0.3s"] },
  long: { label: "长耗时任务", desc: "多步骤 · 大文件处理", steps: [
    { title: "文件 · 读取数据集", icon: "file", state: "output-available", input: { path: "data/usage-2026.csv", rows: "128,400" }, output: "已加载 128,400 行 · 18 列" },
    { title: "代码 · 清洗与聚合", icon: "file", state: "output-available", input: { cmd: "python clean.py --dedupe --aggregate daily" }, output: "去除重复 3,212 行 · 聚合为 365 条日级记录" },
    { title: "代码 · 生成图表", icon: "file", state: "output-available", input: { cmd: "python chart.py --type line --out charts/usage.svg" }, output: "已生成 charts/usage.svg · 96 KB" },
    { title: "浏览器 · 截图存档", icon: "browser", state: "input-available", input: { url: "file:///charts/usage.svg", viewport: "1440x900" } },
  ], ms: ["12.4s", "48.2s", "21.7s", ""] },
  broken: { label: "异常排查", desc: "连续失败 · 权限与网络", steps: [
    { title: "浏览器 · 访问内网面板", icon: "browser", state: "output-error", input: { url: "https://internal.example.com/admin" }, errorText: "ECONNREFUSED · 无法连接到 internal.example.com:443，请检查网络或 VPN" },
    { title: "文件 · 写入日志", icon: "file", state: "output-error", input: { path: "/var/log/agent/run.log" }, errorText: "EACCES: permission denied, open '/var/log/agent/run.log'" },
    { title: "网页搜索 · 错误码检索", icon: "search", state: "output-available", input: { query: "ECONNREFUSED 443 troubleshooting" }, output: "找到 3 条排查建议" },
  ], ms: ["5.0s", "0.1s", "1.9s"] },
};
const scenarioKeys = Object.keys(toolScenarios);
const seed: Thread[] = [
  { id: "product-research", title: "竞品定价策略调研", group: "产品研究", updatedAt: 10, messages: [
    { id: "u1", role: "user", parts: [{ type: "text", text: "帮我调研几款 AI 工作台的定价策略，整理成一个简明的对比分析。重点关注免费版和团队版的差异。" }] },
    { id: "a1", role: "assistant", parts: [{ type: "text", text: "我会先查看几款产品的公开定价信息，再提炼免费版与团队版的主要差异。" }] },
    { id: "a2", role: "assistant", parts: [{ type: "text", text: "### 初步发现\n\n不同产品的免费版通常通过**使用额度**与**协作权限**划分层级。团队版则更强调共享工作空间、管理控制台与用量可见性。\n\n| 对比维度 | 免费版 | 团队版 |\n| :--- | :--- | :--- |\n| 使用额度 | 基础额度 | 更高额度或统一计费 |\n| 协作方式 | 个人使用 | 团队空间与共享资源 |\n| 管理能力 | 基础设置 | 成员、权限与账单管理 |\n\n> 这是一份界面展示用的示例分析，不代表实时调研结果。" }] },
  ] },
  { id: "api-review", title: "API 文档结构优化", group: "产品研究", updatedAt: 9, messages: [{ id: "a3", role: "assistant", parts: [{ type: "text", text: "建议从快速开始、身份验证、错误处理和示例代码四个部分重组 API 文档。" }] }] },
  { id: "weekly-report", title: "整理本周项目进展", group: "工作流", updatedAt: 8, messages: [{ id: "a4", role: "assistant", parts: [{ type: "text", text: "本周进展可以按已完成、进行中、下周计划三个部分整理。" }] }] },
  { id: "landing-copy", title: "Landing Page 文案", group: "工作流", updatedAt: 7, messages: [] },
  { id: "python-example", title: "Python 数据清洗示例", group: "未分组", updatedAt: 6, messages: [{ id: "a5", role: "assistant", parts: [{ type: "text", text: "使用 pandas 可以快速处理缺失值：\n\n```python\nimport pandas as pd\ndf = pd.read_csv('data.csv')\ndf = df.dropna(subset=['email'])\n```" }] }] },
];
const agents = ["Research Agent", "Browser Agent", "Code Agent", "通用助手"];
function IconTip({ label, children, onClick, className = "" }: { label: string; children: React.ReactNode; onClick?: () => void; className?: string }) { return <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} className={className}>{children}</Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>; }
function Mark({ compact = false }: { compact?: boolean }) { return <div className={`flex shrink-0 items-center justify-center rounded bg-primary text-primary-foreground shadow-[0_0_16px_-8px_var(--color-primary)] ${compact ? "size-7" : "size-8"}`} aria-label="Relay"><span className="font-mono text-base font-semibold leading-none">R<span className="text-primary-foreground/60">.</span></span></div>; }
function AttachedFiles() { const { files, remove, openFileDialog } = usePromptInputAttachments(); return <>{files.length > 0 && <div className="flex flex-wrap gap-2 px-3 pt-2">{files.map(f => <div key={f.id} className="flex items-center gap-1.5 rounded-md border bg-muted px-2 py-1 text-xs"><Paperclip className="size-3"/><span className="max-w-32 truncate">{f.filename || "附件"}</span><Button type="button" variant="ghost" size="icon-sm" className="size-5" aria-label="移除附件" onClick={() => remove(f.id)}><X className="size-3"/></Button></div>)}</div>}<PromptInputButton tooltip="添加附件" onClick={openFileDialog}><Paperclip className="size-4" /></PromptInputButton></>; }
export function Studio({ threadId }: { threadId?: string }) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [liveThreads, setLiveThreads] = useState<Thread[]>([]);
  const [demoThreads, setDemoThreads] = useState<Thread[]>(seed);
  const threads = useMemo(() => [...liveThreads, ...demoThreads], [liveThreads, demoThreads]);
  const [liveMessages, setLiveMessages] = useState<{ id: string; messages: UIMessage[]; versions: Record<string, UIMessage[]> } | null>(null);
  const [ready, setReady] = useState(false);
  const initials = (user?.email ?? "访客").slice(0, 2).toUpperCase();
  const [sidebar, setSidebar] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(232);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("全部会话");
  const [dark, setDark] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("外观");
  const [fontSize, setFontSize] = useState(14);
  const [language, setLanguage] = useState("简体中文");
  const [model, setModel] = useState<LiveModel>("openai/gpt-6-astra");
  const [agent] = useState(agents[0]);
  const mode: "agent" | "chat" = "agent";
  const [preview, setPreview] = useState(false);
  const [split, setSplit] = useState(65);
  const panesRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [scenario, setScenario] = useState<"default" | "loading" | "streaming" | "running" | "error">("default");
  const [toolScenario, setToolScenario] = useState("mixed");
  const [status, setStatus] = useState<"ready" | "submitted" | "streaming" | "error">("ready");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"chat" | "trajectory" | "files" | "story">("chat");
  const [openFileId, setOpenFileId] = useState<string | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setReady(true); setDark(localStorage.getItem("relay-dark") !== "false"); setFontSize(Number(localStorage.getItem("relay-font")) || 14); }, []);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); if (ready) localStorage.setItem("relay-dark", String(dark)); }, [dark, ready]);
  useEffect(() => { if (ready) localStorage.setItem("relay-font", String(fontSize)); }, [fontSize, ready]);
  useEffect(() => { textareaRef.current?.focus(); }, [threadId, status]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function refreshThreads() {
    if (!user) { setLiveThreads([]); return; }
    const { data, error } = await supabase.from("threads").select("id,title,group_name,updated_at,model,agent_id").order("updated_at", { ascending: false }).limit(200);
    if (error) { setNotice("对话列表加载失败"); return; }
    setLiveThreads((data ?? []).map(t => ({ id: t.id, title: t.title, group: t.group_name, updatedAt: new Date(t.updated_at).getTime(), messages: [], live: true, model: t.model, agentId: t.agent_id })));
  }
  useEffect(() => { refreshThreads(); }, [user?.id]);
  const active = threads.find(t => t.id === threadId);
  const isLive = !!active?.live;
  useEffect(() => {
    if (!isLive || !threadId) return;
    if (liveMessages?.id === threadId) return;
    setLiveMessages(null);
    if (active?.model) setModel(active.model as LiveModel);
    supabase.from("messages").select("id,role,parts,parent_id,metadata,selected_at,created_at").eq("thread_id", threadId).order("created_at").then(({ data, error }) => {
      if (error) { setNotice("消息加载失败"); return; }
      setLiveMessages({ id: threadId, ...buildBranches((data ?? []) as Row[]) });
    });
  }, [isLive, threadId]);
  const shown = useMemo(() => [...threads].filter(t => (group === "全部会话" || t.group === group) && t.title.toLowerCase().includes(search.toLowerCase())).sort((a,b) => (Number(!!b.live) - Number(!!a.live)) || (b.updatedAt - a.updatedAt)), [threads, group, search]);
  function updateThread(id: string, updater: (thread: Thread) => Thread) {
    const target = threads.find(t => t.id === id);
    if (target?.live) { const next = updater(target); setLiveThreads(prev => prev.map(t => t.id === id ? next : t)); supabase.from("threads").update({ group_name: next.group, title: next.title }).eq("id", id).then(({ error }) => error && setNotice("保存失败")); return; }
    setDemoThreads(prev => prev.map(t => t.id === id ? updater(t) : t));
  }
  function changeModel(m: LiveModel) {
    setModel(m);
    setNotice(`已切换到 ${modelLabel(m)}`);
    setTimeout(() => setNotice(""), 2200);
    if (isLive && threadId) {
      setLiveThreads(prev => prev.map(t => t.id === threadId ? { ...t, model: m, agentId: null } : t));
      updateThreadModel({ data: { threadId, model: m, agentId: null } }).catch(() => setNotice("模型保存失败"));
    }
  }
  async function createThread() {
    setMobileSidebar(false);
    if (!user) { navigate({ to: "/auth" }); return; }
    const { data, error } = await supabase.from("threads").insert({ user_id: user.id, model }).select("id,title,group_name,updated_at,model").single();
    if (error || !data) { setNotice("新建对话失败"); return; }
    setLiveThreads(prev => [{ id: data.id, title: data.title, group: data.group_name, updatedAt: Date.now(), messages: [], live: true, model: data.model }, ...prev]);
    setLiveMessages({ id: data.id, messages: [], versions: {} });
    setScenario("default");
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
  }
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (!(event.metaKey || event.ctrlKey)) return; if (event.key.toLowerCase() === "k") { event.preventDefault(); createThread(); } if (event.key.toLowerCase() === "f") { event.preventDefault(); setSidebar(true); setMobileSidebar(true); requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[aria-label="搜索对话"]')?.focus()); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); });
  function stop() { if (timer.current) clearTimeout(timer.current); setStatus("ready"); setScenario("default"); }
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const slashCommands: SlashCommand[] = [
    { name: "model", desc: "选择本次对话的模型", run: () => { setDraft(""); setModelMenuOpen(true); } },
    { name: "new", desc: "开始一个新对话", run: () => { setDraft(""); void createThread(); } },
    { name: "clear", desc: "清空输入框", run: () => setDraft("") },
    { name: "summarize", desc: "让 AI 总结一段内容", run: () => setDraft("请总结以下内容：") },
    { name: "research", desc: "让 AI 联网调研一个主题", run: () => setDraft("请联网调研：") },
    { name: "code", desc: "让 AI 生成代码", run: () => setDraft("请帮我写代码：") },
    { name: "feedback", desc: "记录对这次对话的反馈", run: () => setDraft("反馈：") },
  ];
  const slash = useSlashCommands(slashCommands, draft, setDraft, textareaRef);
  function send(text: string, files: { filename?: string }[]) { if (!text.trim() && files.length === 0) return; setNotice(user ? "示例对话为只读，请新建对话开始真实交流" : "示例对话为只读，登录后即可开始真实对话"); setTimeout(() => setNotice(""), 2600); }
  async function signOut() { await supabase.auth.signOut(); setSettingsOpen(false); setLiveThreads([]); navigate({ to: "/", replace: true }); }
  function copyText(text: string) { navigator.clipboard.writeText(text); setNotice("已复制到剪贴板"); setTimeout(() => setNotice(""), 2200); }
  function removeThread(id: string) { const target = threads.find(t => t.id === id); if (target?.live) { setLiveThreads(prev => prev.filter(t => t.id !== id)); supabase.from("threads").delete().eq("id", id).then(({ error }) => error && setNotice("删除失败")); } else setDemoThreads(prev => prev.filter(t => t.id !== id)); if (id === threadId) navigate({ to: "/" }); }
  function resizePanes(clientX: number) {
    const bounds = panesRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const minCenter = 340;
    const minRight = 300;
    const width = bounds.width;
    if (width < minCenter + minRight) return;
    setSplit(Math.round(Math.max(minCenter, Math.min(width - minRight, clientX - bounds.left)) / width * 1000) / 10);
  }
  function nudgePanes(direction: number) {
    const width = panesRef.current?.getBoundingClientRect().width;
    if (!width || width < 640) return;
    const min = 340 / width * 100;
    const max = (width - 300) / width * 100;
    setSplit(value => Math.round(Math.max(min, Math.min(max, value + direction * 2)) * 10) / 10);
  }
  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    resizePanes(event.clientX);
  }
  function resizeSidebar(clientX: number) {
    const bounds = shellRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setSidebarWidth(Math.round(Math.max(192, Math.min(360, Math.min(bounds.width - 640, clientX - bounds.left)))));
  }
  function startSidebarResize(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeSidebar(event.clientX);
  }
  const grouped = ["产品研究", "工作流", "未分组"];
   return <TooltipProvider delayDuration={350}><div ref={shellRef} className="relay-shell flex h-dvh min-h-[560px] overflow-hidden text-foreground">
    {mobileSidebar && <div className="fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={() => setMobileSidebar(false)} />}
     <aside className={`${mobileSidebar ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} relay-sidebar fixed inset-y-0 left-0 z-40 flex w-[232px] shrink-0 flex-col overflow-hidden bg-sidebar transition-transform duration-200 lg:relative lg:z-auto lg:transition-none ${!sidebar ? "lg:!w-0" : ""}`} style={sidebar ? { width: sidebarWidth } : undefined}>
       <div className="relay-sidebar-brand flex h-[64px] min-w-[192px] items-center justify-between px-5"><div className="flex items-center gap-2.5"><Mark/><span className="font-display text-[16px] font-semibold">relay<span className="text-primary">.</span><span className="ml-1 font-normal text-muted-foreground">studio</span></span></div><IconTip label="收起侧栏" onClick={() => { setSidebar(false); setMobileSidebar(false); }}><LayoutPanelLeft className="size-4"/></IconTip></div>
       <div className="min-w-[192px] px-3"><Button variant="outline" className="h-9 w-full justify-start gap-2 border-border bg-card font-medium shadow-[0_1px_3px_-2px_var(--color-foreground)] hover:border-primary/30" onClick={createThread}><SquarePen className="size-4"/>新建对话<span className="ml-auto text-[10px] text-muted-foreground">⌘ K</span></Button><div className="relative mt-3"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground"/><Input aria-label="搜索对话" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索对话..." className="h-8 border-transparent bg-transparent pl-8 text-xs shadow-none focus-visible:bg-card" /></div></div>
       <div className="soft-scroll mt-5 min-w-[192px] flex-1 overflow-y-auto px-3 pb-4"><div className="mb-2 flex items-center justify-between px-2 text-[10px] font-semibold uppercase text-muted-foreground"><span>工作空间</span><Tags className="size-3"/></div><div className="mb-5 space-y-0.5">{["全部会话", ...grouped].map(g => <Button key={g} variant="ghost" onClick={() => setGroup(g)} className={`h-8 w-full justify-start gap-2.5 px-2 text-xs font-normal ${group === g ? "bg-accent/80 font-medium text-foreground" : "text-muted-foreground hover:bg-accent/40"}`}>{g === "全部会话" ? <MessageSquare className="size-3.5"/> : <Folder className="size-3.5"/>}{g}<span className="ml-auto text-[10px] text-muted-foreground">{g === "全部会话" ? threads.length : threads.filter(t => t.group === g).length}</span></Button>)}</div><div className="mb-2 flex items-center justify-between px-2 text-[10px] font-semibold uppercase text-muted-foreground"><span>最近对话</span><ListFilter className="size-3"/></div><div className="space-y-0.5">{shown.length ? shown.map(t => <div key={t.id} className={`group relative flex items-center rounded-md border border-transparent ${threadId === t.id ? "border-primary/25 bg-primary/5 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary" : "hover:bg-accent/50"}`}><Link to="/chat/$threadId" params={{ threadId: t.id }} onClick={() => setMobileSidebar(false)} className={`block h-9 w-full truncate px-2.5 pr-9 text-left text-xs leading-9 ${threadId === t.id ? "font-medium" : "text-muted-foreground"}`}>{t.title}{!t.live && <span className="ml-1.5 text-[9.5px] text-muted-foreground/60">示例</span>}</Link><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`${t.title} 更多操作`} className="absolute right-1 size-6 opacity-0 group-hover:opacity-100 focus:opacity-100"><MoreHorizontal className="size-3.5"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>移动到分组</DropdownMenuLabel>{grouped.map(g => <DropdownMenuItem key={g} onClick={() => updateThread(t.id, old => ({ ...old, group: g }))}>{g}</DropdownMenuItem>)}<DropdownMenuSeparator/><DropdownMenuItem className="text-destructive" onClick={() => removeThread(t.id)}><Trash2 className="mr-2 size-4"/>删除对话</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>) : <div className="px-2 py-4 text-xs text-muted-foreground">没有匹配的对话</div>}</div></div>
       <div className="min-w-[192px] border-t px-3 pt-2"><Button asChild variant="ghost" className="h-8 w-full justify-start gap-2 px-2 text-xs text-muted-foreground"><Link to="/studio/agents"><Bot className="size-3.5"/>编排中心<span className="ml-auto text-[10px]">Agent · MCP · Skills</span></Link></Button></div>
       <div className="min-w-[192px] px-3 pb-3 pt-1"><Button variant="ghost" className="h-10 w-full justify-start gap-2.5 px-1.5" onClick={() => { if (!user && !authLoading) navigate({ to: "/auth" }); else setSettingsOpen(true); }}><div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold">{initials}</div><span className="flex-1 text-left text-xs"><span className="block truncate font-semibold">{user ? user.email : "未登录"}</span><span className="block text-[10px] font-normal text-muted-foreground">{user ? "对话已云端保存" : "登录后开始真实对话"}</span></span><Settings2 className="size-4 text-muted-foreground"/></Button></div>
    </aside>
     {sidebar && <div role="separator" aria-label="调整侧栏宽度" aria-orientation="vertical" aria-valuemin={192} aria-valuemax={360} aria-valuenow={sidebarWidth} tabIndex={0} onPointerDown={startSidebarResize} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeSidebar(event.clientX); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setSidebarWidth(value => Math.max(192, Math.min(360, value + (event.key === "ArrowRight" ? 12 : -12)))); } }} className="relative hidden w-1.5 shrink-0 cursor-col-resize touch-none bg-border/50 transition-colors hover:bg-primary/30 focus-visible:bg-primary/30 focus-visible:outline-none lg:block"/>}
      <main ref={panesRef} className="flex min-w-0 flex-1 overflow-hidden">
        <div className={`relay-chat-plane flex min-w-0 flex-1 flex-col ${preview && view !== "story" ? "lg:flex-none" : ""}`} style={preview && view !== "story" ? { width: `clamp(340px, ${split}%, calc(100% - 306px))` } : undefined}>
       <header className="relay-chat-header grid h-[64px] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b px-4 md:px-8"><div className="flex min-w-0 items-center gap-3">{!sidebar && <IconTip label="展开侧栏" onClick={() => setSidebar(true)}><LayoutPanelLeft className="size-4"/></IconTip>}<div className="lg:hidden"><IconTip label="打开侧栏" onClick={() => { setSidebar(true); setMobileSidebar(true); }}><LayoutPanelLeft className="size-4"/></IconTip></div><span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground md:block">RELAY / CHAT</span><div className="hidden h-5 w-px bg-border md:block"/><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="min-w-0 max-w-full gap-1 px-1 font-display text-[14px] font-semibold"><span className="truncate">{view === "story" ? "潮汐来信" : active?.title || "新对话"}</span><ChevronDown className="size-3 shrink-0 text-muted-foreground"/></Button></DropdownMenuTrigger><DropdownMenuContent align="start">{([["chat", "对话", MessageSquare], ["trajectory", "轨迹", Activity]] as const).map(([value, label, Icon]) => <DropdownMenuItem key={value} onClick={() => setView(value)}><Icon className="mr-2 size-3.5"/>{label}{view === value && <Check className="ml-auto size-3"/>}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div><div className="flex shrink-0 items-center gap-3"><span className="hidden items-center gap-2 border-l border-border pl-4 font-mono text-[10px] text-muted-foreground md:flex"><span className="size-1.5 rounded-full bg-primary"/>{isLive ? "LIVE SESSION" : "PREVIEW"}</span>{view !== "story" && <IconTip label={preview ? "收起文件" : "打开文件"} onClick={() => setPreview(!preview)}><PanelRight className="size-4"/></IconTip>}</div></header>
       {view === "chat" && isLive && threadId && (liveMessages?.id === threadId ? <LiveChat key={threadId} threadId={threadId} initialMessages={liveMessages.messages} initialVersions={liveMessages.versions} initialAgentId={threads.find(t => t.id === threadId)?.agentId ?? null} model={model} onModel={changeModel} fontSize={fontSize} initials={initials} onActivity={refreshThreads} onNotice={t => { setNotice(t); setTimeout(() => setNotice(""), 2200); }}/> : <div className="flex flex-1 items-center justify-center"><Shimmer>正在加载对话...</Shimmer></div>)}
       {view === "chat" && !isLive && <Conversation key={threadId || "home"} className="relay-conversation soft-scroll"><ConversationContent className="relay-transcript mx-auto w-full max-w-[800px] gap-0 px-5 pb-10 pt-9 md:px-10">{!active || active.messages.length === 0 ? <ConversationEmptyState className="min-h-[45vh]" title="从一个想法开始" description="向 Agent 提出问题，或交给它一项任务。" icon={<Mark/>}><div className="flex flex-col items-center gap-4"><Mark/><h1 className="font-display text-xl font-semibold">从一个想法开始</h1><p className="text-sm text-muted-foreground">向 Agent 提出问题，或交给它一项任务。</p><div className="mt-3 flex flex-wrap justify-center gap-2">{["整理一份竞品分析", "解释这段代码", "规划本周工作"].map(v => <Button key={v} variant="outline" size="sm" className="lift text-xs shadow-none" onClick={() => { if (!active) createThread(); setDraft(v); textareaRef.current?.focus(); }}>{v}<ArrowUpRight className="size-3"/></Button>)}</div></div></ConversationEmptyState> : <>{active.messages.map((m, i) => { const text = m.parts.filter(p => p.type === "text").map(p => p.text).join("\n"); const isAgent = m.role === "assistant"; return <div key={m.id} className="relay-message mb-9"><div className={`mb-2 flex items-center gap-2 text-[11px] ${isAgent ? "" : "justify-end"}`}>{isAgent ? <><Mark compact/><span className="font-semibold">{agent}</span></> : <><span className="font-semibold">你</span><div className="flex size-6 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">AP</div></>}</div><Message from={m.role} className="max-w-full"><MessageContent className={isAgent ? "w-full text-[length:var(--message-size)] leading-[1.85]" : "max-w-[86%] rounded-lg border border-border/60 bg-secondary/70 px-4 py-3 text-[length:var(--message-size)] leading-[1.75]"} style={{ "--message-size": `${fontSize}px` } as React.CSSProperties}><MessageResponse>{text}</MessageResponse></MessageContent></Message>
        {isAgent && mode === "agent" && i === 1 && (() => { const sc = toolScenarios[toolScenario]!; return <details className="group mt-3"><summary className="cursor-pointer select-none text-[11px] text-muted-foreground/80 transition-colors hover:text-foreground">{sc.steps.length} 次工具调用<span className="ml-2 text-success">{sc.steps.filter(s=>s.state==="output-available").length} 成功</span>{sc.steps.some(s=>s.state==="output-error") && <span className="ml-1.5 text-destructive">{sc.steps.filter(s=>s.state==="output-error").length} 失败</span>}{sc.steps.some(s=>s.state==="input-available"||s.state==="input-streaming") && <span className="ml-1.5 text-primary">{sc.steps.filter(s=>s.state==="input-available"||s.state==="input-streaming").length} 进行中</span>}</summary><div className="mt-1 border-t border-border/40 pt-1"><div className="flex flex-wrap items-center gap-1 py-1.5"><span className="mr-1 text-[10.5px] text-muted-foreground/70">演示场景</span>{scenarioKeys.map(key => <button key={key} type="button" title={toolScenarios[key]!.desc} onClick={() => setToolScenario(key)} className={`rounded-full px-2 py-0.5 text-[10.5px] transition-colors ${toolScenario === key ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}>{toolScenarios[key]!.label}</button>)}</div>{sc.steps.map((step, idx) => { const st = scenario === "error" && step.state === "input-available" ? "output-error" : step.state; const err = st === "output-error" ? (step.errorText ?? "文件写入失败：请检查访问权限") : undefined; return <Tool key={`${toolScenario}-${idx}`} defaultOpen={st === "output-error" && idx === sc.steps.findIndex(s => s.state === "output-error")}><ToolHeader type="dynamic-tool" toolName={step.title} title={step.title} state={st} duration={sc.ms[idx]}/><ToolContent><ToolInput input={step.input}/><ToolOutput output={err ? undefined : step.output} errorText={err}/></ToolContent></Tool>; })}</div></details>; })()}
        {isAgent && i === active.messages.length - 1 && <div className="mt-6 border-t pt-4"><div className="mb-2 text-[11px] text-muted-foreground">交付文件 · {demoFiles.length}</div><div className="flex flex-wrap gap-x-4 gap-y-1.5">{demoFiles.slice(0, 3).map(f => { const Icon = kindStyles[f.kind].icon; return <Button key={f.id} variant="link" size="sm" className="h-7 gap-1.5 px-0 text-xs font-normal text-primary" onClick={() => { setOpenFileId(f.id); setPreview(true); }}><Icon className="size-3.5"/>{f.name}</Button>; })}<Button variant="link" size="sm" className="h-7 px-0 text-xs font-normal text-muted-foreground" onClick={() => { setOpenFileId(undefined); setPreview(true); }}>全部文件 →</Button></div></div>}{isAgent && <MessageActions className="mt-3 opacity-70"><MessageAction tooltip="复制内容" onClick={() => copyText(text)}><Copy className="size-3.5"/></MessageAction><MessageAction tooltip="重新生成" onClick={() => setNotice("界面演示中暂不支持重新生成")}><Clock3 className="size-3.5"/></MessageAction></MessageActions>}</div>; })}{(status === "submitted" || scenario === "loading") && <div className="flex items-center gap-2 pb-8 text-sm"><Mark compact/><Shimmer>正在思考...</Shimmer></div>}{scenario === "streaming" && <div className="pb-8"><div className="mb-3 flex items-center gap-2 text-xs font-semibold"><Mark compact/>{agent}<span className="font-normal text-success">正在生成</span></div><p className="stream-cursor text-sm">正在汇总已获取的信息，并生成最终分析</p></div>}{scenario === "error" && <div className="mb-5 flex items-center gap-2 rounded-md border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive"><CircleAlert className="size-4"/>执行遇到问题。查看失败步骤了解详情。</div>}</>}</ConversationContent><ConversationScrollButton/></Conversation>}
      {view === "story" && <StoryReader/>}
      {view === "trajectory" && <div className="soft-scroll min-h-0 flex-1 overflow-y-auto px-5 py-8 md:px-10"><div className="mx-auto max-w-[780px]"><h2 className="mb-1 text-sm font-semibold">执行轨迹</h2><p className="mb-6 text-[11px] text-muted-foreground">Agent 的完整决策链路、工具参数与耗时。</p><div className="space-y-4 border-l border-border pl-5">{trajectory.map((t, i) => <div key={i} className="rise relative"><span className={`absolute -left-[26px] top-1.5 size-2.5 rounded-full border-2 border-background ${t.state === "done" ? "bg-success" : t.state === "error" ? "bg-destructive" : "pulse-dot bg-warning"}`}/><div className="lift rounded-md border bg-card p-3"><div className="flex items-center gap-2"><span className="text-[12px] font-medium">{t.title}</span><span className="rounded-sm bg-muted px-1.5 py-px font-mono text-[9px] text-muted-foreground">{t.tool}</span><span className="ml-auto font-mono text-[10px] text-muted-foreground">{t.ms}</span></div><p className="mt-1.5 text-[11px] leading-6 text-muted-foreground">{t.detail}</p></div></div>)}</div></div></div>}
      {view === "files" && <div className="soft-scroll min-h-0 flex-1 overflow-y-auto px-5 py-8 md:px-10"><div className="mx-auto max-w-[900px]"><h2 className="mb-1 text-sm font-semibold">工作区文件</h2><p className="mb-6 text-[11px] text-muted-foreground">本次会话产生与修改的全部文件，点击进入右侧工作台预览。</p><div className="grid gap-3 md:grid-cols-2">{demoFiles.map(f => <FileCard key={f.id} file={f} onOpen={id => { setOpenFileId(id); setPreview(true); }}/>)}</div></div></div>}
      {view !== "story" && !(view === "chat" && isLive) && <div className="relay-composer-wrap shrink-0 px-4 pb-5 pt-3 md:px-6"><div className="relative mx-auto max-w-[800px]">{slash.popup}<PromptInput className="relay-composer rounded-xl border border-border bg-card transition-[border-color,box-shadow] duration-200 focus-within:border-primary/50" onSubmit={({ text, files }) => send(text, files)} multiple onError={e => setNotice(e.message)}><PromptInputTextarea ref={textareaRef} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={slash.onKeyDown} placeholder={mode === "agent" ? "发送消息或交给 Agent 一项任务，输入 / 唤起快捷指令..." : "输入消息，输入 / 唤起快捷指令..."} className="min-h-[64px] text-[13px] leading-6"/><PromptInputFooter className="flex-wrap gap-1 px-2 py-1.5"><PromptInputTools><AttachedFiles/><PromptInputButton tooltip="快捷指令（/）" onClick={() => { setDraft("/"); textareaRef.current?.focus(); }}><Command className="size-4"/></PromptInputButton></PromptInputTools><div className="ml-auto flex items-center gap-1"><ModelMenu model={model} onModel={changeModel} open={modelMenuOpen} onOpenChange={setModelMenuOpen}/><PromptInputSubmit status={status} onStop={stop} disabled={!draft.trim() && status === "ready"} className="size-8 rounded-md"/></div></PromptInputFooter></PromptInput></div></div>}
       </div>
        {view !== "story" && preview && <><div role="separator" aria-label="调整对话与文件区域宽度" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={100} aria-valuenow={split} tabIndex={0} onPointerDown={startResize} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resizePanes(event.clientX); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); nudgePanes(event.key === "ArrowRight" ? 1 : -1); } }} className="group relative hidden w-1.5 shrink-0 cursor-col-resize touch-none bg-border/50 transition-colors hover:bg-primary/30 focus-visible:bg-primary/30 focus-visible:outline-none lg:block"><span className="absolute inset-y-0 -left-1.5 -right-1.5"/></div><WorkspacePanel openFileId={openFileId} onOpenFile={setOpenFileId} onClose={() => setPreview(false)}/></>}</main>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="max-w-[720px] gap-0 overflow-hidden p-0"><DialogHeader className="border-b px-6 py-5"><DialogTitle className="flex items-center gap-2 text-base"><Settings2 className="size-4"/>设置</DialogTitle></DialogHeader><div className="flex min-h-[360px]"><nav className="w-40 shrink-0 border-r bg-sidebar p-3">{["外观", "模型与 API", "通用", "快捷键"].map((tab, i) => <Button key={tab} variant="ghost" onClick={() => setSettingsTab(tab)} className={`mb-1 h-9 w-full justify-start gap-2 px-2 text-xs ${settingsTab === tab ? "bg-accent font-semibold" : "text-muted-foreground"}`}>{[<Sun key="sun" className="size-3.5"/>, <Bot key="bot" className="size-3.5"/>, <SlidersHorizontal key="sliders" className="size-3.5"/>, <Keyboard key="keyboard" className="size-3.5"/>][i]}{tab}</Button>)}</nav><div className="flex-1 space-y-6 p-6">{settingsTab === "外观" && <><div><h3 className="text-sm font-semibold">外观</h3><p className="mt-1 text-xs text-muted-foreground">调整界面的显示方式</p></div><div className="flex items-center justify-between border-b pb-5"><div><p className="text-xs font-medium">深色模式</p><p className="mt-1 text-[11px] text-muted-foreground">切换到深色界面</p></div><Switch checked={dark} onCheckedChange={setDark}/></div><div><div className="mb-4 flex justify-between text-xs"><span>消息字体大小</span><span className="font-mono text-muted-foreground">{fontSize}px</span></div><Slider value={[fontSize]} min={12} max={18} step={1} onValueChange={v => setFontSize(v[0] ?? 14)}/></div></>}{settingsTab === "模型与 API" && <><div><h3 className="text-sm font-semibold">模型与 API</h3><p className="mt-1 text-xs text-muted-foreground">OpenAI 模型已接入，其他厂商将在后续阶段开放</p></div>{["OpenAI", "Anthropic", "DeepSeek", "本地模型"].map(p => <div key={p} className="flex items-center justify-between border-b pb-3"><div><p className="text-xs font-medium">{p}</p><p className="mt-1 text-[11px] text-muted-foreground">尚未配置</p></div><Button variant="outline" size="sm" onClick={() => setNotice("界面演示中暂不保存 API 配置")}>配置</Button></div>)}</>}{settingsTab === "通用" && <><div><h3 className="text-sm font-semibold">通用设置</h3><p className="mt-1 text-xs text-muted-foreground">语言与工作空间偏好</p></div><div className="flex items-center justify-between border-b pb-4 text-xs"><span>界面语言</span><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm">{language}<ChevronDown className="size-3"/></Button></DropdownMenuTrigger><DropdownMenuContent>{["简体中文", "English"].map(l => <DropdownMenuItem key={l} onClick={() => setLanguage(l)}>{l}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div><p className="text-xs text-muted-foreground">{user ? <span className="flex items-center justify-between">对话已保存到云端（{user.email}）<Button variant="outline" size="sm" onClick={signOut}>退出登录</Button></span> : "示例对话仅在本页展示。"}</p></>}{settingsTab === "快捷键" && <><h3 className="text-sm font-semibold">快捷键</h3>{[["发送消息", "Enter"], ["换行", "Shift + Enter"], ["新建对话", "⌘ K"], ["搜索对话", "⌘ F"]].map(([label, key]) => <div key={label} className="flex justify-between border-b pb-3 text-xs"><span>{label}</span><kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-[10px]">{key}</kbd></div>)}</>}</div></div></DialogContent></Dialog>
      {notice && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md border bg-popover px-4 py-2 text-xs shadow-lg">{notice}</div>}
     </div></TooltipProvider>;
}
