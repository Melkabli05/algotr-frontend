import { Drawer, DrawerSize, HTMLTable, Tag } from "@blueprintjs/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { Explained, PanelTitle, Th } from "../components/Explained";
import { Loadable } from "../components/Loadable";
import { money, percent, signedMoney, signedPercent, time, tone as toneOf } from "../format";
import { page } from "../glossary";
import { useStream } from "../stream/store";
import { ConfidenceBadge, confidenceOf, useConfidence } from "./confidence";
import { Recovery } from "./Recovery";
import { Detail } from "./Signals";
import { type Explanations, type Signal, signalsOf } from "./xai";

const RISK_INTENT = {
  normal: "success",
  watch: "warning",
  reduce: "warning",
  defensive: "danger",
  flatten: "danger",
} as const;

function Tile({
  label,
  value,
  note,
  className,
  to,
  tint,
  children,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  className?: string;
  to: string;
  tint?: "gain" | "loss" | "flat";
  children?: React.ReactNode;
}) {
  return (
    <Link to={to} className={`panel tile tile-link ${tint ? `tint-${tint}` : ""}`}>
      <span className="figure-label">{label}</span>
      <span className={`tile-value num ${className ?? ""}`}>{value}</span>
      {note ? <span className="muted tile-note">{note}</span> : null}
      {children}
    </Link>
  );
}

function Spark({ points, positive }: { points: number[]; positive: boolean }) {
  if (points.length < 2) return null;
  const low = Math.min(...points);
  const high = Math.max(...points);
  const span = high - low || 1;
  const path = points
    .map(
      (value, index) =>
        `${(index / (points.length - 1)) * 100},${30 - ((value - low) / span) * 28}`,
    )
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="spark" aria-hidden="true">
      <polyline points={path} className={positive ? "spark-gain" : "spark-loss"} />
    </svg>
  );
}

function Vitals() {
  const account = api.useQuery("get", "/account", undefined, { refetchInterval: 15_000 });
  const positions = api.useQuery("get", "/positions", undefined, { refetchInterval: 15_000 });
  const overview = api.useQuery("get", "/systematic/overview", undefined, { staleTime: 60_000 });
  const intraday = api.useQuery(
    "get",
    "/portfolio/history",
    { params: { query: { period: "1D" } } },
    { refetchInterval: 60_000 },
  );
  const automation = api.useQuery("get", "/systematic/automation", undefined, {
    refetchInterval: 30_000,
  });
  const data = account.data;
  const strategies = overview.data?.strategies ?? [];
  const paused = new Set(automation.data?.config.paused ?? []);
  const running = strategies.filter((item) => item.active && !paused.has(item.spec.name)).length;
  const errors = strategies.filter((item) => item.error).length;
  const state = automation.data?.kill_state ?? "normal";
  const halted = automation.data?.halted;
  const held = positions.data ?? [];
  const net = held.reduce((sum, item) => sum + item.market_value, 0);
  const curve = (intraday.data ?? []).map((point) => point.equity);
  const pnl = toneOf(data?.day_pl);
  return (
    <div className="tiles">
      <Tile
        to="/dashboard"
        label="Daily P&L"
        value={signedMoney(data?.day_pl)}
        className={pnl}
        tint={pnl}
        note={signedPercent(data ? data.day_pl_pct / 100 : null)}
      >
        <Spark points={curve} positive={(data?.day_pl ?? 0) >= 0} />
      </Tile>
      <Tile
        to="/positions"
        label="Open positions"
        value={held.length}
        note={`net exposure ${money(net)}`}
      />
      <Tile
        to="/strategies"
        label="Active strategies"
        value={
          <span className="row" style={{ gap: 14 }}>
            <span title="running">
              {overview.data ? running + (overview.data.ensemble_active ? 1 : 0) : "—"}
            </span>
            <span className="muted" title="paused">
              {paused.size}
            </span>
            <span className={errors ? "loss" : "muted"} title="error">
              {errors}
            </span>
          </span>
        }
        note="running · paused · error"
      />
      <Tile
        to="/risk"
        label="Risk state"
        value={
          <Tag large minimal intent={halted ? "danger" : RISK_INTENT[state]}>
            {halted ? "halted" : state}
          </Tag>
        }
        note={`drawdown ${percent(automation.data?.book.drawdown)}`}
      />
    </div>
  );
}

type ActivityEvent = components["schemas"]["app__activity__Event"];

const KIND_VIEW: Record<string, { path: string; label: string }> = {
  order: { path: "/orders", label: "Orders" },
  fill: { path: "/blotter", label: "Trade blotter" },
  run: { path: "/strategies", label: "Strategies" },
  risk: { path: "/risk", label: "Risk" },
  signal: { path: "/signals", label: "Signals and XAI" },
  research: { path: "/research", label: "Research" },
  system: { path: "/audit", label: "Audit log" },
};

export function tone(event: { kind: string; level: string; title: string }): string {
  if (event.level === "error") return "ev-error";
  if (event.level === "warn") return "ev-warn";
  if (event.kind === "fill" || /\bok\b|accepted|filled/i.test(event.title)) return "ev-ok";
  return "ev-info";
}

function Activity() {
  const activity = api.useQuery(
    "get",
    "/activity",
    { params: { query: { hours: 72 } } },
    { refetchInterval: 10_000 },
  );
  const list = useRef<HTMLUListElement>(null);
  const [chosen, setChosen] = useState<ActivityEvent>();
  const events = (activity.data ?? []).slice(0, 20);
  const newest = events[0]?.time;
  useEffect(() => {
    if (newest) list.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [newest]);
  const view = chosen ? KIND_VIEW[chosen.kind] : undefined;
  return (
    <section className="panel stack" aria-labelledby="cc-activity">
      <h2 className="panel-title" id="cc-activity">
        Live activity
      </h2>
      <Loadable query={activity} rows={8}>
        <ul className="feed cc-feed" ref={list} aria-live="polite">
          {events.map((event) => (
            <li key={`${event.time}-${event.title}`} className={tone(event)}>
              <time className="num muted" dateTime={event.time}>
                {time(event.time)}
              </time>
              <Tag minimal>{event.kind}</Tag>
              <button
                type="button"
                className="rung-button ev-text"
                onClick={() => setChosen(event)}
              >
                {event.title}
                {event.detail ? <span className="muted"> · {event.detail}</span> : null}
              </button>
            </li>
          ))}
          {events.length === 0 ? <li className="muted">No events in three days</li> : null}
        </ul>
      </Loadable>
      <Drawer
        isOpen={Boolean(chosen)}
        onClose={() => setChosen(undefined)}
        size={DrawerSize.SMALL}
        title={chosen?.title}
      >
        {chosen ? (
          <div style={{ padding: 16 }} className="stack">
            <HTMLTable compact>
              <tbody>
                <tr>
                  <td>Time</td>
                  <td className="num">{time(chosen.time)}</td>
                </tr>
                <tr>
                  <td>Kind</td>
                  <td>{chosen.kind}</td>
                </tr>
                <tr>
                  <td>Level</td>
                  <td>{chosen.level}</td>
                </tr>
              </tbody>
            </HTMLTable>
            {chosen.detail ? <p>{chosen.detail}</p> : null}
            {view ? <Link to={view.path}>Open {view.label}</Link> : null}
          </div>
        ) : null}
      </Drawer>
    </section>
  );
}

function Signals() {
  const ppo = api.useQuery("get", "/systematic/agents/{algorithm}/explanations", {
    params: { path: { algorithm: "ppo" }, query: { limit: 10 } },
  });
  const sac = api.useQuery("get", "/systematic/agents/{algorithm}/explanations", {
    params: { path: { algorithm: "sac" }, query: { limit: 10 } },
  });
  const a2c = api.useQuery("get", "/systematic/agents/{algorithm}/explanations", {
    params: { path: { algorithm: "a2c" }, query: { limit: 10 } },
  });
  const found = useMemo(
    () => [ppo.data, sac.data, a2c.data].filter((item): item is Explanations => Boolean(item)),
    [ppo.data, sac.data, a2c.data],
  );
  const signals = useMemo(
    () =>
      found
        .flatMap(signalsOf)
        .filter((signal) => signal.direction !== "Hold")
        .sort((a, b) => b.decided.localeCompare(a.decided))
        .slice(0, 8),
    [found],
  );
  const [chosen, setChosen] = useState<Signal>();
  const sure = useConfidence();
  const explanations = found.find((item) => item.algorithm === chosen?.algorithm);
  const agents = api.useQuery("get", "/systematic/agents", undefined, { staleTime: 300_000 });
  const weights = Object.entries(agents.data?.status.ensemble ?? {});
  return (
    <section className="panel stack">
      <div className="row">
        <h2 className="panel-title grow">Agent signals</h2>
        <Link to="/signals">All signals</Link>
      </div>
      {weights.length ? (
        <div>
          <div className="mix" role="img" aria-label="Ensemble weights">
            {weights.map(([name, weight]) => (
              <span key={name} className={`mix-${name}`} style={{ flexGrow: weight }} />
            ))}
          </div>
          <span className="muted num">
            Ensemble weights:{" "}
            {weights
              .map(([name, weight]) => `${name.toUpperCase()} ${percent(weight, 0)}`)
              .join(" · ")}
          </span>
        </div>
      ) : null}
      <HTMLTable compact interactive style={{ width: "100%" }}>
        <thead>
          <tr>
            <Th>Day</Th>
            <Th>Agent</Th>
            <Th>Signal</Th>
            <Th>Weight</Th>
            <Th>Change</Th>
            <Th>Confidence</Th>
          </tr>
        </thead>
        <tbody className="num">
          {signals.map((signal) => (
            <tr key={signal.key} onClick={() => setChosen(signal)}>
              <td>{signal.decided}</td>
              <td>
                <Tag minimal>{signal.algorithm.toUpperCase()}</Tag>
              </td>
              <td className={signal.direction === "Buy" ? "gain" : "loss"}>
                {signal.direction} {signal.symbol}
              </td>
              <td>{percent(signal.weight, 0)}</td>
              <td>{signedPercent(signal.change, 0)}</td>
              <td>
                <ConfidenceBadge value={confidenceOf(sure, signal)} />
              </td>
            </tr>
          ))}
          {signals.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted">
                No buy or sell signals in the last ten decisions
              </td>
            </tr>
          ) : null}
        </tbody>
      </HTMLTable>
      <p className="muted" style={{ margin: 0 }}>
        A move of 2 points or more reads as Buy or Sell; confidence is how often the agent's own
        stochastic policy makes the same move. Agents trade only after passing the gates.
      </p>
      <Drawer
        isOpen={Boolean(chosen)}
        onClose={() => setChosen(undefined)}
        size={DrawerSize.STANDARD}
        title={
          chosen ? `${chosen.algorithm.toUpperCase()} ${chosen.symbol}, ${chosen.decided}` : ""
        }
      >
        {chosen && explanations ? (
          <div style={{ padding: 16, overflow: "auto" }}>
            <Detail signal={chosen} explanations={explanations} traded={false} />
          </div>
        ) : null}
      </Drawer>
    </section>
  );
}

function Connection() {
  const connection = api.useQuery("get", "/system/connection", undefined, {
    refetchInterval: 15_000,
  });
  const stream = useStream();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const found = connection.data;
  const tick = stream.last ? Math.max(0, (now - stream.last) / 1000) : null;
  const down = !stream.connected || Object.values(found?.connected ?? {}).some((value) => !value);
  const stale = (tick ?? 0) > 60 || (found?.heartbeat_seconds ?? 0) > 60;
  return (
    <section className={`panel stack ${down ? "panel-bad" : stale ? "panel-warn" : ""}`}>
      <PanelTitle>Alpaca connection</PanelTitle>
      <HTMLTable compact style={{ width: "100%" }}>
        <tbody>
          <tr>
            <td>Terminal stream</td>
            <td>
              <span className={`dot dot-${stream.connected ? "ok" : "error"}`} />
              {stream.connected ? "connected" : "disconnected"}
            </td>
          </tr>
          {(found?.streams ?? []).map((item) => (
            <tr key={item.name}>
              <td>Alpaca {item.name} stream</td>
              <td>
                <span className={`dot dot-${found?.connected[item.name] ? "ok" : "error"}`} />
                {found?.connected[item.name] ? "connected" : "not connected"}
                <span className="muted num">
                  {" "}
                  · {item.reconnects} reconnects · {item.errors} errors
                </span>
              </td>
            </tr>
          ))}
          <tr>
            <td>Last tick</td>
            <td className="num">
              {tick == null
                ? "none yet"
                : tick < 60
                  ? `${tick.toFixed(1)}s ago`
                  : time(new Date(stream.last ?? 0))}
            </td>
          </tr>
          <tr>
            <td>Last heartbeat</td>
            <td className="num">
              {found?.heartbeat_seconds == null
                ? "—"
                : `${found.heartbeat_seconds.toFixed(0)}s ago`}
            </td>
          </tr>
          <tr>
            <td>Orders submitted today</td>
            <td className="num">{found?.orders_today ?? 0}</td>
          </tr>
          <tr>
            <td>Order round trip</td>
            <td className="num">
              {found?.ack_ms == null
                ? "no orders timed yet"
                : `${found.ack_ms.toFixed(0)} ms median of ${found.ack_samples}`}
            </td>
          </tr>
          <tr>
            <td>Fill rate, last 100 orders</td>
            <td className="num">
              {percent(found?.fill_rate, 0)}
              <span className="muted">
                {" "}
                · {found?.orders.canceled ?? 0} canceled · {found?.orders.rejected ?? 0} rejected
              </span>
            </td>
          </tr>
        </tbody>
      </HTMLTable>
    </section>
  );
}

export function CommandCenter() {
  return (
    <div className="stack">
      <h1 className="panel-title" style={{ margin: 0 }}>
        <Explained text={page("Command center")}>Command center</Explained>
      </h1>
      <Recovery />
      <div className="cc-grid">
        <div className="stack">
          <Vitals />
          <Activity />
        </div>
        <div className="stack">
          <Signals />
          <Connection />
        </div>
      </div>
    </div>
  );
}
