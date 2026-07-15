import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

type Doc = { title?: string; author_name?: string[]; cover_i?: number; first_publish_year?: number; isbn?: string[] };

export default defineTool({
  name: "search_books",
  title: "Search books",
  description: "Search Open Library for books by title, author, or keywords. Public catalog data.",
  inputSchema: {
    query: z.string().min(1).describe("Search query (title, author, keywords)."),
    limit: z.number().int().min(1).max(20).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ query, limit }) => {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit ?? 10}`;
    const res = await fetch(url);
    if (!res.ok) return { content: [{ type: "text", text: `Open Library error: ${res.status}` }], isError: true };
    const json = (await res.json()) as { docs?: Doc[] };
    const results = (json.docs ?? []).map((d) => ({
      title: d.title,
      author: d.author_name?.[0],
      year: d.first_publish_year,
      isbn: d.isbn?.[0],
      cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(results) }],
      structuredContent: { results },
    };
  },
});
