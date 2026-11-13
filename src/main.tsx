import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import "@blueprintjs/select/lib/css/blueprint-select.css";
import "./theme.css";
import { BlueprintProvider, FocusStyleManager } from "@blueprintjs/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { stream } from "./stream/store";
import { toaster } from "./toaster";

FocusStyleManager.onlyShowFocusOnTabs();

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1 } } });
const RELOADS = ["/orders", "/positions", "/account", "/activity", "/ledger/fills"];

stream.onOrder = async (update) => {
  for (const path of RELOADS) client.invalidateQueries({ queryKey: ["get", path] });
  const filled = update.event === "fill" || update.event === "partial_fill";
  const refused = update.event === "rejected" || update.event === "canceled";
  if (filled || refused) {
    (await toaster()).show({
      message: `${update.event.replace("_", " ")}: ${update.symbol}`,
      intent: refused ? "warning" : "success",
      timeout: 5000,
    });
  }
};
stream.start();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <BlueprintProvider>
        <QueryClientProvider client={client}>
          <App />
        </QueryClientProvider>
      </BlueprintProvider>
    </StrictMode>,
  );
}
