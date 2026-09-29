import { useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { StudioFile } from "./files";

/** Preview actual image data when available; otherwise show the demo chart as a chart, not a fabricated image. */
export function ArtifactVisual({ file, compact = false }: { file: StudioFile; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const image = file.image;
  if (!image) return null;
  const chart = !image.src && file.id === "pricing-chart";
  const content = (large: boolean) => image.src ? (
    <img src={image.src} alt={image.caption} loading="lazy" className="mx-auto max-h-[70vh] max-w-full object-contain" style={{ transform: `scale(${large ? zoom : 1})` }} />
  ) : chart ? (
    <div className={`relay-artifact-chart ${large ? "relay-artifact-chart-large" : ""}`} role="img" aria-label={image.caption}>
      <div className="relay-chart-grid"><span>$40</span><span>$30</span><span>$20</span><span>$10</span><span>$0</span></div>
      <div className="relay-chart-bars">
        {[["Atlas", 25], ["Nova", 32], ["Loop", 22]].map(([name, amount], i) => <div key={name} className="relay-chart-column"><span className="relay-chart-value">${amount}</span><div className={`relay-chart-bar relay-chart-bar-${i}`} style={{ height: `${Number(amount) / 40 * 100}%` }}/><span className="relay-chart-label">{name}</span></div>)}
      </div>
    </div>
  ) : <div className="flex min-h-28 items-center justify-center bg-muted/40 text-sm text-muted-foreground">暂无可预览的图像</div>;
  return <>
    <div className="group/visual relative overflow-hidden rounded-md border bg-background">
      <div className={compact ? "p-2" : "p-4"}>{content(false)}</div>
      {!compact && <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-card/70 px-3 py-2 text-[11px] text-muted-foreground"><span className="min-w-0 truncate">{image.caption}</span><span className="shrink-0 font-mono">{image.width} × {image.height} · {file.size}</span></div>}
      <Button type="button" variant="outline" size="icon-sm" title="放大预览" aria-label={`放大预览 ${file.name}`} onClick={e => { e.stopPropagation(); setZoom(1); setOpen(true); }} className="absolute right-2 top-2 size-7 border-border/80 bg-card/90 opacity-0 transition-opacity group-hover/visual:opacity-100 focus:opacity-100"><Maximize2 className="size-3.5"/></Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="flex max-h-[90vh] max-w-[min(94vw,1100px)] flex-col overflow-hidden p-0"><DialogTitle className="border-b px-5 py-4 text-sm">{file.name}</DialogTitle><div className="soft-scroll min-h-0 flex-1 overflow-auto bg-background p-6"><div className="mx-auto max-w-[900px] overflow-hidden">{content(true)}</div></div><div className="flex items-center justify-between border-t px-5 py-2 text-xs text-muted-foreground"><span>{image.caption}</span>{image.src && <div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon-sm" aria-label="缩小" onClick={() => setZoom(v => Math.max(.5, v - .25))}><Minus className="size-4"/></Button><span className="w-12 text-center font-mono">{Math.round(zoom * 100)}%</span><Button type="button" variant="ghost" size="icon-sm" aria-label="放大" onClick={() => setZoom(v => Math.min(2, v + .25))}><Plus className="size-4"/></Button></div>}</div></DialogContent></Dialog>
  </>;
}