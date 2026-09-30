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
  proxy_url: z.string().trim().max(500).optional(),
});

/** 保存 MCP 连接：加密密钥 → 测试连接 → 记录状态和工具列表。 */
export const saveMcpConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => mcpInput.parse(d))
  .handler(async ({ data, context }) => {
    const { validateMcpUrl, probeMcp, buildHeaders, withProxy } = await import("@/lib/ai/mcp.server");
    const { encryptSecret, decryptSecret } = await import("@/lib/ai/crypto.server");
    const url = validateMcpUrl(data.url);
    const proxy_url = data.proxy_url ? validateMcpUrl(data.proxy_url) : null;
    let secret_enc: string | null | undefined;
    if (data.auth_type === "none") secret_enc = null;
    else if (data.secret) secret_enc = await encryptSecret(data.secret);
    let plain: string | null = data.secret ?? null;
    if (!plain && data.id && data.auth_type === "api_key") {
      const { data: row } = await context.supabase.from("mcp_connections").select("secret_enc").eq("id", data.id).maybeSingle();
      plain = row?.secret_enc ? await decryptSecret(row.secret_enc) : null;
    }
    let state = "ready", last_error: string | null = null, tools: { name: string; description: string; inputSchema?: Record<string, unknown> }[] = [];
    try { tools = await probeMcp(withProxy(url, proxy_url), buildHeaders(data.auth_type, data.header_name, plain)); }
    catch (e) { state = "failed"; last_error = String((e as Error).message ?? e).slice(0, 300); }
    const row = { name: data.name, url, proxy_url, auth_type: data.auth_type, header_name: data.header_name || "Authorization", state, last_error, tools: tools as unknown as Json, ...(secret_enc !== undefined ? { secret_enc } : {}) };
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
    const { probeMcp, buildHeaders, withProxy } = await import("@/lib/ai/mcp.server");
    const { decryptSecret } = await import("@/lib/ai/crypto.server");
    const { data: row } = await context.supabase.from("mcp_connections").select("url,auth_type,header_name,proxy_url,secret_enc").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("连接不存在");
    let state = "ready", last_error: string | null = null, tools: { name: string; description: string; inputSchema?: Record<string, unknown> }[] = [];
    try { tools = await probeMcp(withProxy(validateSafeUrl(row.url), row.proxy_url ? validateSafeUrl(row.proxy_url) : null), buildHeaders(row.auth_type, row.header_name, row.secret_enc ? await decryptSecret(row.secret_enc) : null)); }
    catch (e) { state = "failed"; last_error = String((e as Error).message ?? e).slice(0, 300); }
    await context.supabase.from("mcp_connections").update({ state, last_error, ...(state === "ready" ? { tools: tools as unknown as Json } : {}) }).eq("id", data.id);
    return { state, last_error, toolCount: tools.length };
  });

export const callMcpTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(), name: z.string().min(1).max(200),
    args: z.record(z.unknown()), confirmed: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (JSON.stringify(data.args).length > 16000) throw new Error("参数过长");
    const { data: row, error } = await context.supabase.from("mcp_connections")
      .select("id,name,url,auth_type,header_name,proxy_url,secret_enc,state,disabled_tools,tools")
      .eq("id", data.id).maybeSingle();
    if (error || !row || row.state !== "ready") throw new Error("连接未就绪");
    const available = Array.isArray(row.tools) && row.tools.some(t => t && typeof t === "object" && "name" in t && t['name'] === data.name);
    if (!available || row.disabled_tools.includes(data.name)) throw new Error("工具不可用或已停用");
    if (!data.confirmed) throw new Error("请确认本次工具调用");
    const { runMcpTool } = await import("@/lib/ai/mcp.server");
    row.url = validateSafeUrl(row.url);
    if (row.proxy_url) row.proxy_url = validateSafeUrl(row.proxy_url);
    return runMcpTool(row, data.name, data.args);
  });

function validateSafeUrl(url: string) {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.username || u.password || u.port || /^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|::1|\[|[^.]+$)/i.test(u.hostname) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(u.hostname)) throw new Error("只支持公开的 HTTPS 服务地址");
  return u.toString();
}

export const scanSkillSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ repo: z.string().trim().min(3).max(300) }).parse(d))
  .handler(async ({ data }) => {
    const { scanRepo } = await import("@/lib/ai/skills.server");
    return scanRepo(data.repo);
  });

const skillDef = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().max(500).default(""),
  repo: z.string().max(300).optional(),
  path: z.string().max(300).default(""),
  url: z.string().url().max(500).optional(),
  content: z.string().max(60000).optional(),
}).refine(d => d.repo || d.url || d.content, "每项需要 repo、url 或 content 之一");
export type SkillDef = z.infer<typeof skillDef>;

async function loadIndex(url: string) {
  if (!url.startsWith("https://")) throw new Error("只支持 https 地址");
  const { fetchText } = await import("@/lib/ai/skills.server");
  let raw: unknown;
  try { raw = JSON.parse(await fetchText(url, 400000)); } catch { throw new Error("地址返回的不是有效 JSON"); }
  const list = Array.isArray(raw) ? raw : (raw as { skills?: unknown })?.skills;
  const parsed = z.array(skillDef).max(500).safeParse(list);
  if (!parsed.success) throw new Error("JSON 格式不正确：需要 [{name, description, repo+path | url | content}] 或 {skills:[…]}");
  return parsed.data;
}

/** 读取远程 JSON 定义（数组或 {skills:[]}），每项可指向 GitHub 仓库、SKILL.md 链接或直接内联正文。 */
export const readSkillIndex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().url().max(500) }).parse(d))
  .handler(async ({ data }) => loadIndex(data.url));

/** 安装/更新 JSON 定义中非 GitHub 的条目（url 或内联 content），以索引地址 + 名称作为来源键。 */
export const installSkillDefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().url().max(500), names: z.array(z.string().max(60)).min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { fetchText, parseFrontmatter } = await import("@/lib/ai/skills.server");
    const defs = (await loadIndex(data.url)).filter(d => !d.repo && data.names.includes(d.name));
    const { data: existing } = await context.supabase.from("skills").select("id,path").eq("source_url", data.url);
    let installed = 0;
    for (const d of defs) {
      let content = d.content ?? "";
      if (!content && d.url) { if (!d.url.startsWith("https://")) continue; content = await fetchText(d.url, 200000); }
      const meta = parseFrontmatter(content);
      const row = { name: (meta.name || d.name).slice(0, 60), description: (meta.description || d.description).slice(0, 500), source_type: "url", source_url: data.url, path: d.name, content, files: [] as unknown as Json };
      const prev = existing?.find(e => e.path === d.name);
      const { error } = prev ? await context.supabase.from("skills").update(row).eq("id", prev.id) : await context.supabase.from("skills").insert(row);
      if (error) throw new Error("保存失败：" + error.message);
      installed++;
    }
    return { installed };
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

/** 轻量检查某个远程 Skill 是否有更新：只拉取 SKILL.md 正文比对，不重写数据。 */
export const checkSkillUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: s } = await context.supabase.from("skills").select("id,name,source_type,source_url,ref,path,content").eq("id", data.id).maybeSingle();
    if (!s || !s.source_url || s.source_type === "manual") return { changed: false };
    const { parseRepo, fetchText } = await import("@/lib/ai/skills.server");
    try {
      if (s.source_type === "github") {
        const { owner, repo } = parseRepo(s.source_url);
        const ref = s.ref ?? "main";
        const path = s.path ? `${s.path}/SKILL.md` : "SKILL.md";
        const remote = await fetchText(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path.split("/").map(encodeURIComponent).join("/")}`, 200000);
        return { changed: remote.trim() !== s.content.trim() };
      }
      // url 类型：从订阅源 JSON 找到同名条目，比对正文
      const defs = await loadIndex(s.source_url);
      const def = defs.find(d => !d.repo && d.name === (s.path ?? s.name));
      if (!def) return { changed: false };
      const remote = def.content ?? (def.url ? await fetchText(def.url, 200000) : "");
      return { changed: remote.trim() !== s.content.trim() };
    } catch {
      return { changed: false }; // 网络抖动时静默跳过，不打扰界面
    }
  });

/** 切换对话的模型 / Agent：立即保存到 threads，刷新后不丢。 */
export const updateThreadModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    threadId: z.string().uuid(),
    model: z.string().trim().min(1).max(120),
    agentId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: configured } = await context.supabase.from("ai_models").select("id").eq("model_id", data.model).eq("enabled", true).not("verified_at", "is", null).maybeSingle();
    if (!configured) throw new Error("请选择已验证的模型");
    const { error } = await context.supabase.from("threads").update({ model: data.model, agent_id: data.agentId ?? null }).eq("id", data.threadId);
    if (error) throw new Error("保存失败：" + error.message);
    return { ok: true };
  });
