import { useMemo, useRef, useState } from "react";
import { Archive, Check, ChevronLeft, ChevronRight, Copy, ScanText, FileCode2, FileText, Image as ImageIcon, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudioFile } from "./files";
import { ArtifactVisual } from "./ArtifactVisual";

const inline = (t: string) => t.split(/(\*\*[^*]+\*\*)/).map((x, i) => x.startsWith("**") ? <strong key={i} className="font-semibold text-foreground">{x.slice(2, -2)}</strong> : x);
const plain = (t: string) => t.replace(/\*\*/g, "").replace(/^(## |> |- )/gm, "");

function CopyText({ text, label = "复制文本" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); }} className={`flex h-6 items-center gap-1 rounded-md border px-2 text-[10.5px] transition ${done ? "border-success/40 text-success" : "text-muted-foreground hover:text-foreground"}`}>{done ? <Check className="size-3"/> : <Copy className="size-3"/>}{done ? "已复制" : label}</button>;
}

/** Image viewer: stage, backdrop thumbnails, facts, palette and extracted text. */
export function ImageViewer({ file }: { file: StudioFile }) {
  const [bg, setBg] = useState<"grid" | "dark" | "light">("grid");
  const image = file.image;
  if (!image) return null;
  const ratio = (() => { const g = (a: number, b: number): number => b ? g(b, a % b) : a; const d = g(image.width, image.height); return `${image.width / d}:${image.height / d}`; })();
  const text = image.text ?? [image.caption];
  return <div className="space-y-3">
    <div className={`relay-stage relay-stage-${bg} rounded-lg border p-3`}><ArtifactVisual file={file}/></div>
    <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="预览背景">
      {(["grid", "dark", "light"] as const).map(k => <button key={k} type="button" role="tab" aria-selected={bg === k} onClick={() => setBg(k)} className={`relay-thumb group overflow-hidden rounded-lg border text-left transition ${bg === k ? "relay-thumb-active" : ""}`}>
        <div className={`relay-stage relay-stage-${k} pointer-events-none h-16 p-1.5`}><div className="origin-top-left scale-[.5] w-[200%]"><ArtifactVisual file={file} compact/></div></div>
        <div className="border-t bg-card px-2 py-1 font-mono text-[10px] text-muted-foreground group-aria-selected:text-foreground">{k === "grid" ? "透明格" : k === "dark" ? "深底" : "浅底"}</div>
      </button>)}
    </div>
    <div className="grid grid-cols-3 gap-2">
      {[["尺寸", `${image.width}×${image.height}`], ["比例", ratio], ["大小", file.size]].map(([k, v]) => <div key={k} className="rounded-lg border bg-card px-3 py-2"><div className="text-[10px] text-muted-foreground">{k}</div><div className="mt-0.5 truncate font-mono text-[12px] font-semibold text-foreground">{v}</div></div>)}
    </div>
    {image.palette.length > 0 && <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">配色</div>
      <div className="flex gap-2">{image.palette.map(c => { const name = c.replace(/^var\(--color-|\)$/g, ""); return <button key={c} type="button" title={`复制 ${name}`} onClick={() => navigator.clipboard.writeText(name)} className="group min-w-0 flex-1"><span className="block h-8 rounded-md border border-foreground/10 shadow-sm" style={{ background: c }}/><span className="mt-1 block truncate font-mono text-[9.5px] text-muted-foreground group-hover:text-foreground">{name}</span></button>; })}</div>
    </div>}
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2"><span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><ScanText className="size-3.5"/>提取文本 · {text.length} 行</span><CopyText text={text.join("\n")}/></div>
      <ol className="relay-extract px-3 py-2 font-mono text-[11.5px] leading-6">{text.map((t, i) => <li key={i} className="flex gap-3"><span className="w-4 shrink-0 text-right text-muted-foreground/60">{i + 1}</span><span className="text-foreground/90">{t}</span></li>)}</ol>
    </div>
  </div>;
}

/** Document viewer: page thumbnails, one page per section, pager and plain-text extraction. */
export function DocViewer({ file }: { file: StudioFile }) {
  const doc = file.doc;
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<"read" | "text">("read");
  const pages = useMemo(() => {
    if (!doc) return [];
    const out: string[][] = [];
    for (const b of doc.excerpt.split("\n\n")) { if (b.startsWith("## ") || !out.length) out.push([]); out[out.length - 1]!.push(b); }
    return out;
  }, [doc]);
  if (!doc) return null;
  const total = pages.length;
  const cur = pages[Math.min(page, total - 1)] ?? [];
  const allText = pages.map(p => p.map(plain).join("\n")).join("\n\n");
  const words = allText.replace(/\s/g, "").length;
  const go = (n: number) => setPage(Math.max(0, Math.min(total - 1, n)));
  const renderBlock = (b: string, i: number) => b.startsWith("## ") ? <h3 key={i} className="mb-3 border-b pb-2 text-[15px] font-semibold text-foreground">{b.slice(3)}</h3>
    : b.startsWith("> ") ? <blockquote key={i} className="my-4 rounded-r-md border-l-2 border-file-doc bg-file-doc/8 px-4 py-2 text-foreground/85">{inline(b.slice(2))}</blockquote>
    : b.split("\n").every(l => l.startsWith("- ")) ? <ul key={i} className="my-3 space-y-1 pl-4">{b.split("\n").map(l => <li key={l} className="list-disc text-foreground/85 marker:text-file-doc">{inline(l.slice(2))}</li>)}</ul>
    : <p key={i} className="mb-3 text-foreground/85">{inline(b)}</p>;
  return <div className="space-y-3" onKeyDown={e => { if (e.key === "ArrowRight") go(page + 1); if (e.key === "ArrowLeft") go(page - 1); }}>
    <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
      <span className="rounded border border-file-doc/30 bg-file-doc/10 px-1.5 py-0.5 text-file-doc">DOC</span>{total} 页 · 约 {words.toLocaleString()} 字 · 阅读 {Math.max(1, Math.round(words / 400))} 分钟
      <div className="ml-auto flex rounded-md border bg-card p-0.5">{(["read", "text"] as const).map(m => <button key={m} type="button" onClick={() => setMode(m)} className={`rounded px-2 py-0.5 ${mode === m ? "bg-accent text-foreground" : "hover:text-foreground"}`}>{m === "read" ? "阅读" : "纯文本"}</button>)}</div>
    </div>
    {mode === "read" ? <>
      <div className="soft-scroll flex gap-2 overflow-x-auto pb-1" aria-label="页面缩略图">
        {pages.map((p, i) => <button key={i} type="button" onClick={() => go(i)} aria-label={`第 ${i + 1} 页`} aria-current={i === page} className={`relay-thumb relay-page-thumb shrink-0 ${i === page ? "relay-thumb-active" : ""}`}>
          <div className="relay-page-mini">
            <div className="line-clamp-2 text-[6.5px] font-semibold leading-[1.3] text-foreground">{p[0]?.replace(/^## /, "")}</div>
            {Array.from({ length: 6 }).map((_, j) => <span key={j} className="mt-1 block h-[2px] rounded-full bg-foreground/15" style={{ width: `${60 + ((i * 7 + j * 13) % 38)}%` }}/>)}
          </div>
          <span className="block py-0.5 text-center font-mono text-[9.5px] text-muted-foreground">{i + 1}</span>
        </button>)}
      </div>
      <article className="relay-doc relay-page rounded-lg border px-6 py-6 text-[13px] leading-[1.9]">
        {cur.map(renderBlock)}
        <div className="mt-6 text-right font-mono text-[10px] text-muted-foreground">— {page + 1} / {total} —</div>
      </article>
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled={page === 0} onClick={() => go(page - 1)}><ChevronLeft className="size-3.5"/>上一页</Button>
        <span className="font-mono text-[11px] text-muted-foreground"><span className="text-foreground">{page + 1}</span> / {total}</span>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled={page >= total - 1} onClick={() => go(page + 1)}>下一页<ChevronRight className="size-3.5"/></Button>
      </div>
    </> : <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2"><span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><ScanText className="size-3.5"/>提取文本 · {allText.split("\n").filter(Boolean).length} 行</span><CopyText text={allText}/></div>
      <pre className="relay-extract soft-scroll max-h-[520px] overflow-auto whitespace-pre-wrap px-3 py-3 font-mono text-[11.5px] leading-6 text-foreground/90">{allText}</pre>
    </div>}
  </div>;
}

type Node = { key: string; label: string; value?: unknown; children?: Node[] };
const toNodes = (v: unknown, key = "root"): Node => Array.isArray(v) ? { key, label: `[${v.length}]`, children: v.map((x, i) => toNodes(x, String(i))) }
  : v && typeof v === "object" ? { key, label: `{${Object.keys(v).length}}`, children: Object.entries(v).map(([k, x]) => toNodes(x, k)) } : { key, label: "", value: v };

function JsonNode({ node, depth }: { node: Node; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const v = node.value, cls = typeof v === "string" ? "text-success" : typeof v === "number" ? "text-file-data" : typeof v === "boolean" ? "text-primary" : "text-muted-foreground";
  return <div style={{ paddingLeft: depth ? 14 : 0 }} className={depth ? "border-l border-border/60" : ""}>
    {node.children ? <>
      <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent/50"><ChevronRight className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}/><span className="text-foreground">{node.key}</span><span className="text-muted-foreground/70">{node.label}</span></button>
      {open && node.children.map(c => <JsonNode key={c.key} node={c} depth={depth + 1}/>)}
    </> : <div className="flex gap-1.5 px-1 py-0.5 pl-5"><span className="text-foreground/80">{node.key}:</span><span className={`break-all ${cls}`}>{typeof v === "string" ? `"${v}"` : String(v)}</span></div>}
  </div>;
}

/** JSON viewer: collapsible, type-colored tree. */
export function JsonViewer({ json }: { json: string }) {
  const tree = useMemo(() => { try { return toNodes(JSON.parse(json)); } catch { return null; } }, [json]);
  if (!tree) return <pre className="rounded-lg border bg-card p-3 font-mono text-[11px]">{json}</pre>;
  return <div className="rounded-lg border bg-card">
    <div className="flex items-center gap-2 border-b px-3 py-2 font-mono text-[10.5px] text-muted-foreground"><span className="rounded border border-file-data/30 bg-file-data/10 px-1.5 py-0.5 text-file-data">JSON</span>{tree.label} · 点击节点展开/折叠</div>
    <div className="soft-scroll max-h-[520px] overflow-auto p-2 font-mono text-[11.5px] leading-5"><JsonNode node={tree} depth={0}/></div>
  </div>;
}

/** Audio viewer: scrub-able waveform with transcript following the playhead (narration via speech synthesis preview). */
export function AudioViewer({ file }: { file: StudioFile }) {
  const audio = file.audio; const [pos, setPos] = useState(0.3); const [playing, setPlaying] = useState(false);
  if (!audio) return null;
  const active = Math.min(audio.transcript.length - 1, Math.floor(pos * audio.transcript.length));
  const toggle = () => { if (typeof speechSynthesis === "undefined") return; if (playing) { speechSynthesis.cancel(); setPlaying(false); return; } const u = new SpeechSynthesisUtterance(audio.transcript.slice(active).map(t => t.text).join("。")); u.lang = "zh-CN"; u.onend = () => setPlaying(false); speechSynthesis.speak(u); setPlaying(true); };
  return <div className="space-y-3">
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <Button size="icon-sm" className="relay-send size-9 shrink-0" aria-label={playing ? "停止" : "朗读预览"} onClick={toggle}>{playing ? <Pause className="size-4"/> : <Play className="size-4"/>}</Button>
        <div role="slider" aria-label="播放位置" aria-valuenow={Math.round(pos * 100)} tabIndex={0} onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setPos((e.clientX - r.left) / r.width); }} className="flex h-12 flex-1 cursor-pointer items-center gap-[3px]">
          {audio.wave.map((h, i) => <span key={i} className={`flex-1 rounded-full transition-colors ${i / audio.wave.length < pos ? "bg-file-media" : "bg-file-media/25"}`} style={{ height: `${Math.max(12, h)}%` }}/>)}
        </div>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{audio.duration}</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground/70">朗读预览使用浏览器语音合成，非原始录音。</p>
    </div>
    <div className="space-y-1">{audio.transcript.map((t, i) => <button key={t.at} type="button" onClick={() => setPos(i / audio.transcript.length + 0.001)} className={`flex w-full gap-3 rounded-md px-3 py-2 text-left transition-colors ${i === active ? "bg-file-media/10 ring-1 ring-inset ring-file-media/30" : "hover:bg-accent/50"}`}>
      <span className="shrink-0 font-mono text-[10px] text-file-media">{t.at}</span><p className={`text-[12px] leading-6 ${i === active ? "text-foreground" : "text-muted-foreground"}`}>{t.text}</p>
    </button>)}</div>
  </div>;
}

const ARCHIVE = [["reports/pricing-summary.md", "14.2 KB"], ["data/competitor-pricing.csv", "38.6 KB"], ["data/raw-payload.json", "6.1 KB"], ["src/pipeline/analyze.ts", "4.1 KB"], ["src/views/report.tsx", "2.6 KB"], ["assets/pricing-chart.svg", "212 KB"], ["README.md", "1.2 KB"]];
/** Archive viewer: contents grouped by folder with type icons. */
export function ArchiveViewer({ file }: { file: StudioFile }) {
  const groups = ARCHIVE.reduce<Record<string, string[][]>>((m, e) => { const p = e[0] ?? ""; const d = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "/"; (m[d] ??= []).push(e); return m; }, {});
  const icon = (n: string) => /\.(ts|tsx|json)$/.test(n) ? FileCode2 : /\.(svg|png|jpg)$/.test(n) ? ImageIcon : FileText;
  return <div className="rounded-lg border bg-card">
    <div className="flex items-center gap-2 border-b px-3 py-2.5"><Archive className="size-4 text-muted-foreground"/><span className="font-mono text-[11px]">{file.name}</span><span className="ml-auto font-mono text-[10.5px] text-muted-foreground">{ARCHIVE.length} 项 · {file.size}</span></div>
    <div className="p-2 font-mono text-[11.5px]">{Object.entries(groups).map(([d, items]) => <div key={d} className="mb-1">
      <div className="px-2 py-1 text-[10.5px] text-muted-foreground">{d}</div>
      {items.map(([p = "", s]) => { const I = icon(p); return <div key={p} className="flex items-center gap-2 rounded px-2 py-1 pl-5 hover:bg-accent/50"><I className="size-3.5 text-muted-foreground"/><span className="min-w-0 flex-1 truncate">{p.split("/").pop()}</span><span className="text-[10px] text-muted-foreground">{s}</span></div>; })}
    </div>)}</div>
  </div>;
}
