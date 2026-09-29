import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupportedModel } from "./model-catalog";

export const verifyModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ modelId: z.string().max(120) }).parse(data))
  .handler(async ({ data }) => {
    if (!isSupportedModel(data.modelId)) throw new Error("当前服务尚未接入这个模型");
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("模型服务尚未配置");
    const provider = createOpenAI({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key, headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" } });
    try {
      await generateText({ model: provider.responses(data.modelId), prompt: "Reply with OK.", maxOutputTokens: 16 });
      return { verifiedAt: new Date().toISOString() };
    } catch {
      throw new Error("验证失败：该模型暂时不可用，请稍后重试");
    }
  });
