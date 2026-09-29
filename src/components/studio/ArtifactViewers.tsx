import { useMemo, useRef, useState } from "react";
import { Archive, ChevronRight, FileCode2, FileText, Image as ImageIcon, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudioFile } from "./files";
import { ArtifactVisual } from "./ArtifactVisual";

/** Image viewer: stage with backdrop switch, palette and dimension facts. */
export function ImageViewer({ file }: { file: StudioFile }) {
  const [bg, setBg] = useState<"grid" | "dark" | "light">("grid");
  const image = file.image;
  if (!image) return null;
  const ratio = (() => { const g = (a: number, b: number): number => b ? g(b, a % b) : a; const d = g(image.width, image.height); return `${image.width / d}:${image.height / d}`; })();
  return <div className="space-y-3">
    <div className={`relay-stage relay-stage-${bg} rounded-lg border p-3`}><ArtifactVisual file={file}/></div>
    <div className="flex items-center gap-1 rounded-lg border bg-card p-1 text-[10.5px]">
      {(["grid", "dark", "light"] as const).map(k => <button key={k} type="button" onClick={() => setBg(k)} className={`flex-1 rounded-md px-2 py-1 font-mono uppercase ${bg === k ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{k === "grid" ? "透明格" : k === "dark" ? "深底" : "浅底"}</button>)}
    </div>
    <div className="grid grid-cols-3 gap-2">
      {[["尺寸", `${image.width}×${image.height}`], ["比例", ratio], ["大小", file.size]].map(([k, v]) => <div key={k} className="rounded-lg border bg-card px-3 py-2"><div className="text-[10px] text-muted-foreground">{k}</div><div className="mt-0.5 truncate font-mono text-[12px] font-semibold">{v}</div></div>)}
    </div>
    {image.palette.length > 0 && <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">配色</div>
      <div className="flex gap-2">{image.palette.map(c => <button key={c} type="button" title={`复制 ${c}`} onClick={() => navigator.clipboard.writeText(c)} className="group min-w-0 flex-1"><span className="block h-8 rounded-md border" style={{ background: c }}/><span className="mt-1 block truncate font-mono text-[9.5px] text-muted-foreground group-hover:text-foreground">{c}</span></button>)}</div>
    </div>}
  </div>;
}

/** Document viewer: reading column with jumpable outline. */
export function DocViewer({ file }: { file: StudioFile }) {
  const doc = file.doc, ref = useRef<HTMLElement>(null);
  if (!doc) return null;
  const blocks = doc.excerpt.split("\n\n");
  const words = doc.excerpt.replace(/\s/g, "").length;
  const jump = (t: string) => ref.current?.querySelector<HTMLElement>(`[data-h="${CSS.escape(t)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return <div className="space-y-3">
    <div className="flex items-center gap-3 font-mono text-[10.5px] text-muted-foreground"><span className="rounded border border-file-doc/30 bg-file-doc/10 px-1.5 py-0.5 text-file-doc">DOC</span>{doc.pages} 页 · 约 {words.toLocaleString()} 字 · 阅读 {Math.max(1, Math.round(words / 400))} 分钟</div>
    <nav className="rounded-lg border bg-card p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">大纲</p>
      <ol className="space-y-0.5">{doc.toc.map((t, i) => <li key={t}><button type="button" onClick={() => jump(t)} className="flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left text-[11.5px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"><span className="font-mono text-[10px] text-file-doc/80">{String(i + 1).padStart(2, "0")}</span>{t}</button></li>)}</ol>
    </nav>
    <article ref={ref} className="relay-doc rounded-lg border bg-background px-6 py-6 text-[13px] leading-[1.9]">
      {blocks.map((b, i) => b.startsWith("## ") ? <h3 key={i} data-h={b.slice(3)} className="mb-3 mt-6 scroll-mt-4 border-b pb-2 text-[15px] font-semibold first:mt-0">{b.slice(3)}</h3>
        : b.startsWith("> ") ? <blockquote key={i} className="my-4 rounded-r-md border-l-2 border-file-doc bg-file-doc/5 px-4 py-2 text-foreground/80">{b.slice(2)}</blockquote>
        : b.split("\n").every(l => l.startsWith("- ")) ? <ul key={i} className="my-3 space-y-1 pl-4">{b.split("\n").map(l => <li key={l} className="list-disc text-foreground/80 marker:text-file-doc">{l.slice(2)}</li>)}</ul>
        : <p key={i} className="mb-3 text-foreground/80">{b}</p>)}
    </article>
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
