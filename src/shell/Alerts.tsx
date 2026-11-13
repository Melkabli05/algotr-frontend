import { Button, Menu, MenuDivider, MenuItem, PopoverNext } from "@blueprintjs/core";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { time } from "../format";
import { toaster } from "../toaster";

const KEY = "algotr-alerts-seen";
const STREAMED = new Set(["fill", "rejected"]);
const ICONS = {
  critical: "error",
  warning: "warning-sign",
  anomaly: "pulse",
  info: "tick",
} as const;
const INTENTS = {
  critical: "danger",
  warning: "warning",
  anomaly: "primary",
  info: "none",
} as const;

function seenAt(): number {
  try {
    return Number(localStorage.getItem(KEY) ?? 0);
  } catch {
    return 0;
  }
}

export function Alerts() {
  const [seen, setSeen] = useState(seenAt);
  const mute = api.useMutation("post", "/alerts/mute");
  const found = api.useQuery(
    "get",
    "/alerts",
    { params: { query: { limit: 30 } } },
    { refetchInterval: 30_000 },
  );
  const alerts = found.data ?? [];
  const toasted = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!found.data) return;
    const newest = Math.max(0, ...found.data.map((alert) => new Date(alert.time).getTime()));
    const after = toasted.current;
    toasted.current = newest;
    if (after === undefined) return;
    const fresh = found.data.filter(
      (alert) => new Date(alert.time).getTime() > after && !STREAMED.has(alert.kind),
    );
    if (!fresh.length) return;
    toaster().then((shown) => {
      for (const alert of fresh)
        shown.show({
          message: `${alert.title}${alert.detail ? `: ${alert.detail}` : ""}`,
          intent: INTENTS[alert.severity ?? "warning"],
          timeout: alert.tier === "P0" ? 0 : 8000,
        });
    });
  }, [found.data]);
  const unread = alerts.filter((alert) => new Date(alert.time).getTime() > seen).length;
  const markSeen = () => {
    const now = Date.now();
    setSeen(now);
    try {
      localStorage.setItem(KEY, String(now));
    } catch {
      return;
    }
  };
  return (
    <PopoverNext
      placement="bottom-end"
      onClosing={markSeen}
      content={
        <Menu style={{ maxWidth: 440 }}>
          <MenuDivider title="Alerts" />
          {alerts.length === 0 ? <MenuItem disabled text="No alerts" /> : null}
          {alerts.map((alert) => (
            <MenuItem
              key={`${alert.time}-${alert.kind}`}
              icon={ICONS[alert.severity ?? "warning"]}
              intent={INTENTS[alert.severity ?? "warning"]}
              text={alert.detail ? `${alert.title}: ${alert.detail}` : alert.title}
              label={`${alert.tier ?? ""} ${time(alert.time)}`}
              title={Object.entries(alert.channels ?? {})
                .map(([channel, outcome]) => `${channel} ${outcome}`)
                .join(", ")}
              multiline
            >
              {alert.symbol && alert.tier !== "P0" ? (
                <MenuItem
                  text={`Mute for ${alert.symbol}, 1 hour`}
                  onClick={() =>
                    mute.mutate({
                      body: { kind: alert.kind, symbol: alert.symbol ?? "", minutes: 60 },
                    })
                  }
                />
              ) : undefined}
            </MenuItem>
          ))}
          <MenuDivider />
          <MenuItem icon="cog" text="Alert settings" href="/ui/settings" />
        </Menu>
      }
    >
      <Button
        minimal
        icon="notifications"
        aria-label={`Alerts, ${unread} unread`}
        text={unread ? String(unread) : undefined}
        intent={unread ? "warning" : "none"}
      />
    </PopoverNext>
  );
}
