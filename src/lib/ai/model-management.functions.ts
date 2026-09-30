import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupportedModel } from "./model-catalog";

const modelInput = z.object({
  id: z.string().uuid().optional(), modelId: z.string().trim().min(3).max(120),
  label: z.string().trim().min(1).max(80), version: z.string().trim().max(80),
  description: z.string().trim().max(500), reasoningEffort: z.enum(["low", "medium", "high"]),
  connectionType: z.enum(["gateway", "direct"]), apiKey: z.string().trim().max(300).optional(),
  providerName: z.string().trim().min(1).max(80).default("OpenAI"), baseUrl: z.string().trim().max(500).default(""),
});

export const fetchProviderModels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid().optional(), baseUrl: z.string().trim().max(500), apiKey: z.string().trim().max(300).optional() }).parse(data))
  .handler(async ({ data, context }) => {
    let key = data.apiKey;
    if (!key && data.id) {
      const { data: owned } = await context.supabase.from("ai_models").select("id,base_url").eq("id", data.id).maybeSingle();
      if (!owned || owned.base_url !== data.baseUrl) throw new Error("服务地址已改变，请重新输入 API Key");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: credential } = await supabaseAdmin.from("ai_model_credentials").select("secret_enc").eq("model_id", owned.id).eq("user_id", context.userId).maybeSingle();
      if (credential) { const { decryptSecret } = await import("./crypto.server"); key = await decryptSecret(credential.secret_enc); }
    }
    if (!key) throw new Error("请填写 API Key 后拉取模型");
    const { discoverModels } = await import("./model-management.server");
    return { models: await discoverModels(data.baseUrl, key) };
  });

export const saveModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => modelInput.parse(data))
  .handler(async ({ data, context }) => {
    if (data.connectionType === "gateway" && !isSupportedModel(data.modelId)) throw new Error("应用服务尚未接入该模型");
    const { supabase, userId } = context;
    const { data: existing } = data.id ? await supabase.from("ai_models").select("id,model_id,connection_type,base_url,verified_at").eq("id", data.id).maybeSingle() : { data: null };
    if (data.id && !existing) throw new Error("模型不存在");
    if (data.connectionType === "direct" && data.providerName !== "OpenAI" && !data.baseUrl) throw new Error("请填写服务地址");
    if (data.connectionType === "direct" && existing?.base_url !== data.baseUrl && !data.apiKey) throw new Error("服务地址已改变，请重新输入 API Key");
    if (data.connectionType === "direct" && !data.apiKey && (!existing || existing.connection_type !== "direct")) throw new Error("请输入 OpenAI API Key");
    const mustVerify = !!data.apiKey || !existing?.verified_at || existing.model_id !== data.modelId || existing.connection_type !== data.connectionType || existing.base_url !== data.baseUrl;
    let key = data.apiKey;
    if (mustVerify && data.connectionType === "direct" && !key && existing) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: credential } = await supabaseAdmin.from("ai_model_credentials").select("secret_enc").eq("model_id", existing.id).eq("user_id", userId).maybeSingle();
      if (credential) { const { decryptSecret } = await import("./crypto.server"); key = await decryptSecret(credential.secret_enc); }
    }
    if (mustVerify) {
      const { verifyDirectModel } = await import("./model-management.server");
      await verifyDirectModel(data.modelId, data.connectionType === "direct" ? key : undefined, data.baseUrl, data.providerName);
    }
    const record = {
      user_id: userId, model_id: data.modelId, label: data.label, provider: data.providerName, base_url: data.connectionType === "direct" ? data.baseUrl : "", version: data.version,
      description: data.description, parameters: { reasoningEffort: data.reasoningEffort },
      connection_type: data.connectionType, enabled: true,
      verified_at: mustVerify ? new Date().toISOString() : existing?.verified_at,
    };
    const query = existing ? supabase.from("ai_models").update(record).eq("id", existing.id).select("id").single()
      : supabase.from("ai_models").upsert(record, { onConflict: "user_id,model_id" }).select("id").single();
    const { data: saved, error } = await query;
    if (error || !saved) throw new Error(error?.message ?? "保存失败");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.connectionType === "direct" && data.apiKey) {
      const { encryptSecret } = await import("./crypto.server");
      const { error: secretError } = await supabaseAdmin.from("ai_model_credentials").upsert({ model_id: saved.id, user_id: userId, secret_enc: await encryptSecret(data.apiKey) });
      if (secretError) { await supabase.from("ai_models").update({ enabled: false, verified_at: null }).eq("id", saved.id); throw new Error("密钥未能安全保存，模型已停用"); }
    } else if (data.connectionType === "gateway") {
      await supabaseAdmin.from("ai_model_credentials").delete().eq("model_id", saved.id).eq("user_id", userId);
    }
    return { id: saved.id };
  });

export const removeModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("ai_models").update({ enabled: false }).eq("id", data.id).select("id").single();
    if (error || !row) throw new Error("移除失败");
    return { ok: true };
  });