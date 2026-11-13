import { HTMLSelect, HTMLTable, Tag } from "@blueprintjs/core";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { ACCENT_DARK, ACCENT_LIGHT, Chart, LOSS } from "../components/Chart";
import { Th } from "../components/Explained";
import { Loadable } from "../components/Loadable";
import { percent, quantity, time } from "../format";
import { useDark } from "../shell/theme";

type Event = components["schemas"]["RiskEvent"];

const HOURS = [
  { value: 24, label: "Last 24 hours" },
  { value: 72, label: "Last 3 days" },
  { value: 168, label: "Last week" },
];

function Timeline({ events, since }: { events: Event[]; since: number }) {
  const dark = useDark();
  const shown = events.filter((event) => new Date(event.time).getTime() >= since);
  const levels = { critical: 3, warning: 2, info: 1 } as Record<string, number>;
  return (
    <Chart
      label="Risk events over time"
      height={140}
      option={{
        tooltip: {
          trigger: "item",
          formatter: (params: unknown) => {
            const found = shown[(params as { dataIndex: number }).dataIndex];
            return found
              ? `${time(found.time)}<br/>${found.title}${found.detail ? `<br/>${found.detail}` : ""}`
              : "";
          },
        },
        xAxis: { type: "time", min: since, max: Date.now() },
        yAxis: {
          type: "value",
          min: 0,
          max: 4,
          interval: 1,
          axisLabel: {
            formatter: (value: number) => ["", "drift", "warning", "critical", ""][value] ?? "",
          },
        },
        series: [
          {
            type: "line",
            showSymbol: true,
            symbolSize: 10,
            lineStyle: { width: 0 },
            data: shown.map((event) => {
              const level = levels[event.severity] ?? 1;
              return {
                value: [new Date(event.time).getTime(), level],
                itemStyle: { color: level === 3 ? LOSS : dark ? ACCENT_DARK : ACCENT_LIGHT },
              };
            }),
          },
        ],
      }}
    />
  );
}

function LimitSpark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const high = Math.max(1, ...points);
  const path = points
    .map((value, index) => `${(index / (points.length - 1)) * 100},${30 - (value / high) * 28}`)
    .join(" ");
  const limit = 30 - (1 / high) * 28;
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="spark" aria-hidden="true">
      <line x1="0" x2="100" y1={limit} y2={limit} className="spark-limit" />
      <polyline points={path} className="spark-neutral" />
    </svg>
  );
}

function EventList({ events }: { events: Event[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!events.length) return <p className="muted">No risk events in this window</p>;
  return (
    <ul className="feed">
      {events.map((event) => {
        const key = `${event.time}-${event.title}`;
        return (
          <li key={key}>
            <time className="num muted" dateTime={event.time}>
              {time(event.time)}
            </time>
            <button
              type="button"
              className={`rung-button ${event.severity === "critical" ? "loss" : event.severity === "warning" ? "warn-text" : ""}`}
              onClick={() => setOpen(open === key ? null : key)}
            >
              {event.title}
              {open === key && event.detail ? (
                <span className="muted"> · {event.detail}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function Storyboard({ events }: { events: Event[] }) {
  const dark = useDark();
  const [hours, setHours] = useState(24);
  const history = api.useQuery(
    "get",
    "/risk/history",
    { params: { query: { hours } } },
    { refetchInterval: 300_000 },
  );
  const misses = api.useQuery("get", "/risk/near-misses", {
    params: { query: { days: Math.max(1, Math.round(hours / 24)) } },
  });
  const since = useMemo(() => Date.now() - hours * 3_600_000, [hours]);
  const snapshots = history.data ?? [];
  const names = [...new Set(snapshots.flatMap((snap) => snap.limits.map((item) => item.name)))];
  const peaks = names.map((name) => ({
    name,
    peak: Math.max(
      0,
      ...snapshots.map((snap) => snap.limits.find((item) => item.name === name)?.used ?? 0),
    ),
  }));
  return (
    <section className="panel stack">
      <div className="row">
        <h2 className="panel-title grow">Risk storyboard</h2>
        <HTMLSelect
          aria-label="Window"
          value={hours}
          options={HOURS}
          onChange={(event) => setHours(Number(event.currentTarget.value))}
        />
      </div>
      <Timeline events={events} since={since} />
      <EventList events={events.filter((event) => new Date(event.time).getTime() >= since)} />
      <Loadable
        query={history}
        isEmpty={snapshots.length === 0}
        empty="No snapshots yet: limit use is sampled every five minutes from now on"
      >
        <Chart
          label="Use of each limit over time"
          height={220}
          option={{
            tooltip: {
              trigger: "axis",
              valueFormatter: (value: unknown) => percent(Number(value), 0),
            },
            legend: { type: "scroll", top: 0 },
            grid: { top: 32 },
            xAxis: { type: "time" },
            yAxis: {
              type: "value",
              axisLabel: { formatter: (value: number) => `${Math.round(value * 100)}%` },
            },
            series: [
              ...names.map((name) => ({
                type: "line" as const,
                name,
                showSymbol: false,
                data: snapshots.map((snap) => [
                  new Date(snap.time).getTime(),
                  snap.limits.find((item) => item.name === name)?.used ?? null,
                ]),
              })),
              {
                type: "line" as const,
                name: "limit",
                showSymbol: false,
                data: snapshots.length
                  ? [
                      [new Date(snapshots[0]?.time ?? 0).getTime(), 1],
                      [new Date(snapshots.at(-1)?.time ?? 0).getTime(), 1],
                    ]
                  : [],
                lineStyle: { type: "dashed" as const },
                color: dark ? "#8f8e88" : "#6b6b66",
              },
            ],
          }}
        />
        <div className="metric-grid">
          {names.map((name) => {
            const series = snapshots.map(
              (snap) => snap.limits.find((item) => item.name === name)?.used ?? 0,
            );
            const now = series.at(-1) ?? 0;
            const peak = Math.max(0, ...series);
            return (
              <div key={name} className={`metric ${peak >= 0.75 ? "metric-worse" : ""}`}>
                <span className="figure-label">{name}</span>
                <span className="num">
                  {percent(now, 0)} <span className="muted">now · peak {percent(peak, 0)}</span>
                </span>
                <LimitSpark points={series} />
              </div>
            );
          })}
        </div>
        <p className="muted num">
          Peak use:{" "}
          {peaks
            .filter((item) => item.peak > 0)
            .map((item) => `${item.name} ${percent(item.peak, 0)}`)
            .join(" · ") || "none"}
        </p>
      </Loadable>
      <h3 className="panel-title">Near misses: orders that passed using 80% or more of a limit</h3>
      <Loadable
        query={misses}
        isEmpty={(misses.data ?? []).length === 0}
        empty="None in this window"
      >
        <HTMLTable compact striped className="num" style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th>Time</Th>
              <Th>Order</Th>
              <Th>Limit</Th>
              <Th className="right">Used</Th>
            </tr>
          </thead>
          <tbody>
            {[...(misses.data ?? [])]
              .sort((a, b) => b.used - a.used)
              .map((item) => (
                <tr key={`${item.time}-${item.limit}`}>
                  <td>{time(item.time)}</td>
                  <td>
                    {item.side} {quantity(item.qty)} {item.symbol}
                  </td>
                  <td>{item.limit}</td>
                  <td className="right">
                    <Tag minimal intent={item.used >= 0.95 ? "danger" : "warning"}>
                      {percent(item.used, 0)}
                    </Tag>
                  </td>
                </tr>
              ))}
          </tbody>
        </HTMLTable>
      </Loadable>
    </section>
  );
}
