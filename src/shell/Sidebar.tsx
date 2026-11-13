import { Menu, MenuItem, Tag } from "@blueprintjs/core";
import type { IconName } from "@blueprintjs/icons";
import { useLocation, useNavigate } from "react-router";
import { api } from "../api/client";
import { page } from "../glossary";
import { allowedOnPhone, usePhone } from "./mobile";

interface Item {
  path: string;
  label: string;
  icon: IconName;
}

export const VIEWS: Item[] = [
  { path: "/", label: "Command center", icon: "console" },
  { path: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { path: "/markets", label: "Markets", icon: "timeline-line-chart" },
  { path: "/positions", label: "Positions", icon: "th-list" },
  { path: "/orders", label: "Orders", icon: "exchange" },
  { path: "/blotter", label: "Trade blotter", icon: "th-derived" },
  { path: "/book", label: "Order book", icon: "layers" },
  { path: "/strategies", label: "Strategies", icon: "layout-auto" },
  { path: "/signals", label: "Signals and XAI", icon: "predictive-analysis" },
  { path: "/backtesting", label: "Backtesting", icon: "history" },
  { path: "/research", label: "Research", icon: "lab-test" },
  { path: "/risk", label: "Risk", icon: "shield" },
  { path: "/compliance", label: "Compliance", icon: "endorsed" },
  { path: "/automation", label: "Automation", icon: "automatic-updates" },
  { path: "/reconciliation", label: "Reconciliation", icon: "comparison" },
  { path: "/audit", label: "Audit log", icon: "manual" },
  { path: "/system", label: "System", icon: "pulse" },
  { path: "/settings", label: "Settings", icon: "cog" },
];

function useBadges(): Record<string, { text: string; intent: "warning" | "danger" | "none" }> {
  const orders = api.useQuery("get", "/orders", { params: { query: { limit: 100 } } });
  const automation = api.useQuery("get", "/systematic/automation");
  const drift = api.useQuery("get", "/drift/status");
  const holdings = api.useQuery("get", "/compliance/holdings");
  const status = api.useQuery("get", "/status", undefined, { refetchInterval: 60_000 });
  const open = (orders.data ?? []).filter((order) =>
    ["new", "accepted", "partially_filled", "held", "pending_new"].includes(order.status),
  ).length;
  const state = automation.data?.kill_state ?? "normal";
  const badges: Record<string, { text: string; intent: "warning" | "danger" | "none" }> = {};
  if (open) badges["/orders"] = { text: String(open), intent: "none" };
  if (state !== "normal")
    badges["/risk"] = { text: state, intent: state === "watch" ? "warning" : "danger" };
  const failing = (holdings.data ?? []).filter((item) => !item.screening.allowed).length;
  if (failing) badges["/compliance"] = { text: String(failing), intent: "danger" };
  const cut = (drift.data?.streams ?? []).filter((stream) => stream.until).length;
  if (cut) badges["/signals"] = { text: `${cut} cut`, intent: "warning" };
  const errors = (status.data?.checks ?? []).filter((check) => check.level === "error").length;
  if (errors) badges["/system"] = { text: String(errors), intent: "danger" };
  const ledger = api.useQuery("get", "/ledger/reconciliation", undefined, {
    refetchInterval: 60_000,
  });
  const differing = (ledger.data?.differences ?? []).filter((item) => item.kind === "quantity");
  if (differing.length)
    badges["/reconciliation"] = { text: String(differing.length), intent: "danger" };
  return badges;
}

export function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const badges = useBadges();
  const phone = usePhone();
  return (
    <nav className="shell-side" aria-label="Views">
      <Menu style={{ background: "transparent", minWidth: 180 }}>
        {VIEWS.filter((item) => !phone || allowedOnPhone(item.path)).map((item) => {
          const badge = badges[item.path];
          return (
            <MenuItem
              key={item.path}
              icon={item.icon}
              text={item.label}
              htmlTitle={page(item.label)}
              active={item.path === "/" ? pathname === "/" : pathname.startsWith(item.path)}
              onClick={() => navigate(item.path)}
              labelElement={
                badge ? (
                  <Tag minimal round intent={badge.intent === "none" ? undefined : badge.intent}>
                    {badge.text}
                  </Tag>
                ) : undefined
              }
            />
          );
        })}
      </Menu>
    </nav>
  );
}
