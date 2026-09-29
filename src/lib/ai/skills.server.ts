import { tool, type ToolSet } from "ai";
import { z } from "zod";

export type SkillRow = { id: string; name: string; description: string; source_type: string; source_url: string | null; ref: string | null; path: string | null; content: string; files: unknown };
export type RemoteSkill = { name: string; description: string; path: string; files: string[] };

const GH = "https://api.github.com";
const ghHeaders = { Accept: "application/vnd.github+json", "User-Agent": "relay-studio" };

/** 解析 owner/repo、https://github.com/o/r、…/tree/ref/sub 等写法。 */
export function parseRepo(input: string) {
  const s = input.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const m = s.match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+)(?:\/tree\/([^/]+)(?:\/(.+))?)?$/);
  if (!m) throw new Error("请填写 GitHub 仓库，例如 anthropics/skills");
  return { owner: m[1]!, repo: m[2]!, ref: m[3], sub: m[4] };
}

export function parseFrontmatter(md: string) {
  const lines = (md.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? "").split("\n");
  const get = (k: string) => {
    const i = lines.findIndex(l => l.startsWith(`${k}:`));
    if (i < 0) return "";
    const v = lines[i]!.slice(k.length + 1).trim();
    if (!/^[>|][-+]?$/.test(v)) return v.replace(/^["']|["']$/g, "");
    const out: string[] = [];
    for (const l of lines.slice(i + 1)) { if (l && !/^\s/.test(l)) break; out.push(l.trim()); }
    return out.join(" ").trim();
  };
  return { name: get("name"), description: get("description") };
}

const raw = (owner: string, repo: string, ref: string, path: string) => `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path.split("/").map(encodeURIComponent).join("/")}`;

export async function fetchText(url: string, max = 60000) {
  const r = await fetch(url, { headers: { "User-Agent": "relay-studio" } });
  if (!r.ok) throw new Error(`读取失败（${r.status}）`);
  return (await r.text()).slice(0, max);
}

/** 扫描仓库中所有 SKILL.md 所在目录。 */
export async function scanRepo(input: string) {
  const { owner, repo, ref: givenRef, sub } = parseRepo(input);
  let ref = givenRef;
  if (!ref) {
    const r = await fetch(`${GH}/repos/${owner}/${repo}`, { headers: ghHeaders });
    if (r.status === 404) throw new Error("仓库不存在或不是公开仓库");
    if (!r.ok) throw new Error(`GitHub 暂时无法访问（${r.status}），请稍后再试`);
    ref = ((await r.json()) as { default_branch: string }).default_branch;
  }
  const t = await fetch(`${GH}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, { headers: ghHeaders });
  if (!t.ok) throw new Error(`读取目录失败（${t.status}）`);
  const tree = ((await t.json()) as { tree: { path: string; type: string }[] }).tree.filter(x => x.type === "blob");
  const skillFiles = tree.filter(x => /(^|\/)SKILL\.md$/.test(x.path) && (!sub || x.path.startsWith(`${sub}/`) || x.path === `${sub}/SKILL.md`)).slice(0, 60);
  const skills: RemoteSkill[] = await Promise.all(skillFiles.map(async f => {
    const dir = f.path.replace(/\/?SKILL\.md$/, "");
    const md = await fetchText(raw(owner, repo, ref!, f.path), 8000).catch(() => "");
    const meta = parseFrontmatter(md);
    const files = tree.filter(x => x.path !== f.path && (dir ? x.path.startsWith(`${dir}/`) : !x.path.includes("/"))).map(x => dir ? x.path.slice(dir.length + 1) : x.path).slice(0, 80);
    return { name: meta.name || dir.split("/").pop() || repo, description: meta.description, path: dir, files };
  }));
  return { owner, repo, ref, source: `https://github.com/${owner}/${repo}`, skills };
}

export async function fetchSkill(owner: string, repo: string, ref: string, path: string) {
  return fetchText(raw(owner, repo, ref, path ? `${path}/SKILL.md` : "SKILL.md"));
}

/** 渐进加载：系统提示只列名称+描述，模型按需读取正文和附带文件。 */
export function skillsPrompt(skills: SkillRow[]) {
  if (!skills.length) return "";
  return `\n\n你可以使用以下 Skills（方法手册）。当任务匹配时，先调用 load_skill 读取完整说明再执行；需要其中的参考文件时调用 read_skill_file。\n${skills.map(s => `- ${s.name}：${s.description}`).join("\n")}`;
}

export function skillTools(skills: SkillRow[]): ToolSet {
  if (!skills.length) return {};
  const find = (name: string) => skills.find(s => s.name === name);
  return {
    load_skill: tool({
      description: "读取某个 Skill 的完整 SKILL.md 说明和附带文件列表",
      inputSchema: z.object({ name: z.string().describe("Skill 名称") }),
      execute: async ({ name }) => {
        const s = find(name);
        if (!s) throw new Error(`未找到 Skill：${name}`);
        return { name: s.name, content: s.content, files: Array.isArray(s.files) ? s.files : [] };
      },
    }),
    read_skill_file: tool({
      description: "读取 Skill 附带的参考文件（只读，来自其远程仓库）",
      inputSchema: z.object({ name: z.string(), file: z.string().describe("load_skill 返回的相对路径") }),
      execute: async ({ name, file }) => {
        const s = find(name);
        if (!s) throw new Error(`未找到 Skill：${name}`);
        const files = Array.isArray(s.files) ? (s.files as string[]) : [];
        if (!files.includes(file)) throw new Error("该文件不属于这个 Skill");
        if (s.source_type !== "github" || !s.source_url || !s.ref) throw new Error("手动创建的 Skill 没有附带文件");
        const { owner, repo } = parseRepo(s.source_url);
        return { file, content: await fetchText(raw(owner, repo, s.ref, s.path ? `${s.path}/${file}` : file), 20000) };
      },
    }),
  };
}
