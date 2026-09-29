import { createFileRoute } from "@tanstack/react-router";
import { handleCompact } from "@/lib/ai/chat.server";

export const Route = createFileRoute("/api/compact")({
  server: { handlers: { POST: ({ request }) => handleCompact(request) } },
});
