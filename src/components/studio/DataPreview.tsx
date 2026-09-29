import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StudioFile } from "./files";

export function DataPreview({ file }: { file: StudioFile }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ column: number; desc: boolean } | null>(null);
  const table = file.table;
  const rows = useMemo(() => {
    if (!table) return [];
    const filtered = table.rows.filter(row => row.some(cell => cell.toLowerCase().includes(query.trim().toLowerCase())));
    return sort ? [...filtered].sort((a, b) => {
      const left = a[sort.column] ?? "", right = b[sort.column] ?? "";
      const comparison = left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
      return sort.desc ? -comparison : comparison;
    }) : filtered;
  }, [table, query, sort]);
  if (!table) return null;
  const copy = () => navigator.clipboard.writeText([table.columns, ...rows].map(row => row.join("\t")).join("\n"));
  return <section className="relay-data-preview overflow-hidden rounded-md border bg-card">
    <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2.5">
      <span className="mr-auto font-mono text-[11px] text-muted-foreground">{table.columns.length} 列 / {table.totalRows.toLocaleString()} 行</span>
      <div className="relative min-w-0 flex-1 sm:max-w-44"><Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"/><Input aria-label="筛选表格" value={query} onChange={e => setQuery(e.target.value)} placeholder="筛选当前预览" className="h-7 bg-background pl-7 text-xs"/></div>
      <Button variant="ghost" size="icon-sm" title="复制可见数据" aria-label="复制可见数据" onClick={copy}><Copy className="size-3.5"/></Button>
    </div>
    <div className="soft-scroll max-h-[480px] overflow-auto">
      <table className="w-full min-w-max border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-muted"><tr><th scope="col" className="w-11 border-b px-3 py-2 text-right font-mono text-[10px] font-normal text-muted-foreground">#</th>{table.columns.map((c, j) => <th scope="col" key={`${c}-${j}`} className="border-b px-3 py-2"><Button variant="ghost" size="sm" className="h-auto justify-start gap-1.5 p-0 text-[11px] font-semibold hover:bg-transparent" onClick={() => setSort(s => s?.column === j ? { column: j, desc: !s.desc } : { column: j, desc: false })}>{c}{sort?.column === j && (sort.desc ? <ArrowDown className="size-3 text-primary"/> : <ArrowUp className="size-3 text-primary"/>)}</Button></th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={`${row.join("-")}-${i}`} className="transition-colors hover:bg-primary/5"><td className="border-b border-border/50 px-3 py-2 text-right font-mono text-[10px] text-muted-foreground">{i + 1}</td>{table.columns.map((column, j) => <td key={`${column}-${j}`} className="max-w-56 border-b border-border/50 px-3 py-2 text-[11px] text-foreground/85">{row[j] ?? "—"}</td>)}</tr>)}</tbody>
      </table>
      {!rows.length && <p className="p-6 text-center text-xs text-muted-foreground">没有匹配的数据</p>}
    </div>
    <div className="border-t bg-muted/30 px-3 py-2 font-mono text-[10px] text-muted-foreground">当前预览 {rows.length} / {table.rows.length} 行 · 文件共 {table.totalRows.toLocaleString()} 行</div>
  </section>;
}