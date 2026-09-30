import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupportedModel } from "./model-catalog";

const input = z.object({ modelId: z.string().min(3).max(120), apiKey: z.string().trim().max(300).optional() });

export const verifyModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }) => {
    if (!data.apiKey && !isSupportedModel(data.modelId)) throw new Error("当前服务尚未接入这个模型");
    const key = data.apiKey || process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("请填写 API Key 或配置模型服务");
    const direct = !!data.apiKey;
    const provider = createOpenAI(direct ? { apiKey: key } : {
      baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    try {
      const result = streamText({
        model: provider.responses(data.modelId), prompt: "Reply with OK.",
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
      });
      const text = await result.text;
      if (!text.trim()) throw new Error("empty response");
      return { verifiedAt: new Date().toISOString() };
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 401) throw new Error("API Key 无效或已过期");
      if (status === 403) throw new Error("当前账户无权使用此模型");
      if (status === 404) throw new Error("该模型不存在或当前账户不可用");
      if (status === 429) throw new Error("请求过于频繁，请稍后重试");
      throw new Error((error as Error)?.message || "验证失败，请检查模型名及服务权限");
    }
  });