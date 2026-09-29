import { CodeBlock } from "@/components/ai-elements/code-block";
import type { BundledLanguage } from "shiki";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { kindStyles, type StudioFile } from "./files";
import { ArchiveViewer, AudioViewer, DocViewer, ImageViewer, JsonViewer } from "./ArtifactViewers";
import { DataPreview } from "./DataPreview";

function Preview({ file }: { file: StudioFile }) {
  if (file.doc) return <DocViewer file={file} />;
  if (file.table) {
    return <DataPreview file={file} />;
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
      <div className="overflow-hidden rounded-lg border border-[color:var(--code-border)] bg-[color:var(--code-bg)]">
        <div className="flex items-center gap-2 border-b border-[color:var(--code-border)] bg-[color:var(--code-header)] px-3 py-1.5 font-mono text-[10px] text-[color:var(--code-muted)]">
          <span>{file.path}</span>
          <span className="ml-auto uppercase">{file.code.language}</span>
        </div>
        <div className="soft-scroll max-h-[520px] overflow-auto [&_pre]:text-[11.5px] [&_code]:text-[11.5px]"><CodeBlock code={file.code.content} language={file.code.language as BundledLanguage} showLineNumbers className="rounded-none border-0 shadow-none"/></div>
      </div>
    );
  }
  if (file.image) return <ImageViewer file={file} />;
  if (file.audio) return <AudioViewer file={file} />;
  if (file.json) return <JsonViewer json={file.json} />;
  return <ArchiveViewer file={file} />;
}

export function FileViewer({ file, onClose }: { file: StudioFile; onClose: () => void }) {
  const [tab, setTab] = useState<"预览" | "原始" | "信息">("预览");
  const style = kindStyles[file.kind];
  const Icon = style.icon;
  const raw = file.code?.content ?? file.json ?? file.doc?.excerpt ?? file.audio?.transcript.map((t) => `[${t.at}] ${t.text}`).join("\n") ?? (file.table ? [file.table.columns, ...file.table.rows].map(row => row.map(cell => /[,"\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell).join(",")).join("\n") : undefined) ?? "该类型没有可展示的文本内容。";
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
          <CodeBlock code={raw} language={(file.code?.language ?? (file.json ? "json" : file.table ? "csv" : "text")) as BundledLanguage} showLineNumbers/>
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
