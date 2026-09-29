import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useNavigate } from "@tanstack/react-router";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { runJsInSandbox } from "@/lib/js-sandbox";
import { ArrowUpRight, Bot, Check, ChevronDown, ChevronLeft, ChevronRight, Columns2, GitBranch, Settings2, CircleAlert, Copy, RotateCcw, ShieldAlert, Layers, Lock, ListChecks, Target, ThumbsUp, ThumbsDown, X, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse, MessageActions, MessageAction } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Zap } from "lucide-react";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputButton, PromptInputSubmit, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput, type ToolPart } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { supabase } from "@/integrations/supabase/client";
import { AgentManager, DelegateCard, useAgents } from "./Agents";
import type { AgentConfig } from "@/lib/ai/agents.shared";
import { metaOf } from "@/lib/branches";
import { useSlashCommands, type SlashCommand } from "./slash-commands";


export const liveModelGroups = [
  { provider: "OpenAI", models: [
    { id: "openai/gpt-6-astra", label: "GPT-6 Astra" },
    { id: "openai/gpt-6-sol", label: "GPT-6 Sol" },
    { id: "openai/gpt-6-luna", label: "GPT-6 Luna" },
  ] },
] as const;
export type LiveModel = (typeof liveModelGroups)[number]["models"][number]["id"];
export const modelLabel = (id: string) => liveModelGroups.flatMap(g => g.models).find(m => m.id === id)?.label ?? id;

type Permission = "ask" | "auto" | "readonly";
const permLabels: Record<Permission, { name: string; desc: string }> = {
  ask: { name: "操作前确认", desc: "删除、发送、运行脚本前弹卡片等你批准（默认）" },
  auto: { name: "自动执行", desc: "所有操作直接执行，不再询问，请谨慎使用" },
  readonly: { name: "只读", desc: "禁止删除、发送、修改和运行脚本，只能搜索和读取" },
};

export const fmtTok = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
function Mark() { return <div className="flex size-9 shrink-0 items-center justify-center relay-agent-avatar rounded-lg bg-primary text-primary-foreground"><Zap className="size-4"/></div>; }

type Props = {
  threadId: string;
  initialMessages: UIMessage[];
  initialVersions?: Record<string, UIMessage[]>;
  model: LiveModel;
  onModel: (m: LiveModel) => void;
  fontSize: number;
  initials: string;
  onActivity: () => void;
  onNotice: (text: string) => void;
  onUsage?: (u: { total: number; context: number; replies: number }) => void;
  initialAgentId?: string | null;
  onAgent?: (id: string | null) => void;
};

const toolTitles: Record<string, string> = { web_search: "网页搜索", read_webpage: "读取网页", get_current_time: "获取当前时间", calculate: "计算", run_js: "运行 JS（浏览器沙箱）", run_skill_script: "运行 Skill 脚本（云沙箱）", delegate_to_agent: "委派 Agent", delegate_action: "子任务请求的操作", load_skill: "加载 Skill", read_skill_file: "读取 Skill 文件" };

export function LiveChat({ threadId, initialMessages, initialVersions = {}, model, onModel, fontSize, initials, onActivity, onNotice, initialAgentId = null, onAgent, onUsage }: Props) {
  const { agents, custom, reload } = useAgents();
  const navigate = useNavigate();
  const [agentId, setAgentIdState] = useState<string | null>(initialAgentId);
  const [managing, setManaging] = useState(false);
  const agentRef = useRef(agentId);
  const skillRef = useRef<string | null>(null);
  const [dropHover, setDropHover] = useState(false);
  agentRef.current = agentId;
  const setAgentId = (id: string | null) => { setAgentIdState(id); onAgent?.(id); };
  const activeAgent = agents.find(a => a.id === agentId) ?? null;
  const [draft, setDraft] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [versions, setVersions] = useState<Record<string, UIMessage[]>>(initialVersions);
  const [error, setError] = useState("");
  // 对话状态（存在 threads 表里，服务端据此改变行为）
  const [ctx, setCtx] = useState<{ permission: Permission; plan: boolean; summary: string | null; summaryUpto: string | null; goal: string | null }>({ permission: "ask", plan: false, summary: null, summaryUpto: null, goal: null });
  const [goalEdit, setGoalEdit] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, { rating: number; comment: string }>>({});
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [stats, setStats] = useState<null | { up: number; down: number; byModel: { model: string; up: number; down: number }[]; recent: { comment: string; rating: number }[]; thread: { up: number; down: number } }>(null);
  const [permMenu, setPermMenu] = useState(false);
  const [compacting, setCompacting] = useState(false);
  useEffect(() => {
    void supabase.from("threads").select("permission,plan_mode,summary,summary_upto,goal").eq("id", threadId).maybeSingle().then(({ data }) => {
      if (data) setCtx({ permission: (data.permission as Permission) ?? "ask", plan: data.plan_mode, summary: data.summary, summaryUpto: data.summary_upto, goal: data.goal });
    });
    void supabase.from("message_feedback").select("message_id,rating,comment").eq("thread_id", threadId).then(({ data }) => setRatings(Object.fromEntries((data ?? []).map(r => [r.message_id, { rating: r.rating, comment: r.comment }]))));
  }, [threadId]);
  async function saveCtx(patch: { permission?: Permission; plan_mode?: boolean }, notice: string) {
    const { error } = await supabase.from("threads").update(patch).eq("id", threadId);
    if (error) { onNotice("设置未保存，请重试"); return; }
    setCtx(c => ({ ...c, ...(patch.permission ? { permission: patch.permission } : {}), ...(patch.plan_mode !== undefined ? { plan: patch.plan_mode } : {}) }));
    onNotice(notice);
  }
  async function saveGoal(goal: string | null) {
    const { error } = await supabase.from("threads").update({ goal }).eq("id", threadId);
    if (error) { onNotice("目标未保存，请重试"); return; }
    setCtx(c => ({ ...c, goal })); setGoalEdit(null);
    onNotice(goal ? "目标已设定：AI 之后每一步都会围绕它" : "已清除对话目标");
  }
  async function rate(messageId: string, rating: number, comment?: string) {
    const prev = ratings[messageId];
    if (prev && prev.rating === rating && comment === undefined) {
      await supabase.from("message_feedback").delete().eq("message_id", messageId);
      setRatings(r => { const n = { ...r }; delete n[messageId]; return n; }); setCommentFor(null); return;
    }
    const row = { message_id: messageId, thread_id: threadId, rating, comment: comment ?? prev?.comment ?? "", model: activeAgent ? `agent:${activeAgent.name}` : model };
    const { error } = await supabase.from("message_feedback").upsert(row);
    if (error) { onNotice("评分未保存，请重试"); return; }
    setRatings(r => ({ ...r, [messageId]: { rating, comment: row.comment } }));
    if (comment !== undefined) { setCommentFor(null); onNotice("已记录你的意见"); }
    else { setCommentFor(messageId); onNotice(rating > 0 ? "已记录：有帮助" : "已记录：没帮助"); }
  }
  async function loadStats() {
    const { data } = await supabase.from("message_feedback").select("rating,comment,model,thread_id,updated_at").order("updated_at", { ascending: false }).limit(1000);
    const rows = data ?? []; const by: Record<string, { up: number; down: number }> = {};
    for (const r of rows) { const k = r.model ?? "未知"; by[k] ??= { up: 0, down: 0 }; if (r.rating > 0) by[k].up++; else by[k].down++; }
    const cnt = (xs: typeof rows) => ({ up: xs.filter(r => r.rating > 0).length, down: xs.filter(r => r.rating < 0).length });
    setStats({ ...cnt(rows), byModel: Object.entries(by).map(([model, v]) => ({ model, ...v })).sort((a, b) => b.up + b.down - a.up - a.down), recent: rows.filter(r => r.comment).slice(0, 5).map(r => ({ comment: r.comment, rating: r.rating })), thread: cnt(rows.filter(r => r.thread_id === threadId)) });
  }
  async function compact() {
    if (busy || compacting) return;
    if (messages[messages.length - 1]?.role !== "assistant") { onNotice("还没有可压缩的回复"); return; }
    setCompacting(true); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/compact", { method: "POST", headers: { "content-type": "application/json", ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}) }, body: JSON.stringify({ threadId, messages }) });
      const body = await res.json().catch(() => ({})) as { summary?: string; summaryUpto?: string; error?: string };
      if (!res.ok || !body.summary) { setError(body.error ?? "压缩失败，请稍后重试"); return; }
      setCtx(c => ({ ...c, summary: body.summary!, summaryUpto: body.summaryUpto! }));
      onNotice("已压缩：之后只发送摘要和新消息");
    } finally { setCompacting(false); }
  }
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelRef = useRef(model);
  modelRef.current = model;
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    headers: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.auth.getSession();
      return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
    },
    prepareSendMessagesRequest: ({ messages, headers, trigger, messageId }) => ({ ...(headers ? { headers } : {}), body: { threadId, model: modelRef.current, agentId: agentRef.current, messages, regeneratedFrom: trigger === "regenerate-message" ? messageId : undefined, invokeSkill: skillRef.current } }),
  }), [threadId]);
  const { messages, setMessages, sendMessage, status, stop, regenerate, addToolApprovalResponse, addToolOutput } = useChat({
    id: threadId,
    sendAutomaticallyWhen: (o) => lastAssistantMessageIsCompleteWithApprovalResponses(o) || lastAssistantMessageIsCompleteWithToolCalls(o),
    messages: initialMessages,
    transport,
    onError: (err) => {
      let text = err.message;
      try { text = JSON.parse(err.message).error ?? text; } catch { /* plain text */ }
      setError(text || "网络异常，请稍后重试。");
    },
    onFinish: () => onActivity(),
  });
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => { textareaRef.current?.focus(); }, [threadId, status]);
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id.startsWith("msg-")) return;
    const t = setTimeout(() => { const el = document.getElementById(id); if (!el) return; el.scrollIntoView({ block: "start" }); el.dataset["flash"] = "true"; setTimeout(() => { el.dataset["flash"] = "false"; }, 1600); }, 150);
    return () => clearTimeout(t);
  }, [threadId]);

  function invokeSkill(name: string, description: string) {
    if (busy) { onNotice("请等待当前回复结束"); return; }
    const task = draft.trim();
    skillRef.current = name;
    submit(`调用技能「${name}」${task ? `完成：${task}` : `（${description.slice(0, 60)}）`}。请先用 load_skill 读取说明，按手册执行并直接给出结果。`);
    setTimeout(() => { skillRef.current = null; }, 4000);
  }
  useEffect(() => {
    const h = (e: Event) => { const d = (e as CustomEvent<{ name: string; description: string }>).detail; invokeSkill(d.name, d.description); };
    window.addEventListener("relay:invoke-skill", h);
    return () => window.removeEventListener("relay:invoke-skill", h);
  });

  function submit(text: string) {
    if (!text.trim() || busy) return;
    setError("");
    sendMessage({ text: text.trim() });
    setDraft("");
    setTimeout(onActivity, 800);
  }

  // ---- 快捷指令（输入 / 唤起）----
  function exportMarkdown() {
    const lines: string[] = [`# 对话导出`, "", `导出时间：${new Date().toLocaleString("zh-CN")}`, ""];
    for (const m of messages) {
      const t = m.parts.filter(p => p.type === "text").map(p => p.text).join("\n").trim();
      if (!t) continue;
      lines.push(m.role === "user" ? `## 你` : `## ${modelLabel(model)}`, "", t, "");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relay-chat-${threadId.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    onNotice("已导出为 Markdown 文件");
  }
  const slashCommands: SlashCommand[] = [
    { name: "model", desc: "选择本次对话的模型或 Agent", run: () => { setDraft(""); setModelMenuOpen(true); } },
    { name: "export", desc: "把当前对话导出为 Markdown 文件", run: () => { setDraft(""); exportMarkdown(); } },
    { name: "new", desc: "开始一个新对话", run: () => { setDraft(""); void navigate({ to: "/" }); } },
    { name: "clear", desc: "清空输入框", run: () => setDraft("") },
    { name: "compact", desc: "把之前的对话压缩成摘要，节省上下文", run: () => { setDraft(""); void compact(); } },
    { name: "permission", desc: `调整操作权限（当前：${permLabels[ctx.permission].name}）`, run: () => { setDraft(""); setPermMenu(true); } },
    { name: "plan", desc: ctx.plan ? "关闭计划模式，恢复正常执行" : "开启计划模式：先出计划，不执行修改操作", run: () => { setDraft(""); void saveCtx({ plan_mode: !ctx.plan }, ctx.plan ? "已退出计划模式" : "计划模式已开启：AI 只制定计划，不会执行修改操作"); } },
    { name: "summarize", desc: "让 AI 总结一段内容", run: () => setDraft("请总结以下内容：") },
    { name: "research", desc: "让 AI 联网调研一个主题", run: () => setDraft("请联网调研：") },
    { name: "code", desc: "让 AI 生成代码", run: () => setDraft("请帮我写代码：") },
    { name: "goal", desc: ctx.goal ? `修改或清除目标（当前：${ctx.goal.slice(0, 16)}）` : "设定对话目标，AI 每一步都围绕它", run: () => { setDraft(""); setGoalEdit(ctx.goal ?? ""); } },
    { name: "feedback", desc: "查看回复评分统计", run: () => { setDraft(""); void loadStats(); } },
  ];
  const slash = useSlashCommands(slashCommands, draft, setDraft, textareaRef);
  const parentOf = (i: number) => messages[i - 1]?.role === "user" ? messages[i - 1]!.id : metaOf(messages[i]!).parentId;
  function versionList(i: number) {
    const m = messages[i]!; const parent = parentOf(i);
    const list = [...(parent ? versions[parent] ?? [] : []).filter(v => v.id !== m.id), m];
    const t = (v: UIMessage) => metaOf(v).createdAt ?? "\uffff";
    return list.sort((a, b) => t(a).localeCompare(t(b)));
  }
  function keepVersion(i: number) {
    const m = messages[i]; const parent = parentOf(i);
    if (!m || !parent) return;
    setVersions(prev => ({ ...prev, [parent]: [...(prev[parent] ?? []).filter(v => v.id !== m.id), { ...m, metadata: { ...metaOf(m), parentId: parent } }] }));
  }
  function regen(i: number) {
    setError(""); keepVersion(i);
    void regenerate({ messageId: messages[i]!.id });
  }
  function switchVersion(i: number, target: UIMessage) {
    if (busy) return;
    keepVersion(i);
    const now = new Date().toISOString();
    setMessages(messages.map((x, k) => (k === i ? { ...target, metadata: { ...metaOf(target), selectedAt: now } } : x)));
    void supabase.from("messages").update({ selected_at: now, parent_id: parentOf(i) ?? null }).eq("id", target.id).then(({ error }) => error && onNotice("版本切换未保存"));
  }
  const style = { "--message-size": `${fontSize}px` } as React.CSSProperties;

  useEffect(() => {
    if (!onUsage) return;
    let total = 0, context = 0, replies = 0;
    for (const m of messages) { const u = metaOf(m).usage; if (u) { total += u.total; context = u.input + u.output; replies++; } }
    onUsage({ total, context, replies });
  }, [messages]);
  const isSkillDrag = (e: React.DragEvent) => e.dataTransfer.types.includes("application/x-relay-skill");
  return <div className="relative flex min-h-0 flex-1 flex-col" onDragOver={e => { if (!isSkillDrag(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDropHover(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropHover(false); }} onDrop={e => { if (!isSkillDrag(e)) return; e.preventDefault(); setDropHover(false); try { const d = JSON.parse(e.dataTransfer.getData("application/x-relay-skill")); invokeSkill(d.name, d.description ?? ""); } catch { /* ignore */ } }}>
    {dropHover && <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/60 bg-primary/5 backdrop-blur-[1px]"><div className="rounded-lg border border-primary/40 bg-card px-4 py-2 text-[13px] font-medium text-primary shadow-lg">松开即调用该技能{draft.trim() ? "，输入框内容作为任务" : ""}</div></div>}
    <Conversation className="relay-conversation soft-scroll"><ConversationContent className="relay-transcript mx-auto w-full max-w-[860px] gap-0 px-5 pb-10 pt-9 md:px-9">
      {messages.length === 0 ? <ConversationEmptyState className="min-h-[45vh]"><div className="flex flex-col items-center gap-4"><Mark/><h1 className="font-display text-xl font-semibold">从一个想法开始</h1><p className="text-sm text-muted-foreground">对话会自动保存，刷新或换设备后仍可继续。</p><div className="mt-3 flex flex-wrap justify-center gap-2">{["整理一份竞品分析的框架", "解释什么是 MCP 协议", "帮我规划本周工作"].map(v => <Button key={v} variant="outline" size="sm" className="lift text-xs shadow-none" onClick={() => submit(v)}>{v}<ArrowUpRight className="size-3"/></Button>)}</div></div></ConversationEmptyState> : messages.map((m, i) => {
        const isAgent = m.role === "assistant";
        const text = m.parts.filter(p => p.type === "text").map(p => p.text).join("\n");
        const streamingThis = busy && i === messages.length - 1 && isAgent;
         return <div key={m.id} id={`msg-${m.id}`} className="relay-message mb-8 flex gap-4 scroll-mt-6 rounded-lg transition-colors duration-700 data-[flash=true]:bg-primary/5">{isAgent ? <Mark/> : <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card text-[11px] font-semibold text-muted-foreground">{initials}</div>}<div className="min-w-0 flex-1 pt-1.5">
           {isAgent && <div className="mb-1 text-[11px] font-medium text-muted-foreground">{activeAgent?.name ?? modelLabel(model)}</div>}
           {m.parts.map((p, idx) => {
            if (p.type === "reasoning" && p.text) return <Reasoning key={idx} className="mb-2 w-full" isStreaming={streamingThis && idx === m.parts.length - 1}><ReasoningTrigger className="text-[11px]"/><ReasoningContent className="text-[12px] text-muted-foreground">{p.text}</ReasoningContent></Reasoning>;
            if (p.type.startsWith("tool-") || p.type === "dynamic-tool") {
              const t = p as ToolPart;
              if (t.type === "tool-delegate_to_agent") return <DelegateCard key={idx} task={(t.input as { task?: string } | undefined)?.task} output={t.state === "output-available" ? t.output as never : undefined} preliminary={t.state === "output-available" && !!(t as { preliminary?: boolean }).preliminary} errorText={t.state === "output-error" ? t.errorText : undefined}/>;
              if (t.type === "tool-delegate_action" && (t.state === "output-available" || t.state === "output-error")) return <DelegateCard key={idx} task="已批准，继续执行子任务" output={t.state === "output-available" ? t.output as never : undefined} preliminary={t.state === "output-available" && !!(t as { preliminary?: boolean }).preliminary} errorText={t.state === "output-error" ? t.errorText : undefined}/>;
              const runJsPending = t.type === "tool-run_js" && t.state === "input-available";
              return <Tool key={idx} className="mb-1" defaultOpen={t.state === "output-error" || t.state === "approval-requested" || runJsPending}>{t.type === "dynamic-tool" ? <ToolHeader type={t.type} state={t.state} toolName={t.toolName} title={toolTitles[t.toolName] ?? t.toolName.replace(/^m\d+_/, "MCP · ")}/> : <ToolHeader type={t.type} state={t.state} title={toolTitles[t.type.slice(5)] ?? t.type.slice(5).replace(/^m\d+_/, "MCP · ")}/>}<ToolContent><ToolInput input={t.input}/>{runJsPending && <ApprovalBar reason="将在你的浏览器隔离沙箱中运行这段 JavaScript，需要你确认" onRespond={async (approved) => {
                const toolCallId = (t as { toolCallId: string }).toolCallId;
                if (!approved) { void addToolOutput({ tool: "run_js" as never, toolCallId, state: "output-error", errorText: "用户拒绝运行" }); return; }
                const inp = t.input as { code?: string; input?: unknown } | undefined;
                const r = await runJsInSandbox(inp?.code ?? "", inp?.input);
                if (r.ok) void addToolOutput({ tool: "run_js" as never, toolCallId, output: r as never });
                else void addToolOutput({ tool: "run_js" as never, toolCallId, state: "output-error", errorText: `${r.error}${r.logs.length ? `\n日志：\n${r.logs.join("\n")}` : ""}` });
              }}/>}{t.state === "approval-requested" && <ApprovalBar reason={t.approval.requestReason} onRespond={(approved) => addToolApprovalResponse(approved ? { id: t.approval.id, approved } : { id: t.approval.id, approved, reason: "用户拒绝执行" })}/>}<ToolOutput output={t.state === "output-available" ? t.output : undefined} errorText={t.state === "output-error" ? t.errorText : undefined}/></ToolContent></Tool>;
            }
            return null;
          })}
           {text && <Message from="assistant" className="max-w-full"><MessageContent style={style} className={isAgent ? "w-full text-[length:var(--message-size)] leading-[1.8]" : "relay-user-bubble w-fit max-w-full rounded-xl px-4 py-3 text-[length:var(--message-size)] leading-[1.75]"}><MessageResponse>{text}</MessageResponse></MessageContent></Message>}
          {m.id === ctx.summaryUpto && ctx.summary && <details className="group mt-6 text-[11px] text-muted-foreground"><summary className="flex cursor-pointer list-none items-center gap-3"><span className="h-px flex-1 bg-border"/><Layers className="size-3"/>以上内容已压缩为摘要，AI 只会看到摘要<span className="underline decoration-dotted">查看</span><span className="h-px flex-1 bg-border"/></summary><div className="mt-2 rounded-md border bg-muted/30 px-3 py-2 text-[12px] leading-6 text-foreground"><MessageResponse>{ctx.summary}</MessageResponse></div></details>}
          {isAgent && text && !streamingThis && <MessageActions className="mt-3 opacity-70">{metaOf(m).usage && <span title={`输入 ${metaOf(m).usage!.input.toLocaleString()} · 输出 ${metaOf(m).usage!.output.toLocaleString()}${metaOf(m).usage!.reasoning ? `（含思考 ${metaOf(m).usage!.reasoning!.toLocaleString()}）` : ""}`} className="mr-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{fmtTok(metaOf(m).usage!.total)} tokens</span>}<MessageAction tooltip="复制内容" onClick={() => { navigator.clipboard.writeText(text); onNotice("已复制到剪贴板"); }}><Copy className="size-3.5"/></MessageAction><MessageAction tooltip="有帮助" onClick={() => void rate(m.id, 1)} className={ratings[m.id]?.rating === 1 ? "text-primary" : ""}><ThumbsUp className={`size-3.5 ${ratings[m.id]?.rating === 1 ? "fill-current" : ""}`}/></MessageAction><MessageAction tooltip="没帮助" onClick={() => void rate(m.id, -1)} className={ratings[m.id]?.rating === -1 ? "text-destructive" : ""}><ThumbsDown className={`size-3.5 ${ratings[m.id]?.rating === -1 ? "fill-current" : ""}`}/></MessageAction>{i === messages.length - 1 && <MessageAction tooltip="重新生成（保留当前版本）" onClick={() => regen(i)}><RotateCcw className="size-3.5"/></MessageAction>}<VersionSwitcher list={versionList(i)} current={m.id} disabled={busy} onPick={v => switchVersion(i, v)}/>{versionList(i).length > 1 && <MessageAction tooltip="并排对比所有版本" onClick={() => navigate({ to: "/compare/$threadId", params: { threadId } })}><Columns2 className="size-3.5"/></MessageAction>}</MessageActions>}
          {commentFor === m.id && ratings[m.id] && <form className="mt-2 flex items-center gap-2" onSubmit={e => { e.preventDefault(); const v = new FormData(e.currentTarget).get("c"); void rate(m.id, ratings[m.id]!.rating, String(v ?? "").trim()); }}><input name="c" autoFocus defaultValue={ratings[m.id]!.comment} placeholder={ratings[m.id]!.rating > 0 ? "哪里好？（可选）" : "哪里不好？（可选）"} className="h-7 flex-1 rounded-md border bg-transparent px-2 text-[12px] outline-none focus:border-primary/50"/><Button type="submit" size="sm" variant="outline" className="h-7 text-[11px] shadow-none">提交</Button><button type="button" onClick={() => setCommentFor(null)} className="text-muted-foreground hover:text-foreground"><X className="size-3.5"/></button></form>}
        </div></div>;
      })}
      {status === "submitted" && <div className="flex items-center gap-2 pb-8 text-sm"><Mark/><Shimmer>正在思考...</Shimmer></div>}
      {error && <div className="mb-5 flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive"><CircleAlert className="mt-px size-4 shrink-0"/><span className="flex-1">{error}</span></div>}
    </ConversationContent><ConversationScrollButton/></Conversation>
     <div className="relay-composer-wrap shrink-0 px-4 pb-5 pt-2 md:px-8"><div className="relative mx-auto max-w-[860px]">
      {slash.popup}
      {goalEdit !== null && <form className="mb-2 flex items-center gap-2 rounded-lg border bg-card px-3 py-2" onSubmit={e => { e.preventDefault(); const v = goalEdit.trim(); void saveGoal(v || null); }}><Target className="size-3.5 shrink-0 text-primary"/><input autoFocus value={goalEdit} onChange={e => setGoalEdit(e.target.value)} onKeyDown={e => { if (e.key === "Escape") setGoalEdit(null); }} placeholder="这次对话要达成什么？例如：定出 10 月团建的最终方案和预算" className="h-7 flex-1 bg-transparent text-[12px] outline-none"/>{ctx.goal && <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => void saveGoal(null)}>清除</Button>}<Button type="submit" size="sm" className="h-7 text-[11px]">保存</Button><button type="button" onClick={() => setGoalEdit(null)} className="text-muted-foreground hover:text-foreground"><X className="size-3.5"/></button></form>}
      {stats && <div className="mb-2 rounded-lg border bg-card p-3 text-[12px]"><div className="mb-2 flex items-center gap-2 font-medium"><BarChart3 className="size-3.5 text-primary"/>回复评分统计<button type="button" onClick={() => setStats(null)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="size-3.5"/></button></div>
        {stats.up + stats.down === 0 ? <p className="text-muted-foreground">还没有评分。在回复下方点 👍 / 👎 即可评分。</p> : <>
        <div className="mb-3 grid grid-cols-3 gap-2">{[["全部评分", `${stats.up + stats.down}`], ["满意率", `${Math.round(stats.up / (stats.up + stats.down) * 100)}%`], ["本对话", `👍 ${stats.thread.up} · 👎 ${stats.thread.down}`]].map(([k, v]) => <div key={k} className="rounded-md bg-muted/40 px-2.5 py-2"><div className="text-[10px] text-muted-foreground">{k}</div><div className="font-display text-sm font-semibold">{v}</div></div>)}</div>
        <div className="space-y-1.5">{stats.byModel.map(r => { const n = r.up + r.down; return <div key={r.model} className="flex items-center gap-2"><span className="w-32 truncate text-muted-foreground">{r.model.startsWith("agent:") ? `Agent · ${r.model.slice(6)}` : modelLabel(r.model)}</span><div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-destructive/30"><div className="bg-primary" style={{ width: `${r.up / n * 100}%` }}/></div><span className="w-16 text-right tabular-nums text-muted-foreground">{r.up}/{n}</span></div>; })}</div>
        {stats.recent.length > 0 && <div className="mt-3 border-t pt-2"><div className="mb-1 text-[10px] text-muted-foreground">最近的意见</div>{stats.recent.map((r, i) => <div key={i} className="truncate py-0.5">{r.rating > 0 ? "👍" : "👎"} {r.comment}</div>)}</div>}</>}
      </div>}
       <PromptInput className="relay-composer overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] duration-200 focus-within:border-primary/50" onSubmit={({ text }) => submit(text)}>
        <div className="flex w-full min-h-10 flex-wrap items-center gap-1 border-b px-3 py-1.5">
            <DropdownMenu open={permMenu} onOpenChange={setPermMenu}><DropdownMenuTrigger asChild><button type="button" className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] hover:bg-accent ${ctx.permission === "ask" ? "text-muted-foreground" : ctx.permission === "auto" ? "text-destructive" : "text-primary"}`}>{ctx.permission === "readonly" ? <Lock className="size-3"/> : <ShieldAlert className="size-3"/>}{permLabels[ctx.permission].name}</button></DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">{(Object.keys(permLabels) as Permission[]).map(k => <DropdownMenuItem key={k} onSelect={() => void saveCtx({ permission: k }, `权限已切换为「${permLabels[k].name}」`)} className="flex items-start gap-2 text-xs"><Check className={`mt-0.5 size-3.5 ${ctx.permission === k ? "" : "opacity-0"}`}/><div><div className="font-medium">{permLabels[k].name}</div><div className="text-[11px] text-muted-foreground">{permLabels[k].desc}</div></div></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
            {ctx.plan && <button type="button" onClick={() => void saveCtx({ plan_mode: false }, "已退出计划模式")} className="flex h-7 items-center gap-1 rounded-md bg-primary/10 px-2 text-[11px] text-primary hover:bg-primary/15" title="点击退出计划模式"><ListChecks className="size-3"/>计划模式</button>}
            {ctx.goal && <button type="button" onClick={() => setGoalEdit(ctx.goal)} className="flex h-7 max-w-[220px] items-center gap-1 rounded-md bg-primary/10 px-2 text-[11px] text-primary hover:bg-primary/15" title={`目标：${ctx.goal}（点击修改）`}><Target className="size-3 shrink-0"/><span className="truncate">{ctx.goal}</span></button>}
            {compacting && <span className="flex h-7 items-center px-2 text-[11px]"><Shimmer>正在压缩对话...</Shimmer></span>}
          </div><PromptInputTextarea ref={textareaRef} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={slash.onKeyDown} placeholder="给 Relay 发消息，输入 / 唤起快捷指令..." className="min-h-[88px] px-4 pt-3.5 text-[14px] leading-6"/>
        <PromptInputFooter className="gap-2 px-3 pb-3 pt-0"><span className="pl-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">Enter 发送 · Shift+Enter 换行</span><div className="ml-auto flex items-center gap-1">
            <ModelMenu model={model} onModel={m => { setAgentId(null); onModel(m); }} agents={agents} agentId={agentId} onAgent={setAgentId} onManage={() => navigate({ to: "/studio/agents" })} open={modelMenuOpen} onOpenChange={setModelMenuOpen}/>
             <PromptInputSubmit status={status} onStop={stop} disabled={!draft.trim() && !busy} className="size-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"/>
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div></div>
    <AgentManager open={managing} onOpenChange={setManaging} custom={custom} reload={reload} models={liveModelGroups.flatMap(g => g.models.map(m => ({ id: m.id, label: m.label })))}/>
  </div>;
}

export function ModelMenu({ model, onModel, agents, agentId, onAgent, onManage, open, onOpenChange }: { model: string; onModel: (m: LiveModel) => void; agents?: AgentConfig[]; agentId?: string | null; onAgent?: (id: string) => void; onManage?: () => void; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const active = agents?.find(a => a.id === agentId);
  const head = (t: string) => <div className="px-2 pt-2.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">{t}</div>;
  return <DropdownMenu {...(open === undefined ? {} : { open, onOpenChange })}><DropdownMenuTrigger asChild><PromptInputButton tooltip="切换模型或 Agent" className="max-w-[160px] gap-1 truncate px-2 text-[11px] text-muted-foreground">{active && <Bot className="size-3 shrink-0"/>}{active?.name ?? modelLabel(model)}<ChevronDown className="size-3 shrink-0"/></PromptInputButton></DropdownMenuTrigger><DropdownMenuContent align="end" className="max-h-[70vh] min-w-[240px] overflow-y-auto">
    {liveModelGroups.map(g => <div key={g.provider}>{head(g.provider)}{g.models.map(m => <DropdownMenuItem key={m.id} onClick={() => onModel(m.id)}>{m.label}{!active && model === m.id && <Check className="ml-auto size-3.5"/>}</DropdownMenuItem>)}</div>)}
  </DropdownMenuContent></DropdownMenu>;
}

function VersionSwitcher({ list, current, disabled, onPick }: { list: UIMessage[]; current: string; disabled: boolean; onPick: (m: UIMessage) => void }) {
  if (list.length < 2) return null;
  const idx = Math.max(0, list.findIndex(v => v.id === current));
  const meta = metaOf(list[idx]!);
  const when = meta.createdAt ? new Date(meta.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "";
  return <div className="ml-1 flex items-center gap-0.5 text-[11px] text-muted-foreground" aria-label="回复版本">
    <Button variant="ghost" size="icon" className="size-6" disabled={disabled || idx === 0} aria-label="上一版" onClick={() => onPick(list[idx - 1]!)}><ChevronLeft className="size-3.5"/></Button>
    <span className="tabular-nums">{idx + 1} / {list.length}</span>
    <Button variant="ghost" size="icon" className="size-6" disabled={disabled || idx === list.length - 1} aria-label="下一版" onClick={() => onPick(list[idx + 1]!)}><ChevronRight className="size-3.5"/></Button>
    {meta.regeneratedFrom && <span className="ml-1 flex items-center gap-1" title="该版本由重新生成产生"><GitBranch className="size-3"/>重新生成{when && ` · ${when}`}</span>}
  </div>;
}

function ApprovalBar({ reason, onRespond }: { reason?: string | undefined; onRespond: (approved: boolean) => void }) {
  const [done, setDone] = useState(false);
  const respond = (ok: boolean) => { if (done) return; setDone(true); onRespond(ok); };
  return (
    <div className="mx-3 mb-3 flex flex-wrap items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5">
      <ShieldAlert className="size-4 shrink-0 text-primary"/>
      <p className="min-w-0 flex-1 text-[13px] text-foreground">{reason ?? "这个操作会修改外部数据，需要你确认"}<span className="block text-xs text-muted-foreground">请核对上方参数，确认后才会执行。</span></p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={done} onClick={() => respond(false)}>拒绝</Button>
        <Button size="sm" disabled={done} onClick={() => respond(true)}>批准执行</Button>
      </div>
    </div>
  );
}
