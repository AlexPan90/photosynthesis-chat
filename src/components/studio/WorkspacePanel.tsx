import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Globe2, PanelRightClose, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demoFiles, fileById, kindStyles, workspaceTree, type TreeNode } from "./files";
import { FileViewer } from "./FileViewer";

function Tree({ nodes, depth = 0, onOpen, activeId }: { nodes: TreeNode[]; depth?: number; onOpen: (id: string) => void; activeId?: string }) {
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

const activity: [string, string, "done" | "now"][] = [
  ["已打开定价页面", "浏览器 · 2 秒前", "done"],
  ["提取价格信息", "浏览器 · 4 秒前", "done"],
  ["写入 pricing-summary.md", "文件 · 执行中", "now"],
];

export function WorkspacePanel({ openFileId, onOpenFile, onClose }: { openFileId?: string; onOpenFile: (id?: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"文件" | "浏览器">("文件");
  const file = openFileId ? fileById(openFileId) : undefined;
  const changed = demoFiles.filter((f) => f.badge);
  return (
    <aside className="hidden w-[344px] shrink-0 flex-col border-l bg-sidebar/60 xl:flex">
      <div className="glass flex h-12 shrink-0 items-center gap-1 border-b px-3">
        <div className="flex items-center gap-0.5 rounded-md border bg-muted/60 p-0.5">
          {(["文件", "浏览器"] as const).map((t) => (
            <Button
              key={t}
              variant="ghost"
              size="sm"
              onClick={() => { setTab(t); if (t === "浏览器") onOpenFile(undefined); }}
              className={`h-6 px-2 text-[11px] shadow-none ${tab === t ? "bg-background" : "text-muted-foreground"}`}
            >
              {t === "文件" ? <Folder className="mr-1 size-3" /> : <Globe2 className="mr-1 size-3" />}
              {t}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="刷新工作区" className="ml-auto"><RefreshCw className="size-3.5" /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="收起工作台" onClick={onClose}><PanelRightClose className="size-3.5" /></Button>
      </div>

      {tab === "文件" && file && (
        <div className="min-h-0 flex-1"><FileViewer file={file} onClose={() => onOpenFile(undefined)} /></div>
      )}

      {tab === "文件" && !file && (
        <div className="soft-scroll min-h-0 flex-1 overflow-y-auto p-3">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">工作区目录</p>
          <Tree nodes={workspaceTree} onOpen={(id) => onOpenFile(id)} activeId={openFileId} />
          <p className="mb-2 mt-5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">本次会话变更 · {changed.length}</p>
          <div className="space-y-1">
            {changed.map((f) => {
              const style = kindStyles[f.kind];
              const Icon = style.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onOpenFile(f.id)}
                  className="lift flex w-full items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-left"
                >
                  <Icon className={`size-3.5 shrink-0 ${style.text}`} />
                  <span className="min-w-0 flex-1 truncate text-[11px]">{f.name}</span>
                  <span className={`shrink-0 rounded-sm px-1 py-px font-mono text-[9px] ${f.badge === "new" ? "bg-success/12 text-success" : "bg-warning/14 text-warning"}`}>
                    {f.badge === "new" ? "NEW" : "EDIT"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === "浏览器" && (
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
