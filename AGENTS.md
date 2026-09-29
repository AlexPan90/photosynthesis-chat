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
- Use a graphite-neutral theme with Sora/Manrope and locate each chapter’s narration in the story context column; this keeps the chosen desktop reading workspace coherent and avoids duplicate media.
- Keep the conversation as the default focal surface, with workspace files opened contextually in a separately resizable right column rather than showing the file pane on arrival; this avoids competing content while allowing focused file inspection.
- Real chat streams through the `/api/chat` server route (OpenAI Responses via Lovable AI Gateway, default `openai/gpt-6-astra`); threads/messages live in Cloud tables scoped by RLS to the signed-in user, while seed demo threads stay client-side and read-only — keeps demos browsable without an account.
