import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Hash, Rows3, Rows4, Search, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StudioFile } from "./files";

const num = (v: string) => { const n = Number(v.replace(/[$,%\s≥≤~]/g, "")); return v.trim() !== "" && Number.isFinite(n) ? n : null; };

/** Table viewer: column profiles, sort, filter, density and TSV copy. */
export function DataPreview({ file }: { file: StudioFile }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ column: number; desc: boolean } | null>(null);
  const [dense, setDense] = useState(false);
  const [copied, setCopied] = useState(false);
  const table = file.table;
  const profiles = useMemo(() => table?.columns.map((_, j) => {
    const vals = table.rows.map(r => r[j] ?? ""), nums = vals.map(num).filter((n): n is number => n !== null);
    const numeric = nums.length >= vals.length * 0.7 && nums.length > 0;
    return { numeric, min: numeric ? Math.min(...nums) : 0, max: numeric ? Math.max(...nums) : 0, distinct: new Set(vals).size };
  }) ?? [], [table]);
  const rows = useMemo(() => {
    if (!table) return [];
    const q = query.trim().toLowerCase();
    const filtered = table.rows.filter(row => !q || row.some(cell => cell.toLowerCase().includes(q)));
    return sort ? [...filtered].sort((a, b) => {
      const c = (a[sort.column] ?? "").localeCompare(b[sort.column] ?? "", undefined, { numeric: true, sensitivity: "base" });
      return sort.desc ? -c : c;
    }) : filtered;
  }, [table, query, sort]);
  if (!table) return null;
  const copy = async () => { await navigator.clipboard.writeText([table.columns, ...rows].map(r => r.join("\t")).join("\n")); setCopied(true); setTimeout(() => setCopied(false), 1400); };
  const pad = dense ? "py-1" : "py-2";
  return <section className="relay-data-preview overflow-hidden rounded-lg border bg-card">
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
      <span className="mr-auto flex items-center gap-2 font-mono text-[11px] text-muted-foreground"><span className="rounded border border-file-data/30 bg-file-data/10 px-1.5 py-0.5 text-[10px] text-file-data">TABLE</span>{table.columns.length} cols · {table.totalRows.toLocaleString()} rows</span>
      <div className="relative min-w-0 flex-1 sm:max-w-44"><Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"/><Input aria-label="筛选表格" value={query} onChange={e => setQuery(e.target.value)} placeholder="筛选当前预览" className="h-7 bg-background pl-7 text-xs"/></div>
      <Button variant="ghost" size="icon-sm" title={dense ? "舒适行高" : "紧凑行高"} aria-label="切换行高" onClick={() => setDense(d => !d)}>{dense ? <Rows3 className="size-3.5"/> : <Rows4 className="size-3.5"/>}</Button>
      <Button variant="ghost" size="icon-sm" title="复制可见数据" aria-label="复制可见数据" onClick={copy}><Copy className={`size-3.5 ${copied ? "text-success" : ""}`}/></Button>
    </div>
    <div className="soft-scroll max-h-[480px] overflow-auto">
      <table className="w-full min-w-max border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr><th scope="col" className="w-11 border-b px-3 py-2 text-right font-mono text-[10px] font-normal text-muted-foreground">#</th>{table.columns.map((c, j) => { const p = profiles[j]; return <th scope="col" key={`${c}-${j}`} className={`border-b px-3 py-2 align-top ${p?.numeric ? "text-right" : ""}`}>
            <Button variant="ghost" size="sm" className={`h-auto gap-1.5 p-0 text-[11px] font-semibold hover:bg-transparent ${p?.numeric ? "ml-auto flex" : "justify-start"}`} onClick={() => setSort(s => s?.column === j ? { column: j, desc: !s.desc } : { column: j, desc: false })}>
              {p?.numeric ? <Hash className="size-3 text-file-data"/> : <Type className="size-3 text-muted-foreground"/>}{c}{sort?.column === j && (sort.desc ? <ArrowDown className="size-3 text-primary"/> : <ArrowUp className="size-3 text-primary"/>)}
            </Button>
            <div className="mt-1 font-mono text-[9.5px] font-normal text-muted-foreground/80">{p?.numeric ? `${p.min.toLocaleString()} – ${p.max.toLocaleString()}` : `${p?.distinct ?? 0} distinct`}</div>
          </th>; })}</tr>
        </thead>
        <tbody>{rows.map((row, i) => <tr key={`${row.join("-")}-${i}`} className="transition-colors hover:bg-primary/5">
          <td className={`border-b border-border/50 px-3 ${pad} text-right font-mono text-[10px] text-muted-foreground`}>{i + 1}</td>
          {table.columns.map((column, j) => { const p = profiles[j], v = row[j] ?? "", n = p?.numeric ? num(v) : null; const w = n !== null && p && p.max > p.min ? (n - p.min) / (p.max - p.min) : 0;
            return <td key={`${column}-${j}`} className={`relative max-w-56 border-b border-border/50 px-3 ${pad} text-[11px] ${p?.numeric ? "text-right font-mono tabular-nums text-foreground" : "text-foreground/85"}`}>
              {n !== null && <span aria-hidden className="absolute inset-y-1 right-0 rounded-l bg-file-data/10" style={{ width: `${Math.max(w * 100, 4)}%` }}/>}
              <span className="relative">{v || "—"}</span>
            </td>; })}
        </tr>)}</tbody>
      </table>
      {!rows.length && <p className="p-6 text-center text-xs text-muted-foreground">没有匹配的数据</p>}
    </div>
    <div className="flex justify-between border-t bg-muted/30 px-3 py-2 font-mono text-[10px] text-muted-foreground"><span>预览 {rows.length} / {table.rows.length} 行</span><span>文件共 {table.totalRows.toLocaleString()} 行</span></div>
  </section>;
}
