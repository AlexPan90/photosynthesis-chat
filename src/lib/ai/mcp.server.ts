import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import { decryptSecret } from "./crypto.server";

export type McpRow = { id: string; name: string; url: string; auth_type: string; header_name: string; proxy_url?: string | null; secret_enc: string | null; state: string; disabled_tools: string[] };
export type McpToolInfo = { name: string; description: string; inputSchema?: Record<string, unknown> };

export function validateMcpUrl(url: string) {
  let u: URL;
  try { u = new URL(url); } catch { throw new Error("地址格式不正确"); }
  if (u.protocol !== "https:") throw new Error("只支持 https 地址");
  if (u.username || u.password || u.port || /^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|::1|\[|[^.]+$)/i.test(u.hostname) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(u.hostname)) throw new Error("不支持本地或内网地址");
  return u.toString();
}

export function buildHeaders(auth_type: string, header_name: string, secret: string | null): Record<string, string> {
  if (auth_type !== "api_key" || !secret) return {};
  const name = header_name.trim() || "Authorization";
  const value = name.toLowerCase() === "authorization" && !/^\w+\s/.test(secret) ? `Bearer ${secret}` : secret;
  return { [name]: value };
}

/** 代理（中转）：请求发往 <代理地址>/<原始地址>，适用于 cors-anywhere 式转发或自建网关。 */
export function withProxy(url: string, proxy?: string | null) {
  if (!proxy?.trim()) return url;
  return proxy.trim().replace(/\/?$/, "/") + url;
}

async function connect(url: string, headers: Record<string, string>) {
  return createMCPClient({ transport: { type: "http", url, headers, redirect: "error" }, initializationOptions: { timeout: 15000 } as never });
}

/** 连接一次并列出工具，用于保存/测试。 */
export async function probeMcp(url: string, headers: Record<string, string>): Promise<McpToolInfo[]> {
  let client: MCPClient | undefined;
  try {
    client = await connect(url, headers);
    const res = await client.listTools();
    return res.tools.map(t => ({ name: t.name, description: (t.description ?? "").slice(0, 300), inputSchema: t.inputSchema as Record<string, unknown> }));
  } finally { await client?.close().catch(() => {}); }
}

/** Run one user-selected tool against a saved connection; never return connection credentials. */
export async function runMcpTool(row: McpRow, name: string, args: Record<string, unknown>) {
  const secret = row.secret_enc ? await decryptSecret(row.secret_enc) : null;
  let client: MCPClient | undefined;
  try {
    client = await connect(withProxy(row.url, row.proxy_url), buildHeaders(row.auth_type, row.header_name, secret));
    const result = await client.callTool({ name, arguments: args, options: { timeout: 20000 } });
    const content = Array.isArray(result.content) ? result.content.map((part: unknown) => {
      if (part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part && typeof part.text === "string") return part.text;
      return JSON.stringify(part);
    }).join("\n\n") : JSON.stringify(result.content);
    return { isError: result.isError === true, content: content.slice(0, 30000) };
  } finally { await client?.close().catch(() => {}); }
}

/** 统一的工具 id：mcp:<连接id>:<工具名>。 */
export const mcpToolId = (connId: string, tool: string) => `mcp:${connId}:${tool}`;

/** 按 Agent 绑定的 MCP 工具 id 加载工具，返回工具集与关闭函数。 */
export async function loadMcpTools(rows: McpRow[], wanted: string[] | "all") {
  const clients: MCPClient[] = [];
  const tools: ToolSet = {};
  const labels: Record<string, string> = {};
  let i = 0;
  for (const row of rows) {
    if (row.state !== "ready") continue;
    const picks = wanted === "all" ? null : new Set(wanted.filter(w => w.startsWith(`mcp:${row.id}:`)).map(w => w.split(":").slice(2).join(":")));
    if (picks && picks.size === 0) continue;
    i++;
    try {
      const secret = row.secret_enc ? await decryptSecret(row.secret_enc) : null;
      const client = await connect(withProxy(row.url, row.proxy_url), buildHeaders(row.auth_type, row.header_name, secret));
      clients.push(client);
      const set = await client.tools() as ToolSet;
      for (const [name, t] of Object.entries(set)) {
        if (row.disabled_tools.includes(name)) continue;
        if (picks && !picks.has(name)) continue;
        const key = `m${i}_${name}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
        tools[key] = t;
        labels[key] = `${row.name} · ${name}`;
      }
    } catch (e) { console.error("mcp load failed", row.name, (e as Error).message); }
  }
  return { tools, labels, close: async () => { await Promise.all(clients.map(c => c.close().catch(() => {}))); } };
}
