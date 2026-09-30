import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

export async function verifyDirectModel(modelId: string, directKey?: string) {
  const key = directKey ?? process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("缺少模型服务凭证");
  const provider = createOpenAI(directKey ? { apiKey: key } : {
    baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  try {
    const result = streamText({
      model: provider.responses(modelId), prompt: "Reply with OK.",
      providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
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