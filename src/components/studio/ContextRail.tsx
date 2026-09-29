import { useState } from "react";
import { ChevronRight, FileCode2, FileText, File, Folder, FolderOpen } from "lucide-react";
import { demoFiles } from "./files";

const iconFor = (name: string) => /\.(ts|tsx|js|py|json)$/.test(name) ? FileCode2 : /\.(md|txt)$/.test(name) ? FileText : File;
const STATUS: Record<number, { k: string; cls: string; tip: string }> = {
  0: { k: "M", cls: "text-warning", tip: "已修改" },
  2: { k: "M", cls: "text-warning", tip: "已修改" },
  3: { k: "U", cls: "text-success", tip: "新增" },
  4: { k: "U", cls: "text-success", tip: "新增" },
};

const WINDOW = 400_000; // GPT-6 系列上下文窗口（估计值）
export type RailUsage = { total: number; context: number; replies: number; threadTotal: number };

function Ring({ pct }: { pct: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
    <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5" className="stroke-muted"/>
    <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5" strokeLinecap="round" className="relay-ring stroke-primary transition-[stroke-dashoffset] duration-700" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(pct, pct ? 1.5 : 0) / 100)}/>
  </svg>;
}

export function ContextRail({ onOpen, usage }: { onOpen: (id: string) => void; usage: RailUsage | null }) {
  const used = usage?.context ?? 0, pct = Math.min(100, used / WINDOW * 100);
  const groups = new Map<string, { f: typeof demoFiles[number]; i: number }[]>();
  demoFiles.forEach((f, i) => { const dir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : ""; groups.set(dir, [...(groups.get(dir) ?? []), { f, i }]); });
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  return <aside className="relay-workspace hidden w-[300px] shrink-0 flex-col xl:flex">
    <div className="flex h-[60px] items-center justify-between border-b px-5"><span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">上下文文件</span><span className="font-mono text-[10.5px] text-muted-foreground/70">{demoFiles.length} files</span></div>
    <div className="soft-scroll flex-1 overflow-y-auto px-2 py-3 font-mono text-[12px]">
      {[...groups].map(([dir, items]) => { const open = !closed[dir]; return <div key={dir || "root"}>
        {dir && <button type="button" onClick={() => setClosed(s => ({ ...s, [dir]: open }))} className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-muted-foreground hover:bg-accent/50 hover:text-foreground">
          <ChevronRight className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}/>{open ? <FolderOpen className="size-3.5 text-primary/80"/> : <Folder className="size-3.5"/>}<span className="truncate">{dir}</span>
        </button>}
        {open && items.map(({ f, i }) => { const Icon = iconFor(f.name); const st = STATUS[i]; return <button key={f.id} type="button" onClick={() => onOpen(f.id)} title={`${f.path} · ${f.size}`} className={`relay-tree-row group flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left hover:bg-accent/50 ${dir ? "pl-8" : "pl-2"}`}>
          <Icon className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground"/>
          <span className="min-w-0 flex-1 truncate text-foreground/90">{f.name}</span>
          <span className="text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100">{f.size}</span>
          {st && <span title={st.tip} className={`w-3 text-center text-[10.5px] font-bold ${st.cls}`}>{st.k}</span>}
        </button>; })}
      </div>; })}
      <div className="relay-glass mx-1 mt-5 rounded-xl border border-primary/25 p-4 font-sans">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">上下文 Token 用量</div>
        {usage ? <>
          <div className="mt-3 flex items-center gap-4">
            <div className="relative"><Ring pct={pct}/><span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-semibold">{pct.toFixed(pct < 10 ? 1 : 0)}%</span></div>
            <div className="min-w-0 font-mono text-[11px] text-muted-foreground"><div className="text-[13px] font-semibold text-foreground">{used.toLocaleString()}</div><div>/ {WINDOW.toLocaleString()}</div></div>
          </div>
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
