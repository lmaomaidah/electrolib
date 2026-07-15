import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    global: {
      headers: { Authorization: `Bearer ${ctx.getToken()}` },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "update_book_progress",
  title: "Update reading progress",
  description: "Update rating, review, shelf, current page, or favorite status for a book on the signed-in user's shelf.",
  inputSchema: {
    user_book_id: z.string().uuid().describe("The user_books.id (from list_my_shelf)."),
    shelf: z.enum(["want-to-read", "currently-reading", "read"]).optional(),
    rating: z.number().int().min(0).max(5).optional(),
    review: z.string().optional(),
    current_page: z.number().int().min(0).optional(),
    is_favorite: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ user_book_id, ...patch }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const cleaned = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(cleaned).length === 0)
      return { content: [{ type: "text", text: "No fields to update." }], isError: true };
    const { data, error } = await sb(ctx)
      .from("user_books")
      .update(cleaned)
      .eq("id", user_book_id)
      .eq("user_id", ctx.getUserId())
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: "Updated." }],
      structuredContent: { row: data },
    };
  },
});
