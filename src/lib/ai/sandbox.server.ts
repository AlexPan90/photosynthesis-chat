import { Sandbox } from "e2b";

// 在 E2B 云沙箱中运行 Skill 脚本：把 Skill 目录下载进隔离 Linux 环境，按扩展名选择解释器执行。
const RUNNERS: Record<string, string> = { py: "python3", js: "node", mjs: "node", cjs: "node", sh: "bash", ts: "npx -y tsx" };
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function runnerFor(file: string) {
  return RUNNERS[file.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}

export async function runInSandbox(opts: {
  files: { path: string; content: string }[];
  entry: string;
  args: string[];
  stdin?: string | undefined;
  signal?: AbortSignal | undefined;
}) {
  const apiKey = process.env["E2B_API_KEY"];
  if (!apiKey) throw new Error("未配置 E2B 密钥，云沙箱不可用");
  const runner = runnerFor(opts.entry);
  if (!runner) throw new Error(`不支持运行该类型的脚本：${opts.entry}`);
  const root = "/home/user/skill";
  const started = Date.now();
  const sbx = await Sandbox.create({ apiKey, timeoutMs: 180_000 });
  const kill = () => { void sbx.kill().catch(() => {}); };
  opts.signal?.addEventListener("abort", kill);
  try {
    for (const f of opts.files) await sbx.files.write(`${root}/${f.path}`, f.content);
    let setup = "";
    if (opts.files.some(f => f.path === "requirements.txt")) {
      const r = await sbx.commands.run(`cd ${root} && pip install -q -r requirements.txt`, { timeoutMs: 120_000 }).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? String(e) }));
      setup = (r.stderr ?? "").slice(-2000);
    }
    const stdinPart = opts.stdin ? `printf %s ${q(opts.stdin)} | ` : "";
    const cmd = `cd ${root} && ${stdinPart}${runner} ${q(opts.entry)} ${opts.args.map(q).join(" ")}`;
    let out: { stdout: string; stderr: string; exitCode: number };
    try {
      const r = await sbx.commands.run(cmd, { timeoutMs: 120_000 });
      out = { stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode };
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string; exitCode?: number; message?: string };
      if (err.exitCode === undefined) throw e;
      out = { stdout: err.stdout ?? "", stderr: err.stderr ?? err.message ?? "", exitCode: err.exitCode };
    }
    return {
      command: `${runner} ${opts.entry} ${opts.args.join(" ")}`.trim(),
      exitCode: out.exitCode,
      stdout: out.stdout.slice(-12000),
      stderr: out.stderr.slice(-4000),
      ...(setup ? { setup } : {}),
      durationMs: Date.now() - started,
    };
  } finally {
    opts.signal?.removeEventListener("abort", kill);
    kill();
  }
}
