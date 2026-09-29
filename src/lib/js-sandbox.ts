// 在隔离的 Web Worker 中运行 AI 生成的 JavaScript：无法访问页面、登录状态和本地存储，超时强制终止。
const WORKER_SRC = `
self.onmessage = async (e) => {
  const logs = [];
  const fmt = (v) => { try { return typeof v === "string" ? v : JSON.stringify(v); } catch { return String(v); } };
  const push = (level) => (...a) => { if (logs.length < 200) logs.push((level ? level + ": " : "") + a.map(fmt).join(" ")); };
  const console = { log: push(""), info: push(""), warn: push("warn"), error: push("error") };
  try { self.indexedDB = undefined; self.caches = undefined; } catch {}
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const result = await new AsyncFunction("input", "console", e.data.code)(e.data.input, console);
    self.postMessage({ ok: true, result: JSON.parse(JSON.stringify(result ?? null)), logs });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err), logs });
  }
};`;

export type JsRunResult = { ok: true; result: unknown; logs: string[]; durationMs: number } | { ok: false; error: string; logs: string[]; durationMs: number };

export function runJsInSandbox(code: string, input: unknown, timeoutMs = 10_000): Promise<JsRunResult> {
  const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
  const worker = new Worker(url);
  const started = performance.now();
  return new Promise<JsRunResult>((resolve) => {
    const done = (r: Omit<JsRunResult, "durationMs">) => {
      clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url);
      resolve({ ...r, durationMs: Math.round(performance.now() - started) } as JsRunResult);
    };
    const timer = setTimeout(() => done({ ok: false, error: `运行超时（${timeoutMs / 1000} 秒）`, logs: [] }), timeoutMs);
    worker.onmessage = (e) => done(e.data);
    worker.onerror = (e) => done({ ok: false, error: e.message || "脚本出错", logs: [] });
    worker.postMessage({ code, input: input ?? null });
  });
}
