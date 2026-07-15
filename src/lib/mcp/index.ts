import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyShelf from "./tools/list-my-shelf";
import addBookToShelf from "./tools/add-book-to-shelf";
import updateBookProgress from "./tools/update-book-progress";
import searchBooks from "./tools/search-books";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "electrolibrary-mcp",
  title: "ElectroLibrary",
  version: "0.1.0",
  instructions:
    "Tools for ElectroLibrary — the signed-in user's reading tracker. Use `list_my_shelf` to see what they're reading, `search_books` to look up books in Open Library, `add_book_to_shelf` to save a book, and `update_book_progress` to update rating, review, shelf, or pages read.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMyShelf, searchBooks, addBookToShelf, updateBookProgress],
});
