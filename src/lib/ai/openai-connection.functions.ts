import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ apiKey: z.string().trim().min(1).max(300) });

export const testOpenAIConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { fetchOpenAIModels } = await import("./model-management.server");
    let models: string[];
    try {
      models = await fetchOpenAIModels(data.apiKey);
      if (!models.length) throw new Error("连接成功，但该密钥没有可用模型");
    } catch (error) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("ai_provider_connections").delete().eq("user_id", context.userId).eq("provider", "OpenAI");
      await context.supabase.from("ai_models").update({ verified_at: null }).eq("provider", "OpenAI").eq("connection_type", "direct");
      throw error;
    }
    {
      const { encryptSecret } = await import("./crypto.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("ai_provider_connections").upsert({
        user_id: context.userId, provider: "OpenAI", secret_enc: await encryptSecret(data.apiKey), verified_at: new Date().toISOString(),
      }, { onConflict: "user_id,provider" });
      if (error) throw new Error("连接已验证，但凭证保存失败");
      return { models };
    }
  });

export const getOpenAIConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("ai_provider_connections")
      .select("verified_at").eq("provider", "OpenAI").maybeSingle();
    if (error) throw new Error("无法读取 OpenAI 连接状态");
    if (!data?.verified_at) return { connected: false, models: [] as string[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: credential } = await supabaseAdmin.from("ai_provider_connections")
      .select("secret_enc").eq("user_id", context.userId).eq("provider", "OpenAI").maybeSingle();
    if (!credential) return { connected: false, models: [] as string[] };
    const { decryptSecret } = await import("./crypto.server");
    const { fetchOpenAIModels } = await import("./model-management.server");
    try { return { connected: true, models: await fetchOpenAIModels(await decryptSecret(credential.secret_enc)) }; }
    catch { return { connected: false, models: [] as string[] }; }
  });