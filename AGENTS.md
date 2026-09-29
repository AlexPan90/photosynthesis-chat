<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting published git history — force pushing, or rebasing/amending/squashing commits that are already pushed — as it rewrites history on Lovable's side and the user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the UI study as a client-side interactive prototype with local browser conversation history; there is no connected AI service or cloud persistence in this design deliverable.
- Use AI Elements for transcript, messages, tools, and composer so the mockup follows real chat interaction primitives.
- Keep conversation IDs in `/chat/$threadId` URLs so each local thread can be revisited and refreshed independently.
- Extend the shared small icon button size and adapt installed AI Elements to the existing Select and strict motion types; these compatibility edits keep the UI primitives reusable.
- Keep branching-story sample content and reader state client-side, with browser speech synthesis used only for narration preview; this avoids implying that demo assets include recorded audio.
- Use ink-black #171A18, near-white #F4F5F1, mineral #59645D and chartreuse #C9ED55 with Sora/Manrope across the shared UI; this preserves the selected focused technical aesthetic while chapter narration stays in the story context column.
- Keep the conversation as the default focal surface, with workspace files opened contextually in a separately resizable right column rather than showing the file pane on arrival; this avoids competing content while allowing focused file inspection.
- Real chat streams through the `/api/chat` server route (OpenAI Responses via Lovable AI Gateway, default `openai/gpt-6-astra`); threads/messages live in Cloud tables scoped by RLS to the signed-in user, while seed demo threads stay client-side and read-only — keeps demos browsable without an account.
- Agent 编排在 /api/chat 内完成：选中 Agent 覆盖提示词/工具/模型，委派通过 delegate_to_agent 工具的流式预览输出回传子 Agent 执行记录——前端只消费统一的 UI 消息流，无需额外协议。
- Agent/MCP/Skills 编排在 /studio/* 页面管理；MCP 密钥用 MCP_ENC_KEY 做 AES-GCM 加密后只在服务端解密，/api/chat 按 Agent 绑定临时建 MCP 客户端并在流结束时关闭——避免令牌进入浏览器或长连接泄漏。
- Skills 渐进加载：系统提示只放名称+描述，正文用 load_skill/read_skill_file 按需读取（远程文件从 GitHub raw 拉取、只读）——节省上下文且不执行脚本。
- Scripts run in two sandboxes: run_js (browser Web Worker, user-confirmed client tool) and run_skill_script (E2B cloud sandbox via E2B_API_KEY, server toolApproval) — the Worker runtime cannot spawn processes or eval.
- Paused sub-agent tasks persist their model history in delegate_sessions (RLS own-only); delegate_action executes the server-stored pending action and resumes the sub-agent — Worker is stateless, and the model-supplied args are never trusted.
- Keep the chat workspace as a continuous ruled transcript lane beneath a structured header, with contextual resizable files and a wider sidebar; this makes the chosen technical hierarchy visible on actual and demo conversations.
