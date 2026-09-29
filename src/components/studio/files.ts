import { FileArchive, FileAudio2, FileCode2, FileJson2, FileSpreadsheet, FileText, GitCompare, Image as ImageIcon, type LucideIcon } from "lucide-react";

export type FileKind = "code" | "diff" | "data" | "markdown" | "pdf" | "image" | "svg" | "audio" | "json" | "archive";

export type StudioFile = {
  id: string;
  name: string;
  path: string;
  kind: FileKind;
  size: string;
  updated: string;
  badge?: "new" | "edited";
  summary: string;
  meta: Record<string, string>;
  code?: { language: string; content: string };
  diff?: { added: number; removed: number; lines: { type: "add" | "del" | "ctx"; text: string }[] };
  table?: { columns: string[]; rows: string[][]; totalRows: number };
  doc?: { pages: number; toc: string[]; excerpt: string };
  image?: { width: number; height: number; caption: string; palette: string[]; src?: string };
  audio?: { duration: string; transcript: { at: string; text: string }[]; wave: number[] };
  json?: string;
};

type KindStyle = { label: string; icon: LucideIcon; tint: string; text: string; ring: string };

export const kindStyles: Record<FileKind, KindStyle> = {
  code: { label: "CODE", icon: FileCode2, tint: "bg-file-code/10", text: "text-file-code", ring: "ring-file-code/25" },
  diff: { label: "DIFF", icon: GitCompare, tint: "bg-file-code/10", text: "text-file-code", ring: "ring-file-code/25" },
  data: { label: "CSV", icon: FileSpreadsheet, tint: "bg-file-data/10", text: "text-file-data", ring: "ring-file-data/25" },
  json: { label: "JSON", icon: FileJson2, tint: "bg-file-data/10", text: "text-file-data", ring: "ring-file-data/25" },
  markdown: { label: "MD", icon: FileText, tint: "bg-file-doc/10", text: "text-file-doc", ring: "ring-file-doc/25" },
  pdf: { label: "PDF", icon: FileText, tint: "bg-file-doc/10", text: "text-file-doc", ring: "ring-file-doc/25" },
  image: { label: "PNG", icon: ImageIcon, tint: "bg-file-image/10", text: "text-file-image", ring: "ring-file-image/25" },
  svg: { label: "SVG", icon: ImageIcon, tint: "bg-file-image/10", text: "text-file-image", ring: "ring-file-image/25" },
  audio: { label: "AUDIO", icon: FileAudio2, tint: "bg-file-media/10", text: "text-file-media", ring: "ring-file-media/25" },
  archive: { label: "ZIP", icon: FileArchive, tint: "bg-file-archive/10", text: "text-file-archive", ring: "ring-file-archive/25" },
};

export const demoFiles: StudioFile[] = [
  {
    id: "pricing-summary",
    name: "pricing-summary.md",
    path: "reports/pricing-summary.md",
    kind: "markdown",
    size: "14.2 KB",
    updated: "09:44",
    badge: "new",
    summary: "五款 AI 工作台的定价结构对比，含免费版额度与团队版管理能力差异。",
    meta: { 字数: "2,480", 段落: "36", 语言: "简体中文" },
    doc: {
      pages: 6,
      toc: ["研究背景", "定价结构总览", "免费版额度对比", "团队版协作能力", "关键洞察", "建议"],
      excerpt:
        "## 定价结构总览\n\n五款产品均采用 **免费 / 个人 Pro / 团队 / 企业** 四层结构。差异主要落在额度计量方式上：三款按消息条数计量，两款按 token 与工具调用次数计量。\n\n> 团队版的溢价并非来自额度，而是来自 **共享工作空间、成员权限与用量看板**。",
    },
  },
  {
    id: "competitor-pricing",
    name: "competitor-pricing.csv",
    path: "data/competitor-pricing.csv",
    kind: "data",
    size: "38.6 KB",
    updated: "09:43",
    badge: "new",
    summary: "抓取自 5 个官网定价页的结构化数据，含 1,284 行记录与 8 个字段。",
    meta: { 行数: "1,284", 列数: "8", 编码: "UTF-8" },
    table: {
      columns: ["产品", "方案", "月费 (USD)", "席位", "额度", "工作空间"],
      rows: [
        ["Atlas AI", "Free", "0", "1", "50 条 / 月", "个人"],
        ["Atlas AI", "Team", "25", "≥3", "无限", "共享"],
        ["Nova Studio", "Free", "0", "1", "200K token", "个人"],
        ["Nova Studio", "Pro", "18", "1", "2M token", "个人"],
        ["Nova Studio", "Team", "32", "≥5", "10M token", "共享 + 看板"],
        ["Loop Works", "Free", "0", "1", "30 次工具调用", "个人"],
        ["Loop Works", "Team", "22", "≥2", "1,000 次 / 月", "共享"],
      ],
      totalRows: 1284,
    },
  },
  {
    id: "analyze-ts",
    name: "analyze.ts",
    path: "src/pipeline/analyze.ts",
    kind: "code",
    size: "4.1 KB",
    updated: "09:45",
    badge: "edited",
    summary: "定价数据归一化与分层聚合脚本，输出对比矩阵。",
    meta: { 语言: "TypeScript", 行数: "128", 依赖: "zod" },
    code: {
      language: "typescript",
      content: `import { z } from "zod";

const Plan = z.object({
  product: z.string(),
  tier: z.enum(["free", "pro", "team", "enterprise"]),
  monthly: z.number().nonnegative(),
  seats: z.number().int().positive(),
});

export function normalize(rows: unknown[]) {
  return rows
    .map((row) => Plan.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data);
}

export function perSeat(plans: ReturnType<typeof normalize>) {
  return plans.map((p) => ({
    ...p,
    unit: Number((p.monthly / p.seats).toFixed(2)),
  }));
}`,
    },
  },
  {
    id: "report-diff",
    name: "report.tsx",
    path: "src/views/report.tsx",
    kind: "diff",
    size: "2.6 KB",
    updated: "09:46",
    badge: "edited",
    summary: "报告视图改为分层表格渲染，并补充空数据提示。",
    meta: { 提交: "未提交", 变更: "+18 / −6", 冲突: "无" },
    diff: {
      added: 18,
      removed: 6,
      lines: [
        { type: "ctx", text: "export function Report({ plans }: Props) {" },
        { type: "del", text: "  return <pre>{JSON.stringify(plans)}</pre>;" },
        { type: "add", text: "  if (!plans.length) return <Empty label=\"暂无定价数据\" />;" },
        { type: "add", text: "  return (" },
        { type: "add", text: "    <PricingMatrix rows={plans} groupBy=\"tier\" dense />" },
        { type: "add", text: "  );" },
        { type: "ctx", text: "}" },
      ],
    },
  },
  {
    id: "pricing-chart",
    name: "pricing-chart.svg",
    path: "assets/pricing-chart.svg",
    kind: "svg",
    size: "86 KB",
    updated: "09:47",
    badge: "new",
    summary: "按席位单价绘制的分层对比图，矢量输出可直接嵌入研报。",
    meta: { 尺寸: "1920 × 1080", 色彩: "sRGB", 图层: "12" },
    image: { width: 1920, height: 1080, caption: "每席位月费对比 · 免费版 / 团队版", palette: ["bg-file-data", "bg-info", "bg-warning", "bg-file-image"] },
  },
  {
    id: "call-notes",
    name: "customer-call.m4a",
    path: "media/customer-call.m4a",
    kind: "audio",
    size: "12.8 MB",
    updated: "09:40",
    summary: "客户访谈录音，已自动转写并提取三条定价相关诉求。",
    meta: { 时长: "18:24", 采样率: "44.1 kHz", 声道: "单声道" },
    audio: {
      duration: "18:24",
      wave: [12, 26, 18, 40, 32, 55, 48, 70, 44, 58, 30, 66, 52, 38, 62, 28, 46, 34, 58, 24, 42, 60, 36, 50, 22, 44, 30, 54, 26, 38],
      transcript: [
        { at: "02:14", text: "我们真正付费的理由是团队共享空间，而不是额度本身。" },
        { at: "07:38", text: "免费版最大的阻碍是无法邀请同事一起看结果。" },
        { at: "13:05", text: "如果按席位计费，希望能看到每个人的用量明细。" },
      ],
    },
  },
  {
    id: "raw-payload",
    name: "raw-payload.json",
    path: "data/raw-payload.json",
    kind: "json",
    size: "220 KB",
    updated: "09:42",
    summary: "抓取原始响应，保留站点结构与价格字段原貌。",
    meta: { 节点: "4,218", 深度: "6", 来源: "5 个站点" },
    json: `{
  "source": "atlas.ai/pricing",
  "fetchedAt": "2026-09-28T09:42:11Z",
  "plans": [
    { "tier": "free", "monthly": 0, "seats": 1, "quota": "50/month" },
    { "tier": "team", "monthly": 25, "seats": 3, "quota": "unlimited" }
  ],
  "notes": ["annual billing saves 20%", "education discount available"]
}`,
  },
  {
    id: "deliverable",
    name: "pricing-research.zip",
    path: "exports/pricing-research.zip",
    kind: "archive",
    size: "3.4 MB",
    updated: "09:48",
    badge: "new",
    summary: "本次任务的完整交付包：研报、数据、图表与原始记录。",
    meta: { 文件数: "7", 压缩率: "62%", 版本: "v1.2" },
  },
];

export type TreeNode = { name: string; kind: "dir" | "file"; fileId?: string; size?: string; children?: TreeNode[] };

export const workspaceTree: TreeNode[] = [
  {
    name: "reports",
    kind: "dir",
    children: [{ name: "pricing-summary.md", kind: "file", fileId: "pricing-summary", size: "14.2 KB" }],
  },
  {
    name: "data",
    kind: "dir",
    children: [
      { name: "competitor-pricing.csv", kind: "file", fileId: "competitor-pricing", size: "38.6 KB" },
      { name: "raw-payload.json", kind: "file", fileId: "raw-payload", size: "220 KB" },
    ],
  },
  {
    name: "src",
    kind: "dir",
    children: [
      { name: "pipeline", kind: "dir", children: [{ name: "analyze.ts", kind: "file", fileId: "analyze-ts", size: "4.1 KB" }] },
      { name: "views", kind: "dir", children: [{ name: "report.tsx", kind: "file", fileId: "report-diff", size: "2.6 KB" }] },
    ],
  },
  { name: "assets", kind: "dir", children: [{ name: "pricing-chart.svg", kind: "file", fileId: "pricing-chart", size: "86 KB" }] },
  { name: "media", kind: "dir", children: [{ name: "customer-call.m4a", kind: "file", fileId: "call-notes", size: "12.8 MB" }] },
  { name: "exports", kind: "dir", children: [{ name: "pricing-research.zip", kind: "file", fileId: "deliverable", size: "3.4 MB" }] },
];

export const fileById = (id: string) => demoFiles.find((f) => f.id === id);
