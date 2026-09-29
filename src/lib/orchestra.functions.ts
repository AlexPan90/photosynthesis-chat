import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const mcpInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(40),
  url: z.string().trim().min(1).max(500),
  auth_type: z.enum(["none", "api_key"]),
  header_name: z.string().trim().max(60).default("Authorization"),
  secret: z.string().max(4000).optional(),
});

/** 保存 MCP 连接：加密密钥 → 测试连接 → 记录状态和工具列表。 */
export const saveMcpConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => mcpInput.parse(d))
  .handler(async ({ data, context }) => {
    const { validateMcpUrl, probeMcp, buildHeaders } = await import("@/lib/ai/mcp.server");
    const { encryptSecret, decryptSecret } = await import("@/lib/ai/crypto.server");
    const url = validateMcpUrl(data.url);
    let secret_enc: string | null | undefined;
    if (data.auth_type === "none") secret_enc = null;
    else if (data.secret) secret_enc = await encryptSecret(data.secret);
    let plain: string | null = data.secret ?? null;
    if (!plain && data.id && data.auth_type === "api_key") {
      const { data: row } = await context.supabase.from("mcp_connections").select("secret_enc").eq("id", data.id).maybeSingle();
      plain = row?.secret_enc ? await decryptSecret(row.secret_enc) : null;
    }
    let state = "ready", last_error: string | null = null, tools: { name: string; description: string }[] = [];
    try { tools = await probeMcp(url, buildHeaders(data.auth_type, data.header_name, plain)); }
    catch (e) { state = "failed"; last_error = String((e as Error).message ?? e).slice(0, 300); }
    const row = { name: data.name, url, auth_type: data.auth_type, header_name: data.header_name || "Authorization", state, last_error, tools: tools as unknown as Json, ...(secret_enc !== undefined ? { secret_enc } : {}) };
    const q = data.id
      ? context.supabase.from("mcp_connections").update(row).eq("id", data.id).select("id").single()
      : context.supabase.from("mcp_connections").insert(row).select("id").single();
    const { data: saved, error } = await q;
    if (error) throw new Error("保存失败：" + error.message);
    return { id: saved.id, state, last_error, toolCount: tools.length };
  });

export const testMcpConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { probeMcp, buildHeaders } = await import("@/lib/ai/mcp.server");
    const { decryptSecret } = await import("@/lib/ai/crypto.server");
    const { data: row } = await context.supabase.from("mcp_connections").select("url,auth_type,header_name,secret_enc").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("连接不存在");
    let state = "ready", last_error: string | null = null, tools: { name: string; description: string }[] = [];
    try { tools = await probeMcp(row.url, buildHeaders(row.auth_type, row.header_name, row.secret_enc ? await decryptSecret(row.secret_enc) : null)); }
    catch (e) { state = "failed"; last_error = String((e as Error).message ?? e).slice(0, 300); }
    await context.supabase.from("mcp_connections").update({ state, last_error, ...(state === "ready" ? { tools: tools as unknown as Json } : {}) }).eq("id", data.id);
    return { state, last_error, toolCount: tools.length };
  });

export const scanSkillSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ repo: z.string().trim().min(3).max(300) }).parse(d))
  .handler(async ({ data }) => {
    const { scanRepo } = await import("@/lib/ai/skills.server");
    return scanRepo(data.repo);
  });

export const readSkillIndex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().url().max(500) }).parse(d))
  .handler(async ({ data }) => {
    if (!data.url.startsWith("https://")) throw new Error("只支持 https 地址");
    const { fetchText } = await import("@/lib/ai/skills.server");
    const parsed = z.array(z.object({ name: z.string(), description: z.string().default(""), repo: z.string(), path: z.string().default("") })).max(500)
      .safeParse(JSON.parse(await fetchText(data.url, 400000)));
    if (!parsed.success) throw new Error("订阅源格式不正确：需要 [{name, description, repo, path}] 数组");
    return parsed.data;
  });

/** 从 GitHub 安装（或重新拉取）一组 Skill。 */
export const installSkills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    repo: z.string().max(300),
    items: z.array(z.object({ path: z.string().max(300), files: z.array(z.string().max(300)).max(80).optional() })).min(1).max(30),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { parseRepo, scanRepo, fetchSkill, parseFrontmatter } = await import("@/lib/ai/skills.server");
    const { owner, repo, ref } = parseRepo(data.repo);
    const scanned = await scanRepo(ref ? data.repo : `${owner}/${repo}`);
    const source_url = `https://github.com/${owner}/${repo}`;
    const { data: existing } = await context.supabase.from("skills").select("id,path").eq("source_url", source_url);
    let installed = 0;
    for (const item of data.items) {
      const hit = scanned.skills.find(s => s.path === item.path);
      if (!hit) continue;
      const content = await fetchSkill(owner, repo, scanned.ref, item.path);
      const meta = parseFrontmatter(content);
      const row = { name: (meta.name || hit.name).slice(0, 60), description: (meta.description || hit.description).slice(0, 500), source_type: "github", source_url, ref: scanned.ref, path: item.path, content, files: hit.files as unknown as Json };
      const prev = existing?.find(e => e.path === item.path);
      const { error } = prev ? await context.supabase.from("skills").update(row).eq("id", prev.id) : await context.supabase.from("skills").insert(row);
      if (error) throw new Error("保存失败：" + error.message);
      installed++;
    }
    return { installed };
  });
