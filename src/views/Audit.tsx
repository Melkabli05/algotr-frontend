import { Button, Callout, HTMLSelect, Tag } from "@blueprintjs/core";
import type { ColDef } from "ag-grid-community";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { Explained } from "../components/Explained";
import { Grid } from "../components/Grid";
import { download } from "../csv";
import { time } from "../format";
import { page } from "../glossary";
import { useDark } from "../shell/theme";

type Entry = components["schemas"]["Entry"];

const summary = (payload: Entry["payload"]) => JSON.stringify(payload).slice(0, 240);

const COLUMNS: ColDef<Entry>[] = [
  { field: "seq", headerName: "#", width: 70, maxWidth: 80, cellClass: "num", sort: "desc" },
  { field: "time", headerName: "Time", valueFormatter: (p) => time(p.value), width: 130 },
  { field: "kind", headerName: "Kind", filter: true, width: 140 },
  {
    field: "payload",
    headerName: "Payload",
    flex: 4,
    valueFormatter: (p) => summary(p.value),
    cellClass: "num muted",
  },
];

export function Audit() {
  const dark = useDark();
  const trail = api.useQuery("get", "/systematic/audit", { params: { query: { limit: 2000 } } });
  const [kind, setKind] = useState("all");
  const [chosen, setChosen] = useState<Entry>();
  const entries = trail.data?.entries ?? [];
  const kinds = useMemo(() => [...new Set(entries.map((entry) => entry.kind))].sort(), [entries]);
  const rows = entries.filter((entry) => kind === "all" || entry.kind === kind);
  const check = trail.data?.verification;
  return (
    <div className="stack">
      <h1 className="panel-title" style={{ margin: 0 }}>
        <Explained text={page("Audit log")}>Audit log</Explained>
      </h1>
      {check ? (
        <Callout intent={check.valid ? "success" : "danger"} compact>
          {check.valid
            ? `${check.entries} entries, hash chain intact.`
            : `Hash chain broken at #${check.broken_at}.`}
        </Callout>
      ) : null}
      <section className="panel stack">
        <div className="row">
          <h2 className="panel-title grow">Entries</h2>
          <HTMLSelect
            aria-label="Kind"
            value={kind}
            options={[{ value: "all", label: "All kinds" }, ...kinds]}
            onChange={(event) => setKind(event.currentTarget.value)}
          />
          <Button
            small
            icon="download"
            disabled={!rows.length}
            onClick={() =>
              download(
                "audit.csv",
                rows.map((entry) => ({
                  seq: entry.seq,
                  time: entry.time,
                  kind: entry.kind,
                  payload: JSON.stringify(entry.payload),
                  hash: entry.hash,
                })),
              )
            }
          >
            Export CSV
          </Button>
        </div>
        <Grid
          rows={rows}
          columns={COLUMNS}
          rowId={(entry) => String(entry.seq)}
          onRow={setChosen}
          height={460}
          empty="No entries"
          dark={dark}
        />
      </section>
      {chosen ? (
        <section className="panel stack">
          <div className="row">
            <h2 className="panel-title grow">
              #{chosen.seq} {chosen.kind}
            </h2>
            <Tag minimal className="num">
              {chosen.hash.slice(0, 16)}
            </Tag>
            <Button
              small
              minimal
              icon="cross"
              aria-label="Close"
              onClick={() => setChosen(undefined)}
            />
          </div>
          <pre className="payload">{JSON.stringify(chosen.payload, null, 2)}</pre>
        </section>
      ) : null}
    </div>
  );
}
