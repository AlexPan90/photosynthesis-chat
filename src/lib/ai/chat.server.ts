import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { chatTools } from "./tools.server";
import { z } from "zod";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server";

export const CHAT_MODELS = ["openai/gpt-6-astra", "openai/gpt-6-sol", "openai/gpt-6-luna"] as const;
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const SYSTEM = "你是 Relay Studio 中的 AI 助手。默认使用简体中文回答，表达简洁清晰，适当使用 Markdown（标题、列表、表格、代码块）。你可以调用工具：read_webpage（读取网页）、get_current_time（当前时间）、calculate（精确计算）。需要时主动使用，然后基于结果回答。";

const bodySchema = z.object({
  threadId: z.string().uuid(),
  model: z.enum(CHAT_MODELS).default("openai/gpt-6-astra"),
  messages: z.array(z.any()).min(1).max(200),
});

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json" } });

function userClient(token: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export async function handleChat(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || token.split(".").length !== 3) return json(401, "请先登录");
  const supabase = userClient(token);
  const { data: claims, error: authError } = await supabase.auth.getClaims(token);
  const userId = claims?.claims?.sub;
  if (authError || !userId) return json(401, "登录已失效，请重新登录");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, "请求格式不正确");
  const { threadId, model } = parsed.data;
  const messages = parsed.data.messages as UIMessage[];

  const { data: thread } = await supabase.from("threads").select("id,title").eq("id", threadId).maybeSingle();
  if (!thread) return json(404, "对话不存在");

  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    const { error } = await supabase.from("messages").upsert({
      id: last.id, thread_id: threadId, user_id: userId, role: "user", parts: last.parts as unknown as Json,
    });
    if (error) return json(500, "消息保存失败");
    const firstText = last.parts.find(p => p.type === "text");
    const patch: { updated_at: string; model: string; title?: string } = { updated_at: new Date().toISOString(), model };
    if (thread.title === "新对话" && firstText && "text" in firstText) patch.title = firstText.text.trim().slice(0, 24) || "新对话";
    await supabase.from("threads").update(patch).eq("id", threadId);
  }

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return json(500, "AI 服务未配置");
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(model),
    system: SYSTEM,
    messages: await convertToModelMessages(messages),
    tools: chatTools,
    stopWhen: stepCountIs(6),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    generateMessageId: () => crypto.randomUUID(),
    onFinish: async ({ responseMessage }) => {
      if (!responseMessage.parts.length) return;
      const { error } = await supabase.from("messages").upsert({
        id: responseMessage.id, thread_id: threadId, user_id: userId, role: "assistant",
        parts: responseMessage.parts as unknown as Json,
      });
      if (error) console.error("save assistant message failed", error.message);
      await supabase.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
    },
    onError: (error) => {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 402) return "AI 额度不足，请在 设置 → 套餐与额度 中充值后再试。";
      if (status === 429) return "请求过于频繁，请稍后再试。";
      if (status === 403) return "当前模型暂不可用（访问被拒绝）。";
      return "生成回复时出错，请稍后重试。";
    },
  });
  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}
