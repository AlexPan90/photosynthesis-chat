import { tool } from "ai";
import { z } from "zod";

function htmlToText(html: string) {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

function isPublicUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return false;
    const h = u.hostname;
    return !(h === "localhost" || h.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h) || h.includes(":"));
  } catch { return false; }
}

export const chatTools = {
  read_webpage: tool({
    description: "读取一个公开网页的正文内容（纯文本）。当用户给出链接或需要查看网页内容时使用。",
    inputSchema: z.object({ url: z.string().url().describe("完整的 http(s) 网址") }),
    execute: async ({ url }) => {
      if (!isPublicUrl(url)) throw new Error("只能读取公开的 http(s) 网址");
      const res = await fetch(url, { headers: { "user-agent": "RelayStudioBot/1.0", accept: "text/html,text/plain" }, signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`网页返回 ${res.status}`);
      const raw = await res.text();
      const title = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
      const text = htmlToText(raw);
      return { url, title, content: text.slice(0, 12000), truncated: text.length > 12000 };
    },
  }),
  get_current_time: tool({
    description: "获取当前日期和时间。涉及今天、现在、日期计算时使用。",
    inputSchema: z.object({ timezone: z.string().default("Asia/Shanghai").describe("IANA 时区，如 Asia/Shanghai") }),
    execute: async ({ timezone }) => {
      const now = new Date();
      let local: string;
      try { local = now.toLocaleString("zh-CN", { timeZone: timezone, hour12: false, weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
      catch { throw new Error(`未知时区：${timezone}`); }
      return { timezone, local, iso: now.toISOString() };
    },
  }),
  calculate: tool({
    description: "精确计算数学表达式（支持 + - * / % ** 括号和 Math 函数，如 sqrt、pow、log）。",
    inputSchema: z.object({ expression: z.string().max(300) }),
    execute: async ({ expression }) => {
      const expr = expression.replace(/\b(sqrt|pow|log|log10|log2|exp|sin|cos|tan|abs|floor|ceil|round|min|max|PI|E)\b/g, "Math.$1");
      if (!/^[\d\s+\-*/%().,eMathsqrpowlgxincbfurdmaPIE]*$/.test(expr)) throw new Error("表达式包含不支持的字符");
      const value = Function(`"use strict";return (${expr})`)();
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("计算结果无效");
      return { expression, result: value };
    },
  }),
};
