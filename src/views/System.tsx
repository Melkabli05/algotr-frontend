import { HTMLTable, Tag } from "@blueprintjs/core";
import { api } from "../api/client";
import { Explained, PanelTitle, Th } from "../components/Explained";
import { Figure } from "../components/Figure";
import { Loadable } from "../components/Loadable";
import { day, percent, time } from "../format";
import { page } from "../glossary";

const LEVEL = { ok: "success", warn: "warning", error: "danger", idle: "none" } as const;

const bytes = (value: number | null | undefined) =>
  value == null
    ? "—"
    : value > 1e9
      ? `${(value / 1e9).toFixed(1)} GB`
      : value > 1e6
        ? `${(value / 1e6).toFixed(1)} MB`
        : `${(value / 1e3).toFixed(0)} kB`;

const ms = (value: number | null | undefined) => (value == null ? "—" : `${value.toFixed(0)} ms`);

function Components() {
  const health = api.useQuery("get", "/system/health", undefined, { refetchInterval: 30_000 });
  const freshness = api.useQuery("get", "/system/freshness", undefined, {
    refetchInterval: 15_000,
  });
  const connection = api.useQuery("get", "/system/connection", undefined, {
    refetchInterval: 15_000,
  });
  const data = health.data;
  return (
    <Loadable query={health} rows={6}>
      <section className="panel strip">
        <Figure
          lead
          label="API p50"
          value={ms(data?.api.p50)}
          note={`${data?.api.requests ?? 0} requests, 15 min`}
        />
        <Figure label="p95" value={ms(data?.api.p95)} />
        <Figure label="p99" value={ms(data?.api.p99)} />
        <Figure label="Server errors" value={data?.api.errors ?? 0} />
        <Figure
          label="Alpaca API"
          value={ms(data?.broker.last_ms)}
          note={data?.broker.last_ok ? `ok ${time(data.broker.last_ok)}` : "no answer yet"}
        />
        <Figure label="Alpaca error rate" value={percent(data?.broker.error_rate, 0)} />
      </section>
      {data?.broker.last_error ? (
        <p className="loss">Last Alpaca error: {data.broker.last_error}</p>
      ) : null}
      <div className="settings-grid">
        <section className="panel">
          <PanelTitle>Order path</PanelTitle>
          <HTMLTable compact className="num" style={{ width: "100%" }}>
            <thead>
              <tr>
                <Th>Stage</Th>
                <Th className="right">Median</Th>
                <Th className="right">Worst</Th>
                <Th className="right">Samples</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.path ?? []).map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td className="right">
                    {item.median == null
                      ? "—"
                      : `${item.median.toFixed(item.unit === "s" ? 1 : 0)} ${item.unit}`}
                  </td>
                  <td className="right">
                    {item.worst == null
                      ? "—"
                      : `${item.worst.toFixed(item.unit === "s" ? 1 : 0)} ${item.unit}`}
                  </td>
                  <td className="right">{item.samples}</td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
          <p className="muted">
            Order attempts:{" "}
            {Object.entries(data?.outcomes ?? {})
              .map(([outcome, count]) => `${count} ${outcome}`)
              .join(", ") || "none"}
            . Slowest routes:{" "}
            {(data?.api.slowest ?? [])
              .map(([route, value]) => `${route} ${ms(Number(value))}`)
              .join(", ") || "—"}
          </p>
        </section>
        <section className="panel">
          <PanelTitle>Streams</PanelTitle>
          <HTMLTable compact className="num" style={{ width: "100%" }}>
            <tbody>
              {(connection.data?.streams ?? []).map((item) => (
                <tr key={item.name}>
                  <td>Alpaca {item.name}</td>
                  <td>
                    <Tag
                      minimal
                      intent={connection.data?.connected[item.name] ? "success" : "danger"}
                    >
                      {connection.data?.connected[item.name] ? "connected" : "down"}
                    </Tag>
                  </td>
                  <td className="right">{item.reconnects} reconnects</td>
                  <td className="right">{item.errors} errors</td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </section>
        <section className="panel">
          <PanelTitle>Data feeds</PanelTitle>
          <HTMLTable compact style={{ width: "100%" }}>
            <tbody>
              {(freshness.data?.feeds ?? []).map((feed) => (
                <tr key={feed.name}>
                  <td>{feed.name}</td>
                  <td>
                    <Tag minimal intent={LEVEL[feed.level]}>
                      {feed.level}
                    </Tag>
                  </td>
                  <td className="num">{feed.detail}</td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </section>
        <section className="panel">
          <PanelTitle>Models and storage</PanelTitle>
          <HTMLTable compact className="num" style={{ width: "100%" }}>
            <tbody>
              <tr>
                <td>Sidecar</td>
                <td colSpan={2}>
                  {data?.sidecar ? "installed" : "not installed"}
                  {data?.busy ? ` · busy: ${data.busy}` : " · idle"}
                </td>
              </tr>
              {(data?.models ?? []).map((model) => (
                <tr key={model.algorithm}>
                  <td>{model.algorithm.toUpperCase()}</td>
                  <td>trained {model.trained ? day(model.trained) : "—"}</td>
                  <td>retrains {model.next_retrain ? day(model.next_retrain) : "—"}</td>
                </tr>
              ))}
              {(data?.storage ?? []).map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td colSpan={2}>{bytes(item.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
          <p className="muted">Models run on the CPU; there is no GPU to report.</p>
        </section>
      </div>
    </Loadable>
  );
}

const INTENTS = { ok: "success", warn: "warning", error: "danger" } as const;

export function System() {
  const status = api.useQuery("get", "/status", undefined, { refetchInterval: 30_000 });
  const jobs = api.useQuery("get", "/system/jobs", undefined, { refetchInterval: 30_000 });
  return (
    <div className="stack">
      <h1 className="panel-title" style={{ margin: 0 }}>
        <Explained text={page("System")}>System</Explained>
      </h1>
      <Components />
      <div className="settings-grid">
        <section className="panel stack">
          <PanelTitle>Checks</PanelTitle>
          <HTMLTable compact>
            <tbody>
              {(status.data?.checks ?? []).map((check) => (
                <tr key={check.name}>
                  <td>{check.name}</td>
                  <td>
                    <Tag minimal intent={INTENTS[check.level]}>
                      {check.level}
                    </Tag>
                  </td>
                  <td>{check.detail}</td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </section>
        <section className="panel stack">
          <PanelTitle>Scheduled jobs</PanelTitle>
          <HTMLTable compact>
            <thead>
              <tr>
                <Th>Part</Th>
                <Th>Job</Th>
                <Th>Next run</Th>
              </tr>
            </thead>
            <tbody>
              {(jobs.data ?? []).map((job) => (
                <tr key={`${job.owner}-${job.id}`}>
                  <td>{job.owner}</td>
                  <td className="num">{job.id}</td>
                  <td className="num">{job.next_run ? time(job.next_run) : "paused"}</td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </section>
      </div>
    </div>
  );
}
