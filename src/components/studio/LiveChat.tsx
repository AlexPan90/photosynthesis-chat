import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUpRight, Check, ChevronDown, CircleAlert, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse, MessageActions, MessageAction } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputButton, PromptInputSubmit, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { supabase } from "@/integrations/supabase/client";

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
  model: LiveModel;
  onModel: (m: LiveModel) => void;
  fontSize: number;
  initials: string;
  onActivity: () => void;
  onNotice: (text: string) => void;
};

export function LiveChat({ threadId, initialMessages, model, onModel, fontSize, initials, onActivity, onNotice }: Props) {
  const [draft, setDraft] = useState("");
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
    prepareSendMessagesRequest: ({ messages, headers }) => ({ headers, body: { threadId, model: modelRef.current, messages } }),
  }), [threadId]);
  const { messages, sendMessage, status, stop, regenerate } = useChat({
    id: threadId,
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

  function submit(text: string) {
    if (!text.trim() || busy) return;
    setError("");
    sendMessage({ text: text.trim() });
    setDraft("");
    setTimeout(onActivity, 800);
  }
  const style = { "--message-size": `${fontSize}px` } as React.CSSProperties;

  return <>
    <Conversation className="soft-scroll"><ConversationContent className="mx-auto w-full max-w-[760px] gap-0 px-5 pb-8 pt-9 md:px-10">
      {messages.length === 0 ? <ConversationEmptyState className="min-h-[45vh]"><div className="flex flex-col items-center gap-4"><Mark/><h1 className="font-display text-xl font-semibold">从一个想法开始</h1><p className="text-sm text-muted-foreground">对话会自动保存，刷新或换设备后仍可继续。</p><div className="mt-3 flex flex-wrap justify-center gap-2">{["整理一份竞品分析的框架", "解释什么是 MCP 协议", "帮我规划本周工作"].map(v => <Button key={v} variant="outline" size="sm" className="lift text-xs shadow-none" onClick={() => submit(v)}>{v}<ArrowUpRight className="size-3"/></Button>)}</div></div></ConversationEmptyState> : messages.map((m, i) => {
        const isAgent = m.role === "assistant";
        const text = m.parts.filter(p => p.type === "text").map(p => p.text).join("\n");
        const streamingThis = busy && i === messages.length - 1 && isAgent;
        return <div key={m.id} className="mb-7">
          <div className={`mb-2 flex items-center gap-2 text-[11px] ${isAgent ? "" : "justify-end"}`}>{isAgent ? <><Mark/><span className="font-semibold">{modelLabel(model)}</span></> : <><span className="font-semibold">你</span><div className="flex size-6 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">{initials}</div></>}</div>
          {m.parts.map((p, idx) => p.type === "reasoning" && p.text ? <Reasoning key={idx} className="mb-2 w-full" isStreaming={streamingThis && idx === m.parts.length - 1}><ReasoningTrigger className="text-[11px]"/><ReasoningContent className="text-[12px] text-muted-foreground">{p.text}</ReasoningContent></Reasoning> : null)}
          {text && <Message from={m.role} className="max-w-full"><MessageContent style={style} className={isAgent ? "w-full text-[length:var(--message-size)] leading-[1.85]" : "max-w-[86%] rounded-xl rounded-tr-sm bg-secondary px-4 py-3 text-[length:var(--message-size)] leading-[1.75]"}><MessageResponse>{text}</MessageResponse></MessageContent></Message>}
          {isAgent && text && !streamingThis && <MessageActions className="mt-3 opacity-70"><MessageAction tooltip="复制内容" onClick={() => { navigator.clipboard.writeText(text); onNotice("已复制到剪贴板"); }}><Copy className="size-3.5"/></MessageAction>{i === messages.length - 1 && <MessageAction tooltip="重新生成" onClick={() => { setError(""); regenerate(); }}><RotateCcw className="size-3.5"/></MessageAction>}</MessageActions>}
        </div>;
      })}
      {status === "submitted" && <div className="flex items-center gap-2 pb-8 text-sm"><Mark/><Shimmer>正在思考...</Shimmer></div>}
      {error && <div className="mb-5 flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive"><CircleAlert className="mt-px size-4 shrink-0"/><span className="flex-1">{error}</span></div>}
    </ConversationContent><ConversationScrollButton/></Conversation>
    <div className="shrink-0 px-4 pb-4 pt-2 md:px-5"><div className="mx-auto max-w-[760px]">
      <PromptInput className="rounded-lg border bg-card shadow-[0_3px_16px_-12px_var(--color-foreground)] transition-[border-color,box-shadow] duration-150 focus-within:border-primary/50" onSubmit={({ text }) => submit(text)}>
        <PromptInputTextarea ref={textareaRef} value={draft} onChange={e => setDraft(e.target.value)} placeholder="发送消息..." className="min-h-[58px] text-[13px] leading-6"/>
        <PromptInputFooter className="flex-wrap gap-1 px-2 py-1.5"><PromptInputTools/>
          <div className="ml-auto flex items-center gap-1">
            <ModelMenu model={model} onModel={onModel}/>
            <PromptInputSubmit status={status} onStop={stop} disabled={!draft.trim() && !busy} className="size-8 rounded-full"/>
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div></div>
  </>;
}

export function ModelMenu({ model, onModel }: { model: string; onModel: (m: LiveModel) => void }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><PromptInputButton tooltip="切换模型" className="max-w-[150px] gap-1 truncate px-2 text-[11px] text-muted-foreground">{modelLabel(model)}<ChevronDown className="size-3 shrink-0"/></PromptInputButton></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-[220px]">
    {liveModelGroups.map(g => <div key={g.provider}><div className="px-2 pt-2.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">{g.provider}</div>{g.models.map(m => <DropdownMenuItem key={m.id} onClick={() => onModel(m.id)}>{m.label}{model === m.id && <Check className="ml-auto size-3.5"/>}</DropdownMenuItem>)}</div>)}
    {upcomingProviders.map(p => <div key={p}><div className="px-2 pt-2.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">{p}</div><DropdownMenuItem disabled className="text-[11px]">即将接入</DropdownMenuItem></div>)}
  </DropdownMenuContent></DropdownMenu>;
}
