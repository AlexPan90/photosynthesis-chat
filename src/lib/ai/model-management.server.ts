import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";

export function normalizeModelEndpoint(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !url.hostname || url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local") || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname.includes(":")) throw new Error("请输入公开的 HTTPS 服务地址");
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path.endsWith("/models") ? path.slice(0, -7) : path}`;
}

export async function discoverModels(baseUrl: string, key: string) {
  const endpoint = normalizeModelEndpoint(baseUrl);
  const response = await fetch(`${endpoint}/models`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "凭证无效或无权读取模型目录" : `无法读取模型目录（${response.status}），可改为手动添加`);
  const payload = await response.json() as { data?: Array<{ id?: unknown }> };
  if (!Array.isArray(payload.data)) throw new Error("该服务未返回标准模型列表，可改为手动添加");
  return [...new Set(payload.data.map(item => item?.id).filter((id): id is string => typeof id === "string" && id.length >= 2 && id.length <= 120))].sort().slice(0, 500);
}

export async function verifyDirectModel(modelId: string, directKey?: string, baseUrl = "", providerName = "OpenAI") {
  const key = directKey ?? process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("缺少模型服务凭证");
  const provider = createOpenAI(directKey ? { apiKey: key } : {
    baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  try {
    const reasoning = modelId.startsWith("openai/gpt-6-") || /^gpt-[56]/.test(modelId);
    const compatible = !!baseUrl && providerName !== "OpenAI";
    const result = streamText({
      model: compatible ? createOpenAICompatible({ name: "compatible", baseURL: normalizeModelEndpoint(baseUrl), apiKey: key }).chatModel(modelId) : provider.responses(modelId), prompt: "Reply with OK.",
      ...(compatible ? {} : { providerOptions: { openai: reasoning ? { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } : { store: false } } }),
    });
    if (!(await result.text).trim()) throw new Error("模型返回空内容");
  } catch (e) {
    const status = (e as { statusCode?: number })?.statusCode;
    if (status === 401) throw new Error("API Key 无效或已过期");
    if (status === 403) throw new Error("当前账户无权使用此模型");
    if (status === 404) throw new Error("该模型不存在或当前账户不可用");
    if (status === 429) throw new Error("请求过于频繁，请稍后重试");
    throw new Error((e as Error)?.message || "模型验证失败");
  }
}