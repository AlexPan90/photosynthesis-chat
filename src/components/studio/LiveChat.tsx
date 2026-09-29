import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useNavigate } from "@tanstack/react-router";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { runJsInSandbox } from "@/lib/js-sandbox";
import { ArrowUpRight, Bot, Check, ChevronDown, ChevronLeft, ChevronRight, Columns2, GitBranch, Settings2, CircleAlert, Copy, RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse, MessageActions, MessageAction } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
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
export const upcomingProviders = ["Anthropic", "DeepSeek", "本地模型"];
export type LiveModel = (typeof liveModelGroups)[number]["models"][number]["id"];
export const modelLabel = (id: string) => liveModelGroups.flatMap(g => g.models).find(m => m.id === id)?.label ?? id;

function Mark() { return <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><span className="font-mono text-base font-semibold leading-none">R<span className="text-success">.</span></span></div>; }

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
  initialAgentId?: string | null;
  onAgent?: (id: string | null) => void;
};

const toolTitles: Record<string, string> = { web_search: "网页搜索", read_webpage: "读取网页", get_current_time: "获取当前时间", calculate: "计算", run_js: "运行 JS（浏览器沙箱）", run_skill_script: "运行 Skill 脚本（云沙箱）", delegate_to_agent: "委派 Agent", delegate_action: "子任务请求的操作", load_skill: "加载 Skill", read_skill_file: "读取 Skill 文件" };

export function LiveChat({ threadId, initialMessages, initialVersions = {}, model, onModel, fontSize, initials, onActivity, onNotice, initialAgentId = null, onAgent }: Props) {
  const { agents, custom, reload } = useAgents();
  const navigate = useNavigate();
  const [agentId, setAgentIdState] = useState<string | null>(initialAgentId);
  const [managing, setManaging] = useState(false);
  const agentRef = useRef(agentId);
  agentRef.current = agentId;
  const setAgentId = (id: string | null) => { setAgentIdState(id); onAgent?.(id); };
  const activeAgent = agents.find(a => a.id === agentId) ?? null;
  const [draft, setDraft] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [versions, setVersions] = useState<Record<string, UIMessage[]>>(initialVersions);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelRef = useRef(model);
  modelRef.current = model;
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    headers: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.auth.getSession();
      return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
    },
    prepareSendMessagesRequest: ({ messages, headers, trigger, messageId }) => ({ ...(headers ? { headers } : {}), body: { threadId, model: modelRef.current, agentId: agentRef.current, messages, regeneratedFrom: trigger === "regenerate-message" ? messageId : undefined } }),
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
    { name: "summarize", desc: "让 AI 总结一段内容", run: () => setDraft("请总结以下内容：") },
    { name: "research", desc: "让 AI 联网调研一个主题", run: () => setDraft("请联网调研：") },
    { name: "code", desc: "让 AI 生成代码", run: () => setDraft("请帮我写代码：") },
    { name: "feedback", desc: "记录对这次对话的反馈", run: () => setDraft("反馈：") },
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

  return <>
    <Conversation className="soft-scroll"><ConversationContent className="mx-auto w-full max-w-[760px] gap-0 px-5 pb-8 pt-9 md:px-10">
      {messages.length === 0 ? <ConversationEmptyState className="min-h-[45vh]"><div className="flex flex-col items-center gap-4"><Mark/><h1 className="font-display text-xl font-semibold">从一个想法开始</h1><p className="text-sm text-muted-foreground">对话会自动保存，刷新或换设备后仍可继续。</p><div className="mt-3 flex flex-wrap justify-center gap-2">{["整理一份竞品分析的框架", "解释什么是 MCP 协议", "帮我规划本周工作"].map(v => <Button key={v} variant="outline" size="sm" className="lift text-xs shadow-none" onClick={() => submit(v)}>{v}<ArrowUpRight className="size-3"/></Button>)}</div></div></ConversationEmptyState> : messages.map((m, i) => {
        const isAgent = m.role === "assistant";
        const text = m.parts.filter(p => p.type === "text").map(p => p.text).join("\n");
        const streamingThis = busy && i === messages.length - 1 && isAgent;
        return <div key={m.id} id={`msg-${m.id}`} className="mb-7 scroll-mt-6 rounded-lg transition-colors duration-700 data-[flash=true]:bg-primary/5">
          <div className={`mb-2 flex items-center gap-2 text-[11px] ${isAgent ? "" : "justify-end"}`}>{isAgent ? <><Mark/><span className="font-semibold">{activeAgent?.name ?? modelLabel(model)}</span></> : <><span className="font-semibold">你</span><div className="flex size-6 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">{initials}</div></>}</div>
          {m.parts.map((p, idx) => {
            if (p.type === "reasoning" && p.text) return <Reasoning key={idx} className="mb-2 w-full" isStreaming={streamingThis && idx === m.parts.length - 1}><ReasoningTrigger className="text-[11px]"/><ReasoningContent className="text-[12px] text-muted-foreground">{p.text}</ReasoningContent></Reasoning>;
            if (p.type.startsWith("tool-") || p.type === "dynamic-tool") {
              const t = p as ToolPart;
              if (t.type === "tool-delegate_to_agent") return <DelegateCard key={idx} task={(t.input as { task?: string } | undefined)?.task} output={t.state === "output-available" ? t.output as never : undefined} preliminary={t.state === "output-available" && !!(t as { preliminary?: boolean }).preliminary} errorText={t.state === "output-error" ? t.errorText : undefined}/>;
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
          {text && <Message from={m.role} className="max-w-full"><MessageContent style={style} className={isAgent ? "w-full text-[length:var(--message-size)] leading-[1.85]" : "max-w-[86%] rounded-xl rounded-tr-sm bg-secondary px-4 py-3 text-[length:var(--message-size)] leading-[1.75]"}><MessageResponse>{text}</MessageResponse></MessageContent></Message>}
          {isAgent && text && !streamingThis && <MessageActions className="mt-3 opacity-70"><MessageAction tooltip="复制内容" onClick={() => { navigator.clipboard.writeText(text); onNotice("已复制到剪贴板"); }}><Copy className="size-3.5"/></MessageAction>{i === messages.length - 1 && <MessageAction tooltip="重新生成（保留当前版本）" onClick={() => regen(i)}><RotateCcw className="size-3.5"/></MessageAction>}<VersionSwitcher list={versionList(i)} current={m.id} disabled={busy} onPick={v => switchVersion(i, v)}/>{versionList(i).length > 1 && <MessageAction tooltip="并排对比所有版本" onClick={() => navigate({ to: "/compare/$threadId", params: { threadId } })}><Columns2 className="size-3.5"/></MessageAction>}</MessageActions>}
        </div>;
      })}
      {status === "submitted" && <div className="flex items-center gap-2 pb-8 text-sm"><Mark/><Shimmer>正在思考...</Shimmer></div>}
      {error && <div className="mb-5 flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive"><CircleAlert className="mt-px size-4 shrink-0"/><span className="flex-1">{error}</span></div>}
    </ConversationContent><ConversationScrollButton/></Conversation>
    <div className="shrink-0 px-4 pb-4 pt-2 md:px-5"><div className="relative mx-auto max-w-[760px]">
      {slash.popup}
      <PromptInput className="rounded-lg border bg-card shadow-[0_3px_16px_-12px_var(--color-foreground)] transition-[border-color,box-shadow] duration-150 focus-within:border-primary/50" onSubmit={({ text }) => submit(text)}>
        <PromptInputTextarea ref={textareaRef} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={slash.onKeyDown} placeholder="发送消息，输入 / 唤起快捷指令..." className="min-h-[58px] text-[13px] leading-6"/>
        <PromptInputFooter className="flex-wrap gap-1 px-2 py-1.5"><PromptInputTools/>
          <div className="ml-auto flex items-center gap-1">
            <ModelMenu model={model} onModel={m => { setAgentId(null); onModel(m); }} agents={agents} agentId={agentId} onAgent={setAgentId} onManage={() => navigate({ to: "/studio/agents" })} open={modelMenuOpen} onOpenChange={setModelMenuOpen}/>
            <PromptInputSubmit status={status} onStop={stop} disabled={!draft.trim() && !busy} className="size-8 rounded-full"/>
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div></div>
    <AgentManager open={managing} onOpenChange={setManaging} custom={custom} reload={reload} models={liveModelGroups.flatMap(g => g.models.map(m => ({ id: m.id, label: m.label })))}/>
  </>;
}

export function ModelMenu({ model, onModel, agents, agentId, onAgent, onManage, open, onOpenChange }: { model: string; onModel: (m: LiveModel) => void; agents?: AgentConfig[]; agentId?: string | null; onAgent?: (id: string) => void; onManage?: () => void; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const active = agents?.find(a => a.id === agentId);
  const head = (t: string) => <div className="px-2 pt-2.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">{t}</div>;
  return <DropdownMenu {...(open === undefined ? {} : { open, onOpenChange })}><DropdownMenuTrigger asChild><PromptInputButton tooltip="切换模型或 Agent" className="max-w-[160px] gap-1 truncate px-2 text-[11px] text-muted-foreground">{active && <Bot className="size-3 shrink-0"/>}{active?.name ?? modelLabel(model)}<ChevronDown className="size-3 shrink-0"/></PromptInputButton></DropdownMenuTrigger><DropdownMenuContent align="end" className="max-h-[70vh] min-w-[240px] overflow-y-auto">
    {agents && <>{head("Agent")}{agents.map(a => <DropdownMenuItem key={a.id} onClick={() => onAgent?.(a.id)} className="items-start"><Bot className="mt-0.5 size-3.5"/><span className="min-w-0 flex-1"><span className="block">{a.name}</span><span className="block truncate text-[10.5px] text-muted-foreground">{a.description}</span></span>{agentId === a.id && <Check className="size-3.5"/>}</DropdownMenuItem>)}<DropdownMenuItem onClick={onManage} className="text-[11px] text-muted-foreground"><Settings2 className="size-3.5"/>管理 Agent…</DropdownMenuItem></>}
    {liveModelGroups.map(g => <div key={g.provider}>{head(g.provider)}{g.models.map(m => <DropdownMenuItem key={m.id} onClick={() => onModel(m.id)}>{m.label}{!active && model === m.id && <Check className="ml-auto size-3.5"/>}</DropdownMenuItem>)}</div>)}
    {upcomingProviders.map(p => <div key={p}>{head(p)}<DropdownMenuItem disabled className="text-[11px]">即将接入</DropdownMenuItem></div>)}
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
