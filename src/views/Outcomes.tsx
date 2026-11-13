import { HTMLTable, Tag } from "@blueprintjs/core";
import { api } from "../api/client";
import { ACCENT_DARK, ACCENT_LIGHT, Chart, GRAY } from "../components/Chart";
import { PanelTitle, Th } from "../components/Explained";
import { percent, signedPercent } from "../format";
import { useDark } from "../shell/theme";
import { nameOf } from "./xai";

const WINDOWS = [30, 90, 365];

const rate = (value: number | null | undefined) => (value == null ? "—" : percent(value, 0));

export function Outcomes() {
  const dark = useDark();
  const found = api.useQuery("get", "/systematic/outcomes", undefined, { staleTime: 600_000 });
  const data = found.data;
  if (!data) return <p className="muted">{found.isLoading ? "Judging signals…" : "No outcomes"}</p>;
  const sources = [...new Set(data.accuracy.map((item) => item.source))];
  const regimes = [...new Set(data.regimes.map((item) => item.regime))].sort();
  const cell = (source: string, window: number) =>
    data.accuracy.find((item) => item.source === source && item.window === window);
  const drifted = (source: string) => {
    const short = cell(source, 30)?.hit_rate;
    const long = cell(source, 365)?.hit_rate;
    return short != null && long != null && Math.abs(short - long) >= 0.1;
  };
  const regime = (source: string, name: string) =>
    data.regimes.find((item) => item.source === source && item.regime === name);
  const bins = data.calibration.filter((item) => item.hit_rate != null);
  const market = data.regime;
  const agents = [...new Set(data.importance.map((item) => item.algorithm))];
  return (
    <div className="stack">
      {market ? (
        <section className="panel stack">
          <div className="row">
            <h2 className="panel-title grow">Market regime, hidden Markov model of SPUS</h2>
            <Tag
              large
              minimal
              intent={
                market.label === "volatile"
                  ? "danger"
                  : market.label === "trending"
                    ? "success"
                    : "none"
              }
            >
              {market.label} on {market.day}
            </Tag>
          </div>
          <HTMLTable compact className="num" style={{ width: "100%" }}>
            <thead>
              <tr>
                <Th>State</Th>
                <Th className="right">Probability now</Th>
                <Th className="right">Daily mean</Th>
                <Th className="right">Daily volatility</Th>
                <Th className="right">Typical stay</Th>
              </tr>
            </thead>
            <tbody>
              {market.states.map((state) => (
                <tr key={state.label}>
                  <td>{state.label}</td>
                  <td className="right">{percent(state.probability, 0)}</td>
                  <td className="right">{signedPercent(state.mean, 2)}</td>
                  <td className="right">{percent(state.volatility, 2)}</td>
                  <td className="right">
                    {Number.isFinite(state.expected_days)
                      ? `${state.expected_days.toFixed(0)} days`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
          <div className="regime-strip" role="img" aria-label="Regime over the last 120 sessions">
            {market.history.map(([day, label]) => (
              <span key={String(day)} className={`regime-${label}`} title={`${day}: ${label}`} />
            ))}
          </div>
          <span className="muted">Last 120 sessions, oldest on the left.</span>
        </section>
      ) : null}
      <div className="settings-grid">
        <section className="panel">
          <PanelTitle>Right the next day</PanelTitle>
          <HTMLTable compact striped className="num" style={{ width: "100%" }}>
            <thead>
              <tr>
                <Th>Source</Th>
                {WINDOWS.map((window) => (
                  <th key={window} className="right">
                    {window} days
                  </th>
                ))}
                {regimes.map((name) => (
                  <th key={name} className="right">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source}>
                  <td>
                    {source}{" "}
                    {drifted(source) ? (
                      <Tag
                        minimal
                        intent="warning"
                        title="30-day hit rate is 10 points or more from the 365-day one"
                      >
                        drifting
                      </Tag>
                    ) : null}
                  </td>
                  {WINDOWS.map((window) => {
                    const item = cell(source, window);
                    return (
                      <td key={window} className="right">
                        {rate(item?.hit_rate)} <span className="muted">({item?.signals ?? 0})</span>
                      </td>
                    );
                  })}
                  {regimes.map((name) => {
                    const item = regime(source, name);
                    return (
                      <td key={name} className="right">
                        {rate(item?.hit_rate)} <span className="muted">({item?.signals ?? 0})</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </HTMLTable>
          <p className="muted">A coin toss scores 50%; the count of signals is in brackets.</p>
        </section>
        <section className="panel">
          <PanelTitle>Calibration: stated confidence against hit rate</PanelTitle>
          <Chart
            label="Share of signals right against each source's confidence"
            height={240}
            option={{
              tooltip: { trigger: "axis" },
              legend: { top: 0 },
              grid: { top: 28 },
              xAxis: {
                type: "value",
                min: 0,
                max: 1,
                name: "confidence",
                nameLocation: "middle",
                nameGap: 24,
              },
              yAxis: {
                type: "value",
                min: 0,
                max: 1,
                axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` },
              },
              series: [
                ...sources
                  .filter((source) => bins.some((item) => item.source === source))
                  .map((source, index) => ({
                    type: "line" as const,
                    name: source,
                    symbolSize: 8,
                    data: bins
                      .filter((item) => item.source === source)
                      .map((item) => [(item.low + item.high) / 2, item.hit_rate]),
                    color: index === 0 ? (dark ? ACCENT_DARK : ACCENT_LIGHT) : undefined,
                  })),
                {
                  type: "line" as const,
                  name: "perfectly calibrated",
                  data: [
                    [0, 0],
                    [1, 1],
                  ],
                  color: GRAY,
                  lineStyle: { type: "dashed" as const },
                  symbol: "none",
                },
              ],
            }}
          />
          <p className="muted">
            Agent confidence is recorded from 7 November 2026, so their curves fill in as decisions
            are judged; FinBERT's covers a year of headlines.
          </p>
        </section>
      </div>
      <section className="panel">
        <PanelTitle>What the agents rely on, mean SHAP push and rank</PanelTitle>
        <HTMLTable compact striped className="num" style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th>Indicator</Th>
              {agents.map((agent) => (
                <th key={agent} className="right">
                  {agent} 30 / 60 / 90 days
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...new Set(data.importance.map((item) => item.group))].map((group) => (
              <tr key={group}>
                <td>{nameOf(group)}</td>
                {agents.map((agent) => {
                  const item = data.importance.find(
                    (row) => row.algorithm === agent && row.group === group,
                  );
                  const rank = (window: number) => item?.rank[String(window)];
                  const moved = (rank(90) ?? 0) - (rank(30) ?? 0);
                  return (
                    <td key={agent} className="right">
                      #{rank(30) ?? "—"} / #{rank(60) ?? "—"} / #{rank(90) ?? "—"}{" "}
                      {moved > 0 ? (
                        <Tag minimal intent="success">
                          up {moved}
                        </Tag>
                      ) : moved < 0 ? (
                        <Tag minimal intent="warning">
                          down {-moved}
                        </Tag>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </HTMLTable>
        <p className="muted">
          From the explained decisions; a rank that climbs means the agent leans on that indicator
          more lately.
        </p>
      </section>
      <section className="panel">
        <PanelTitle>Recent outcomes</PanelTitle>
        <HTMLTable compact striped style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th>Day</Th>
              <Th>Source</Th>
              <Th>Symbol</Th>
              <Th>Signal</Th>
              <Th className="right">Confidence</Th>
              <Th className="right">Next day</Th>
              <Th>Right?</Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody className="num">
            {data.recent.map((row) => (
              <tr key={`${row.source}-${row.day}-${row.symbol}-${row.detail}`}>
                <td>{row.day}</td>
                <td>{row.source}</td>
                <td>{row.symbol}</td>
                <td>{row.direction}</td>
                <td className="right">
                  {row.confidence == null ? "—" : percent(row.confidence, 0)}
                </td>
                <td className="right">{signedPercent(row.realized)}</td>
                <td>
                  {row.right == null ? (
                    <span className="muted">pending</span>
                  ) : (
                    <Tag minimal intent={row.right ? "success" : "danger"}>
                      {row.right ? "yes" : "no"}
                    </Tag>
                  )}
                </td>
                <td
                  className="muted"
                  style={{
                    maxWidth: 380,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
        {data.notes.map((note) => (
          <p key={note} className="muted" style={{ margin: 0 }}>
            {note}
          </p>
        ))}
      </section>
    </div>
  );
}
