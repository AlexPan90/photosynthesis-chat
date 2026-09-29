import { FileCode2, FileText, File } from "lucide-react";
import { demoFiles } from "./files";

const iconFor = (name: string) => /\.(ts|tsx|js|py|json)$/.test(name) ? FileCode2 : /\.(md|txt)$/.test(name) ? FileText : File;

const WINDOW = 400_000; // GPT-6 系列上下文窗口（估计值）
export type RailUsage = { total: number; context: number; replies: number; threadTotal: number };

export function ContextRail({ onOpen, usage }: { onOpen: (id: string) => void; usage: RailUsage | null }) {
  const used = usage?.context ?? 0, pct = Math.min(100, used / WINDOW * 100);
  return <aside className="relay-workspace hidden w-[300px] shrink-0 flex-col xl:flex">
    <div className="flex h-[60px] items-center border-b px-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">上下文文件</div>
    <div className="soft-scroll flex-1 overflow-y-auto px-3 py-4">
      {demoFiles.slice(0, 4).map((f, i) => { const Icon = iconFor(f.name); const dir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/") + 1) : "根目录"; return <button key={f.id} type="button" onClick={() => onOpen(f.id)} className="group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent/60">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground group-hover:text-foreground"><Icon className="size-4"/></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{f.name}</span><span className="block truncate text-[11px] text-muted-foreground">{f.size} · {dir}</span></span>
        {i === 0 && <span className="size-1.5 rounded-full bg-primary"/>}
      </button>; })}
      <div className="mx-1 mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">上下文 Token 用量</div>
        {usage ? <>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.max(pct, used ? 1 : 0)}%` }}/></div>
          <div className="mt-2.5 flex justify-between text-[11px] text-muted-foreground"><span className="font-mono">{used.toLocaleString()} / {WINDOW.toLocaleString()}</span><span>{pct.toFixed(1)}%</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-primary/15 pt-3 text-[11px]">
            <div><div className="text-muted-foreground">本对话累计</div><div className="mt-0.5 font-mono text-[13px] font-semibold text-foreground">{usage.threadTotal.toLocaleString()}</div></div>
            <div><div className="text-muted-foreground">已计量回复</div><div className="mt-0.5 font-mono text-[13px] font-semibold text-foreground">{usage.replies}</div></div>
          </div>
          {!usage.replies && <div className="mt-2 text-[10.5px] text-muted-foreground/70">发送消息后开始统计</div>}
        </> : <div className="mt-2.5 text-[11px] text-muted-foreground">示例对话不计量，登录后在自己的对话中查看真实用量。</div>}
      </div>
    </div>
  </aside>;
}
