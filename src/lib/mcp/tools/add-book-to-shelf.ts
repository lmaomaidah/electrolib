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
  name: "add_book_to_shelf",
  title: "Add book to shelf",
  description: "Add a book to the signed-in user's shelf. Creates the book record if it does not exist.",
  inputSchema: {
    title: z.string().min(1).describe("Book title."),
    author: z.string().optional().describe("Book author."),
    shelf: z.enum(["want-to-read", "currently-reading", "read"]).describe("Which shelf to add to."),
    cover_url: z.string().url().optional(),
    isbn: z.string().optional(),
    genre: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: async ({ title, author, shelf, cover_url, isbn, genre }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const client = sb(ctx);
    const { data: bookId, error: rpcErr } = await client.rpc("find_or_create_book", {
      _title: title,
      _author: author ?? "",
      _cover_url: cover_url ?? null,
      _isbn: isbn ?? null,
      _genre: genre ?? null,
    });
    if (rpcErr) return { content: [{ type: "text", text: rpcErr.message }], isError: true };
    const { data, error } = await client
      .from("user_books")
      .upsert(
        { user_id: ctx.getUserId(), book_id: bookId, shelf },
        { onConflict: "user_id,book_id" },
      )
      .select("id, shelf, book_id")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Added "${title}" to ${shelf}.` }],
      structuredContent: { row: data },
    };
  },
});
