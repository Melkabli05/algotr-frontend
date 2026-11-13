import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import type { paths } from "./schema";

export const fetchClient = createFetchClient<paths>({ baseUrl: window.location.origin });
export const api = createClient(fetchClient);

export function detail(error: unknown): string {
  if (error && typeof error === "object" && "detail" in error) {
    const found = (error as { detail: unknown }).detail;
    if (typeof found === "string") return found;
    if (Array.isArray(found))
      return found.map((item) => String(item.msg ?? item).replace(/^Value error, /, "")).join("; ");
  }
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error instanceof Error) return error.message;
  return "The API is not answering";
}
