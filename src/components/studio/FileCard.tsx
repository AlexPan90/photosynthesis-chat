import { ArrowUpRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { kindStyles, type StudioFile } from "./files";
import { ArtifactVisual } from "./ArtifactVisual";

function Badge({ badge }: { badge?: StudioFile["badge"] }) {
  if (!badge) return null;
  const isNew = badge === "new";
  return (
    <span className={`rounded-sm px-1.5 py-px font-mono text-[9px] font-semibold tracking-wide ${isNew ? "bg-success/12 text-success" : "bg-warning/14 text-warning"}`}>
      {isNew ? "NEW" : "EDITED"}
    </span>
  );
}

function Peek({ file }: { file: StudioFile }) {
  if (file.table) {
    return (
      <div className="overflow-hidden rounded-sm border border-border/70">
        <table className="w-full table-fixed border-collapse text-[10px]">
          <thead>
            <tr className="bg-muted/70 text-muted-foreground">
              {file.table.columns.slice(0, 4).map((c) => (
                <th key={c} className="truncate px-2 py-1 text-left font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            {file.table.rows.slice(0, 3).map((row, i) => (
              <tr key={i} className={i % 2 ? "bg-muted/25" : ""}>
                {row.slice(0, 4).map((cell, j) => (
                  <td key={j} className="truncate px-2 py-1 text-muted-foreground">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (file.diff) {
    return (
      <div className="overflow-hidden rounded-sm border border-border/70 bg-muted/30 font-mono text-[10px] leading-5">
        {file.diff.lines.slice(0, 4).map((line, i) => (
          <div
            key={i}
            className={`flex gap-2 px-2 ${line.type === "add" ? "bg-success/10 text-success" : line.type === "del" ? "bg-destructive/10 text-destructive" : "text-muted-foreground"}`}
          >
            <span className="select-none opacity-60">{line.type === "add" ? "+" : line.type === "del" ? "-" : " "}</span>
            <span className="truncate">{line.text}</span>
          </div>
        ))}
      </div>
    );
  }
  if (file.code) {
    return (
      <div className="overflow-hidden rounded-sm border border-border/70 bg-muted/30 px-2 py-1.5 font-mono text-[10px] leading-5 text-muted-foreground">
        {file.code.content.split("\n").slice(0, 4).map((line, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="w-3 shrink-0 select-none text-right opacity-45">{i + 1}</span>
            <span className="truncate">{line || " "}</span>
          </div>
        ))}
      </div>
    );
  }
  if (file.image) {
    return <ArtifactVisual file={file} compact />;
  }
  if (file.audio) {
    return (
      <div className="flex items-center gap-2.5 rounded-sm border border-border/70 bg-muted/30 px-2.5 py-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-file-media/15 text-file-media">
          <Play className="size-3" />
        </span>
        <div className="flex h-6 flex-1 items-center gap-[2px]">
          {file.audio.wave.map((h, i) => (
            <span key={i} className="flex-1 rounded-full bg-file-media/45" style={{ height: `${Math.max(12, h)}%` }} />
          ))}
        </div>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{file.audio.duration}</span>
      </div>
    );
  }
  if (file.doc) {
    return (
      <div className="flex gap-2.5 rounded-sm border border-border/70 bg-muted/25 p-2.5">
        <div className="flex h-14 w-11 shrink-0 flex-col gap-1 rounded-sm border border-border/80 bg-background p-1.5 shadow-[0_2px_8px_-6px_var(--color-foreground)]">
          <span className="h-1 w-6 rounded-full bg-file-doc/60" />
          <span className="h-px w-full bg-border" />
          <span className="h-px w-full bg-border" />
          <span className="h-px w-2/3 bg-border" />
          <span className="h-px w-full bg-border" />
        </div>
        <p className="line-clamp-3 text-[11px] leading-5 text-muted-foreground">{file.doc.excerpt.replace(/[#>*\n]/g, " ").trim()}</p>
      </div>
    );
  }
  if (file.json) {
    return (
      <div className="overflow-hidden rounded-sm border border-border/70 bg-muted/30 px-2.5 py-1.5 font-mono text-[10px] leading-5 text-muted-foreground">
        {file.json.split("\n").slice(0, 4).map((line, i) => <div key={i} className="truncate">{line}</div>)}
      </div>
    );
  }
  return null;
}

export function FileCard({ file, onOpen }: { file: StudioFile; onOpen: (id: string) => void }) {
  const style = kindStyles[file.kind];
  const Icon = style.icon;
  return (
    <div className="relay-file-card lift group w-full rounded-lg border bg-card p-3 transition-colors hover:bg-accent/30">
      <Button type="button" variant="ghost" onClick={() => onOpen(file.id)} aria-label={`在工作台打开 ${file.name}`} className="h-auto w-full justify-start whitespace-normal p-0 text-left font-normal hover:bg-transparent">
      <div className="flex items-start gap-2.5">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ${style.tint} ${style.text} ${style.ring}`}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12px] font-medium">{file.name}</span>
            <Badge badge={file.badge} />
            <ArrowUpRight className="ml-auto size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
            {file.path} · {file.size} · {style.label}
          </p>
        </div>
      </div>
      </Button>
      <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-muted-foreground">{file.summary}</p>
      <div className="mt-2.5">
        <Peek file={file} />
      </div>
    </div>
  );
}
