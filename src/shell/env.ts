import { api } from "../api/client";

export type Env = "paper" | "live" | "unknown";

export function useEnv(): Env {
  const account = api.useQuery("get", "/account", undefined, { refetchInterval: 15_000 });
  if (!account.data) return "unknown";
  return account.data.paper ? "paper" : "live";
}
