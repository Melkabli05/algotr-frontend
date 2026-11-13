import { Button, Callout, Tooltip } from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { api } from "../api/client";
import { useStream } from "../stream/store";
import { useEnv } from "./env";

export function useFreshness() {
  return api.useQuery("get", "/system/freshness", undefined, { refetchInterval: 15_000 });
}

const SHORT: Record<string, string> = {
  quotes: "",
  news: "News",
  ledger: "Ledger",
  scan: "Scan",
  book: "Books",
  crypto: "Coins",
};

function age(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

export function StaleBanner() {
  const freshness = useFreshness();
  const stream = useStream();
  const env = useEnv();
  const [dismissed, setDismissed] = useState("");
  const stale = (freshness.data?.feeds ?? []).filter(
    (feed) => feed.level === "warn" || feed.level === "error",
  );
  const quotes = stale.filter((feed) => feed.kind === "quotes");
  const other = stale.filter((feed) => feed.kind !== "quotes");
  if (stream.connected && !stale.length) return null;
  const parts = [
    ...(stream.connected ? [] : ["Live stream disconnected: prices shown are the last received"]),
    ...(quotes.length
      ? [
          `Quotes stale for ${quotes.map((feed) => `${feed.symbol} (${feed.detail})`).join(", ")}: the ticket and positions use the last price`,
        ]
      : []),
    ...other.map((feed) => `${feed.name}: ${feed.detail}`),
  ];
  const severe = !stream.connected || stale.some((feed) => feed.level === "error");
  const key = parts.join("|");
  if (env === "paper" && dismissed === key) return null;
  return (
    <Callout
      className="stale-banner"
      intent={severe ? "danger" : "warning"}
      icon="time"
      compact
      role="alert"
    >
      <div className="row">
        <span className="grow">{parts.join(" · ")}</span>
        {env === "paper" ? (
          <Button small minimal icon="minimize" onClick={() => setDismissed(key)}>
            Acknowledge
          </Button>
        ) : null}
      </div>
    </Callout>
  );
}

const DOT = { ok: "ok", warn: "warn", error: "error", idle: "idle" } as const;

export function FeedDots() {
  const freshness = useFreshness();
  const feeds = freshness.data?.feeds ?? [];
  return (
    <span className="feed-dots">
      {feeds.map((feed) => (
        <Tooltip key={feed.name} content={`${feed.name}: ${feed.detail}`} compact>
          <span className="feed-chip">
            <span
              className={`dot dot-${DOT[feed.level]}`}
              role="img"
              aria-label={`${feed.name} ${feed.level}`}
            />
            {feed.symbol ?? SHORT[feed.kind]}{" "}
            {feed.level === "idle" ? "closed" : age(feed.age_seconds)}
          </span>
        </Tooltip>
      ))}
    </span>
  );
}

const LINKS: Record<string, { to: string; label: string }[]> = {
  anomaly: [
    { to: "/reconciliation", label: "Reconciliation" },
    { to: "/blotter", label: "Trade blotter" },
  ],
  reconcile: [{ to: "/reconciliation", label: "Reconciliation" }],
  kill_switch: [{ to: "/risk", label: "Risk" }],
  rejections: [{ to: "/orders", label: "Orders" }],
  connection: [{ to: "/system", label: "System" }],
  watchdog: [{ to: "/system", label: "System" }],
};

export function CriticalStrip() {
  const client = useQueryClient();
  const alerts = api.useQuery(
    "get",
    "/alerts",
    { params: { query: { limit: 100 } } },
    {
      refetchInterval: 30_000,
    },
  );
  const ack = api.useMutation("post", "/alerts/{alert_id}/ack", {
    onSuccess: () => client.invalidateQueries({ queryKey: ["get", "/alerts"] }),
  });
  const open = (alerts.data ?? []).filter(
    (alert) => alert.tier === "P0" && !alert.acknowledged && !alert.cleared,
  );
  if (!open.length) return null;
  return (
    <Callout
      intent="danger"
      icon="error"
      className="stale-banner"
      title={`${open.length} critical alerts to acknowledge`}
    >
      {open.slice(0, 5).map((alert) => (
        <div key={alert.id} className="row" style={{ marginTop: 4 }}>
          <span className="num muted">{new Date(alert.time).toLocaleTimeString()}</span>
          <span className="grow">
            <strong>{alert.title}</strong>
            {alert.detail ? ` · ${alert.detail}` : ""}
          </span>
          {(LINKS[alert.kind] ?? []).map((link) => (
            <Link key={link.to} to={link.to}>
              {link.label}
            </Link>
          ))}
          <Button
            small
            loading={ack.isPending}
            onClick={() => ack.mutate({ params: { path: { alert_id: alert.id } } })}
          >
            Acknowledge
          </Button>
        </div>
      ))}
    </Callout>
  );
}
