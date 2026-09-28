import { useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Globe2, Maximize2, PanelRightClose, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileById, kindStyles, workspaceTree, type TreeNode } from "./files";
import { FileViewer } from "./FileViewer";

function Tree({ nodes, depth = 0, onOpen, activeId }: { nodes: TreeNode[]; depth?: number; onOpen: (id: string) => void; activeId?: string | undefined }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ reports: true, data: true });
  return (
    <div className="space-y-px">
      {nodes.map((node) => {
        if (node.kind === "dir") {
          const isOpen = open[node.name] ?? false;
          return (
            <div key={node.name}>
              <button
                type="button"
                onClick={() => setOpen((p) => ({ ...p, [node.name]: !isOpen }))}
                className="flex h-7 w-full items-center gap-1.5 rounded-sm px-1.5 text-left text-[11px] hover:bg-accent/70"
                style={{ paddingLeft: depth * 12 + 6 }}
              >
                {isOpen ? <ChevronDown className="size-3 text-muted-foreground" /> : <ChevronRight className="size-3 text-muted-foreground" />}
                {isOpen ? <FolderOpen className="size-3.5 text-warning" /> : <Folder className="size-3.5 text-warning" />}
                <span className="truncate">{node.name}</span>
              </button>
              {isOpen && node.children && <Tree nodes={node.children} depth={depth + 1} onOpen={onOpen} activeId={activeId} />}
            </div>
          );
        }
        const file = node.fileId ? fileById(node.fileId) : undefined;
        const style = file ? kindStyles[file.kind] : undefined;
        const Icon = style?.icon;
        return (
          <button
            key={node.name}
            type="button"
            onClick={() => node.fileId && onOpen(node.fileId)}
            className={`flex h-7 w-full items-center gap-1.5 rounded-sm px-1.5 text-left text-[11px] hover:bg-accent/70 ${activeId === node.fileId ? "bg-accent font-medium" : "text-muted-foreground"}`}
            style={{ paddingLeft: depth * 12 + 21 }}
          >
            {Icon && <Icon className={`size-3.5 shrink-0 ${style?.text}`} />}
            <span className="truncate">{node.name}</span>
            <span className="ml-auto shrink-0 font-mono text-[9px] opacity-60">{node.size}</span>
          </button>
        );
      })}
    </div>
  );
}

type TabType = "files" | "browser";
type PanelTab = { id: string; type: TabType };
const TABS_KEY = "relay-studio-panel-tabs-v1";
const defaultTabs: PanelTab[] = [{ id: "files-1", type: "files" }, { id: "browser-1", type: "browser" }];

const activity: [string, string, "done" | "now"][] = [
  ["已打开定价页面", "浏览器 · 2 秒前", "done"],
  ["提取价格信息", "浏览器 · 4 秒前", "done"],
  ["写入 pricing-summary.md", "文件 · 执行中", "now"],
];

export function WorkspacePanel({ openFileId, onOpenFile, onClose }: { openFileId?: string | undefined; onOpenFile: (id?: string | undefined) => void; onClose: () => void }) {
  const [tabs, setTabs] = useState<PanelTab[]>(defaultTabs);
  const [activeTab, setActiveTab] = useState<string>(defaultTabs[0]!.id);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TABS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { tabs: PanelTab[]; active?: string };
        if (Array.isArray(saved.tabs)) {
          setTabs(saved.tabs);
          setActiveTab(saved.active && saved.tabs.some((t) => t.id === saved.active) ? saved.active : saved.tabs[0]?.id ?? "");
        }
      }
    } catch { /* ignore */ }
  }, []);
  const persist = (next: PanelTab[], active: string) => {
    setTabs(next);
    setActiveTab(active);
    try { localStorage.setItem(TABS_KEY, JSON.stringify({ tabs: next, active })); } catch { /* ignore */ }
  };
  const current = tabs.find((t) => t.id === activeTab);
  const tab = current?.type;
  const select = (t: PanelTab) => { persist(tabs, t.id); if (t.type === "browser") onOpenFile(undefined); };
  const addTab = (type: TabType) => {
    const t = { id: `${type}-${Date.now().toString(36)}`, type };
    persist([...tabs, t], t.id);
    if (type === "browser") onOpenFile(undefined);
  };
  const removeTab = (id: string) => {
    const i = tabs.findIndex((t) => t.id === id);
    const next = tabs.filter((t) => t.id !== id);
    const active = id === activeTab ? (next[Math.max(0, i - 1)]?.id ?? "") : activeTab;
    persist(next, active);
  };
  const move = (from: string, to: string) => {
    if (from === to) return;
    const next = [...tabs];
    const fi = next.findIndex((t) => t.id === from);
    const [item] = next.splice(fi, 1);
    const ti = next.findIndex((t) => t.id === to);
    const toIdx = tabs.findIndex((t) => t.id === to) > fi ? ti + 1 : ti;
    next.splice(toIdx, 0, item!);
    persist(next, activeTab);
  };
  const file = openFileId ? fileById(openFileId) : undefined;
  return (
     <aside className="fixed inset-y-0 right-0 z-30 flex w-[min(100vw,440px)] min-w-0 flex-col bg-sidebar shadow-xl lg:static lg:w-auto lg:flex-1 lg:shadow-none">
       <div className="flex h-12 shrink-0 items-center gap-1 px-2">
         <div className="flex min-w-0 items-center gap-1 overflow-x-auto" role="tablist" aria-label="工作台页签">
           {tabs.map((t) => {
             const active = t.id === activeTab;
             const label = t.type === "files" ? "文件" : "浏览器";
             return (
               <div
                 key={t.id}
                 role="tab"
                 aria-selected={active}
                 tabIndex={0}
                 draggable
                 onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = "move"; }}
                 onDragOver={(e) => { e.preventDefault(); setOverId(t.id); }}
                 onDragLeave={() => setOverId((o) => (o === t.id ? null : o))}
                 onDrop={(e) => { e.preventDefault(); if (dragId) move(dragId, t.id); setDragId(null); setOverId(null); }}
                 onDragEnd={() => { setDragId(null); setOverId(null); }}
                 onClick={() => select(t)}
                 onKeyDown={(e) => { if (e.key === "Enter") select(t); }}
                 className={`group flex h-7 shrink-0 cursor-default select-none items-center gap-1.5 rounded-md pl-2 pr-1 text-[11px] transition-colors ${active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"} ${dragId === t.id ? "opacity-40" : ""} ${overId === t.id && dragId !== t.id ? "ring-1 ring-primary/40" : ""}`}
               >
                 {t.type === "files" ? <Folder className="size-3 text-warning" /> : <Globe2 className="size-3 text-primary" />}
                 {label}
                 <button
                   type="button"
                   aria-label={`关闭${label}页签`}
                   onClick={(e) => { e.stopPropagation(); removeTab(t.id); }}
                   className={`rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground ${active ? "" : "opacity-0 group-hover:opacity-100"}`}
                 >
                   <X className="size-2.5" />
                 </button>
               </div>
             );
           })}
         </div>
         <DropdownMenu>
           <DropdownMenuTrigger asChild>
             <Button variant="ghost" size="icon-sm" aria-label="新建页签"><Plus className="size-3.5" /></Button>
           </DropdownMenuTrigger>
           <DropdownMenuContent align="start" className="w-36">
             <DropdownMenuItem onClick={() => addTab("files")}><Folder className="size-3.5 text-warning" />文件</DropdownMenuItem>
             <DropdownMenuItem onClick={() => addTab("browser")}><Globe2 className="size-3.5 text-primary" />浏览器</DropdownMenuItem>
           </DropdownMenuContent>
         </DropdownMenu>
         <div className="ml-auto flex items-center gap-0.5">
           <Button variant="ghost" size="icon-sm" aria-label="收起工作台" onClick={onClose}><PanelRightClose className="size-3.5" /></Button>
           <Button variant="ghost" size="icon-sm" aria-label="最大化面板"><Maximize2 className="size-3.5" /></Button>
           <Button variant="ghost" size="icon-sm" aria-label="关闭工作台" onClick={onClose}><X className="size-3.5" /></Button>
         </div>
       </div>
       <div className="flex h-8 shrink-0 items-center border-b pl-3 pr-2">
         <p className="truncate font-mono text-[10px] text-muted-foreground">~/workspace/<span className="text-foreground">relay-studio</span></p>
         <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="刷新" onClick={() => onOpenFile(undefined)}><RotateCcw className="size-3" /></Button>
       </div>

      {!current && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[11px] text-muted-foreground">
          <p>没有打开的页签</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => addTab("files")}><Folder className="size-3.5" />文件</Button>
            <Button variant="outline" size="sm" onClick={() => addTab("browser")}><Globe2 className="size-3.5" />浏览器</Button>
          </div>
        </div>
      )}

      {tab === "files" && file && (
        <div className="min-h-0 flex-1"><FileViewer file={file} onClose={() => onOpenFile(undefined)} /></div>
      )}

      {tab === "files" && !file && (
         <div className="soft-scroll min-h-0 flex-1 overflow-y-auto p-5">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">工作区目录</p>
          <Tree nodes={workspaceTree} onOpen={(id) => onOpenFile(id)} activeId={openFileId} />
        </div>
      )}

      {tab === "browser" && (
        <div className="soft-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <div className="flex-1 truncate rounded-sm border bg-background px-2 py-1.5 font-mono text-[10px] text-muted-foreground">example.com/pricing</div>
          </div>
          <div className="agent-grid m-3 flex h-[240px] flex-col overflow-hidden rounded-md border bg-background">
            <div className="flex h-7 items-center gap-1 border-b bg-muted px-3">
              <span className="size-1.5 rounded-full bg-destructive/50" />
              <span className="size-1.5 rounded-full bg-warning/60" />
              <span className="size-1.5 rounded-full bg-success/60" />
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6">
              <div className="h-2 w-16 rounded-sm bg-border" />
              <div className="h-5 w-28 rounded-sm bg-secondary" />
              <div className="h-1.5 w-36 rounded-sm bg-border" />
              <div className="mt-2 flex gap-2">
                <div className="h-16 w-14 rounded border bg-muted" />
                <div className="h-16 w-14 rounded border border-success bg-success/5" />
                <div className="h-16 w-14 rounded border bg-muted" />
              </div>
            </div>
          </div>
          <div className="px-4 pb-4">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">实时活动</p>
            <div className="space-y-5 border-l border-border pl-4">
              {activity.map(([title, sub, s]) => (
                <div key={title} className="relative">
                  <div className={`absolute -left-[21px] top-1 size-2 rounded-full border-2 border-sidebar ${s === "done" ? "bg-success" : "bg-warning pulse-dot"}`} />
                  <p className="text-[11px] font-medium">{title}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
