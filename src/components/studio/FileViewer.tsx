import { useState } from "react";
import { Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { kindStyles, type StudioFile } from "./files";

function Preview({ file }: { file: StudioFile }) {
  if (file.doc) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border bg-card p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">目录 · {file.doc.pages} 页</p>
          <ol className="space-y-1.5">
            {file.doc.toc.map((t, i) => (
              <li key={t} className="flex items-baseline gap-2 text-[11px] text-muted-foreground">
                <span className="font-mono text-[10px] opacity-60">{String(i + 1).padStart(2, "0")}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
        <article className="rounded-md border bg-background p-5 text-[13px] leading-[1.9]">
          {file.doc.excerpt.split("\n\n").map((block, i) =>
            block.startsWith("## ") ? (
              <h3 key={i} className="mb-3 text-[15px] font-semibold">{block.slice(3)}</h3>
            ) : block.startsWith("> ") ? (
              <blockquote key={i} className="mt-3 border-l-2 border-file-doc/50 pl-3 text-muted-foreground">{block.slice(2)}</blockquote>
            ) : (
              <p key={i} className="text-muted-foreground">{block}</p>
            ),
          )}
        </article>
      </div>
    );
  }
  if (file.table) {
    return (
      <div className="overflow-hidden rounded-md border">
        <div className="soft-scroll max-h-[420px] overflow-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="w-9 border-b px-2 py-2 text-right font-mono text-[10px] text-muted-foreground">#</th>
                {file.table.columns.map((c) => (
                  <th key={c} className="whitespace-nowrap border-b px-3 py-2 text-left font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {file.table.rows.map((row, i) => (
                <tr key={i} className={`hover:bg-accent/60 ${i % 2 ? "bg-muted/25" : ""}`}>
                  <td className="px-2 py-1.5 text-right font-mono text-[10px] text-muted-foreground">{i + 1}</td>
                  {row.map((cell, j) => (
                    <td key={j} className={`whitespace-nowrap px-3 py-1.5 ${j >= 2 ? "font-mono text-muted-foreground" : ""}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t bg-muted/40 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
          显示 {file.table.rows.length} / {file.table.totalRows.toLocaleString()} 行 · {file.table.columns.length} 列
        </div>
      </div>
    );
  }
  if (file.diff) {
    return (
      <div className="overflow-hidden rounded-md border font-mono text-[11px] leading-6">
        <div className="flex items-center gap-3 border-b bg-muted/50 px-3 py-1.5">
          <span className="text-muted-foreground">{file.path}</span>
          <span className="ml-auto text-success">+{file.diff.added}</span>
          <span className="text-destructive">−{file.diff.removed}</span>
        </div>
        {file.diff.lines.map((line, i) => (
          <div
            key={i}
            className={`flex gap-3 px-3 ${line.type === "add" ? "bg-success/8 text-success" : line.type === "del" ? "bg-destructive/8 text-destructive" : "text-muted-foreground"}`}
          >
            <span className="w-4 shrink-0 select-none text-right opacity-50">{i + 1}</span>
            <span className="w-2 shrink-0 select-none">{line.type === "add" ? "+" : line.type === "del" ? "-" : ""}</span>
            <span className="whitespace-pre-wrap break-all">{line.text}</span>
          </div>
        ))}
      </div>
    );
  }
  if (file.code) {
    return (
      <div className="overflow-hidden rounded-md border">
        <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
          <span>{file.path}</span>
          <span className="ml-auto uppercase">{file.code.language}</span>
        </div>
        <div className="soft-scroll max-h-[420px] overflow-auto bg-background px-3 py-2 font-mono text-[11px] leading-6">
          {file.code.content.split("\n").map((line, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-6 shrink-0 select-none text-right text-muted-foreground/50">{i + 1}</span>
              <span className="whitespace-pre text-foreground/85">{line || " "}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (file.image) {
    return (
      <div className="space-y-3">
        <div className="checker flex h-56 items-end gap-3 rounded-md border px-6 py-6">
          {[38, 62, 30, 78, 48, 56].map((h, i) => (
            <div key={i} className={`flex-1 rounded-t-md ${file.image!.palette[i % file.image!.palette.length]} opacity-85`} style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 font-mono text-[10px] text-muted-foreground">
          <span>{file.image.width} × {file.image.height}</span>
          <span>{file.size}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">{file.image.caption}</p>
      </div>
    );
  }
  if (file.audio) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border bg-card p-4">
          <div className="flex items-center gap-3">
            <Button size="icon-sm" className="size-9 rounded-full" aria-label="播放录音"><Play className="size-4" /></Button>
            <div className="flex h-10 flex-1 items-center gap-[3px]">
              {file.audio.wave.map((h, i) => (
                <span key={i} className={`flex-1 rounded-full ${i < 10 ? "bg-file-media" : "bg-file-media/30"}`} style={{ height: `${Math.max(14, h)}%` }} />
              ))}
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">{file.audio.duration}</span>
          </div>
        </div>
        <div className="space-y-2">
          {file.audio.transcript.map((t) => (
            <div key={t.at} className="lift flex gap-3 rounded-md border bg-card px-3 py-2">
              <span className="shrink-0 font-mono text-[10px] text-file-media">{t.at}</span>
              <p className="text-[12px] leading-6 text-muted-foreground">{t.text}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (file.json) {
    return (
      <pre className="soft-scroll max-h-[420px] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-6 text-muted-foreground">{file.json}</pre>
    );
  }
  return (
    <div className="space-y-2">
      {["pricing-summary.md", "competitor-pricing.csv", "pricing-chart.svg", "raw-payload.json", "analyze.ts", "report.tsx", "README.md"].map((n) => (
        <div key={n} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-[11px]">
          <span className="font-mono">{n}</span>
          <span className="font-mono text-[10px] text-muted-foreground">已打包</span>
        </div>
      ))}
    </div>
  );
}

export function FileViewer({ file, onClose }: { file: StudioFile; onClose: () => void }) {
  const [tab, setTab] = useState<"预览" | "原始" | "信息">("预览");
  const style = kindStyles[file.kind];
  const Icon = style.icon;
  const raw = file.code?.content ?? file.json ?? file.doc?.excerpt ?? file.audio?.transcript.map((t) => `[${t.at}] ${t.text}`).join("\n") ?? file.table?.rows.map((r) => r.join(",")).join("\n") ?? "该类型没有可展示的文本内容。";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="glass flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <span className={`flex size-7 items-center justify-center rounded-md ring-1 ring-inset ${style.tint} ${style.text} ${style.ring}`}>
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium">{file.name}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">{file.path}</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="关闭预览" onClick={onClose}><X className="size-3.5" /></Button>
      </div>
      <div className="flex shrink-0 gap-0.5 border-b px-3 py-1.5">
        {(["预览", "原始", "信息"] as const).map((t) => (
          <Button
            key={t}
            variant="ghost"
            size="sm"
            onClick={() => setTab(t)}
            className={`h-7 px-2.5 text-[11px] shadow-none ${tab === t ? "bg-accent font-medium" : "text-muted-foreground"}`}
          >
            {t}
          </Button>
        ))}
      </div>
      <div className="soft-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "预览" && <div className="rise"><Preview file={file} /></div>}
        {tab === "原始" && (
          <pre className="soft-scroll overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-6 text-muted-foreground">{raw}</pre>
        )}
        {tab === "信息" && (
          <div className="space-y-1.5">
            {Object.entries({ 类型: style.label, 大小: file.size, 更新: file.updated, ...file.meta }).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-border/60 py-2 text-[11px]">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono">{v}</span>
              </div>
            ))}
            <div className="mt-4 rounded-md border bg-card p-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Agent 洞察</p>
              <p className="text-[11px] leading-6 text-muted-foreground">{file.summary}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
