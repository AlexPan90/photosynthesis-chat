import { createFileRoute } from "@tanstack/react-router";
import { SkillsPage } from "@/components/orchestra/SkillsPage";

export const Route = createFileRoute("/studio/skills")({
  head: () => ({ meta: [
    { title: "Skills — Relay Studio" },
    { name: "description", content: "从 GitHub 仓库或订阅源安装 Skills，或手动编写 SKILL.md。" },
    { property: "og:title", content: "Skills — Relay Studio" },
    { property: "og:description", content: "给 Agent 装上可复用的方法手册。" },
  ] }),
  component: SkillsPage,
});
