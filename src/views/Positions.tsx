import {
  Button,
  Callout,
  Dialog,
  DialogBody,
  DialogFooter,
  Drawer,
  DrawerSize,
  FormGroup,
  HTMLTable,
  InputGroup,
  SegmentedControl,
  Tag,
} from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import type { ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useMemo, useState } from "react";
import { useLocation } from "react-router";
import { api, detail, fetchClient } from "../api/client";
import { numClass } from "../components/cells";
import { Explained, Th } from "../components/Explained";
import { Figure } from "../components/Figure";
import { aligned, darkGrid, lightGrid } from "../components/Grid";
import { money, quantity, signedMoney, time, tone } from "../format";
import { page } from "../glossary";
import { focusSymbol, useCommand } from "../shell/commands";
import { EnvChip } from "../shell/EnvChip";
import { HotkeyTip } from "../shell/HotkeyTip";
import { useDark } from "../shell/theme";
import { quoteStale } from "../stream/fresh";
import { useStream } from "../stream/store";
import { POSITION_COLUMNS, positionRows, type Row } from "./Dashboard";
import { Reconciliation } from "./Ledger";
import { Sizing } from "./Sizing";

type Method = "fifo" | "average" | "specific";

interface Detailed extends Row {
  shariah: string;
  allowed: boolean | null;
  days: number | null;
}

const COLUMNS: ColDef<Detailed>[] = [
  ...(POSITION_COLUMNS as ColDef<Detailed>[]),
  {
    field: "shariah",
    headerName: "Shariah",
    cellRenderer: (params: { data?: Detailed }) =>
      params.data?.allowed == null ? "—" : params.data.allowed ? "Compliant" : "Not compliant",
    cellClass: (params) => (params.data?.allowed === false ? "loss" : ""),
    tooltipField: "shariah",
  },
  { field: "days", headerName: "Days held", cellClass: numClass, type: "rightAligned" },
];

export function closePhrase(count: number): string {
  return `CLOSE ${count} POSITION${count === 1 ? "" : "S"}`;
}

function BulkClose({ symbols, onDone }: { symbols: string[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  useCommand("flatten-selected", () => symbols.length > 0 && setOpen(true));
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const phrase = closePhrase(symbols.length);
  const submit = async () => {
    setBusy(true);
    setError(null);
    const failed: string[] = [];
    for (const symbol of symbols) {
      const { error: found } = await fetchClient.DELETE("/positions/{symbol}", {
        params: { path: { symbol } },
      });
      if (found) failed.push(`${symbol}: ${detail(found)}`);
    }
    setBusy(false);
    client.invalidateQueries();
    if (failed.length) setError(failed.join("; "));
    else {
      setOpen(false);
      setTyped("");
      onDone();
    }
  };
  return (
    <>
      <HotkeyTip combo="f">
        <Button
          intent="danger"
          icon="cross"
          disabled={symbols.length === 0}
          onClick={() => setOpen(true)}
        >
          Close selected
        </Button>
      </HotkeyTip>
      <Dialog isOpen={open} onClose={() => setOpen(false)} title="Close positions">
        <DialogBody>
          <p>Market orders sell all of {symbols.join(", ")}.</p>
          <FormGroup label={`Type ${phrase} to confirm`} labelFor="close-phrase">
            <InputGroup id="close-phrase" value={typed} onValueChange={setTyped} autoFocus />
          </FormGroup>
          {error ? <Callout intent="danger">{error}</Callout> : null}
        </DialogBody>
        <DialogFooter
          actions={
            <Button intent="danger" disabled={typed !== phrase} loading={busy} onClick={submit}>
              Close
            </Button>
          }
        />
      </Dialog>
    </>
  );
}

function PositionDrawer({ row, onClose }: { row: Detailed | null; onClose: () => void }) {
  const [method, setMethod] = useState<Method>("fifo");
  const symbol = row?.symbol ?? "";
  const enabled = { enabled: Boolean(row) };
  const fills = api.useQuery(
    "get",
    "/ledger/fills",
    { params: { query: { symbol, limit: 200 } } },
    enabled,
  );
  const lots = api.useQuery(
    "get",
    "/ledger/lots",
    { params: { query: { symbol, method } } },
    enabled,
  );
  const realized = api.useQuery(
    "get",
    "/ledger/realized",
    { params: { query: { symbol, method } } },
    enabled,
  );
  const pair = row?.asset_class === "crypto" ? `${symbol.replace(/USD$/, "")}/USD` : symbol;
  const screen = api.useQuery(
    "get",
    "/compliance/screen/{symbol}",
    { params: { path: { symbol: pair } } },
    enabled,
  );
  const news = api.useQuery(
    "get",
    "/scanner/news/{symbol}",
    { params: { path: { symbol } } },
    {
      enabled: Boolean(row) && row?.asset_class !== "crypto",
    },
  );
  const book = api.useQuery(
    "get",
    "/book/view",
    { params: { query: { symbol: pair, levels: 5 } } },
    {
      enabled: Boolean(row) && row?.asset_class === "crypto",
    },
  );
  return (
    <Drawer
      isOpen={Boolean(row)}
      onClose={onClose}
      size={DrawerSize.LARGE}
      title={symbol}
      icon="th-list"
    >
      {row ? (
        <div style={{ padding: 16, overflowY: "auto" }} className="stack">
          <Sizing
            symbol={row.symbol}
            value={row.value}
            price={row.price}
            equity={row.weight ? row.value / row.weight : 0}
            whole={row.asset_class !== "crypto"}
          />
          <div className="strip">
            <Figure label="Value" value={money(row.value)} />
            <Figure
              label="Unrealized"
              value={signedMoney(row.unrealized_pl)}
              tone={tone(row.unrealized_pl)}
            />
            <Figure
              label="Realized"
              value={signedMoney(realized.data?.summary.gain)}
              tone={tone(realized.data?.summary.gain)}
            />
            <Figure
              label="Shariah"
              value={screen.data ? (screen.data.allowed ? "Compliant" : "Not compliant") : "—"}
              note={screen.data?.reason}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="panel-title" style={{ margin: 0 }}>
              Cost basis
            </span>
            <SegmentedControl
              small
              value={method}
              onValueChange={(value) => setMethod(value as Method)}
              options={[
                { label: "FIFO", value: "fifo" },
                { label: "Average", value: "average" },
                { label: "Specific lot", value: "specific" },
              ]}
            />
          </div>
          <section>
            <h3 className="panel-title">Open lots</h3>
            <HTMLTable compact striped style={{ width: "100%" }}>
              <thead>
                <tr>
                  <Th>Opened</Th>
                  <Th>Qty</Th>
                  <Th>Unit cost</Th>
                  <Th>Basis</Th>
                  <Th>Wash sale</Th>
                  <Th>P&L</Th>
                </tr>
              </thead>
              <tbody className="num">
                {(lots.data ?? []).map((lot) => (
                  <tr key={lot.id}>
                    <td>{time(lot.opened)}</td>
                    <td>{quantity(lot.qty)}</td>
                    <td>{money(lot.unit_cost)}</td>
                    <td>{money(lot.basis)}</td>
                    <td>{lot.wash ? money(lot.wash) : "—"}</td>
                    <td className={tone(lot.unrealized)}>{signedMoney(lot.unrealized)}</td>
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          </section>
          <section>
            <h3 className="panel-title">Trades</h3>
            <HTMLTable compact striped style={{ width: "100%" }}>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Side</Th>
                  <Th>Qty</Th>
                  <Th>Price</Th>
                  <Th>Value</Th>
                  <Th>Fee (coin)</Th>
                  <Th>Env</Th>
                </tr>
              </thead>
              <tbody className="num">
                {(fills.data ?? []).map((fill) => (
                  <tr key={fill.id}>
                    <td>{time(fill.time)}</td>
                    <td>{fill.side}</td>
                    <td>{quantity(fill.qty)}</td>
                    <td>{money(fill.price)}</td>
                    <td>{money(fill.value)}</td>
                    <td>{fill.fee_qty == null ? "—" : quantity(fill.fee_qty)}</td>
                    <td>
                      <EnvChip />
                    </td>
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          </section>
          {book.data ? (
            <section>
              <h3 className="panel-title">Order book</h3>
              <HTMLTable compact className="num">
                <thead>
                  <tr>
                    <Th>Bid size</Th>
                    <Th>Bid</Th>
                    <Th>Ask</Th>
                    <Th>Ask size</Th>
                  </tr>
                </thead>
                <tbody>
                  {book.data.bids.map((bid, index) => {
                    const ask = book.data?.asks[index];
                    return (
                      <tr key={bid.price}>
                        <td>{quantity(bid.size)}</td>
                        <td className="gain">{money(bid.price)}</td>
                        <td className="loss">{ask ? money(ask.price) : ""}</td>
                        <td>{ask ? quantity(ask.size) : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </HTMLTable>
            </section>
          ) : null}
          {news.data ? (
            <section>
              <h3 className="panel-title">Headlines</h3>
              {news.data.headlines.length === 0 ? <p className="muted">No headlines</p> : null}
              {news.data.headlines.slice(0, 10).map((item) => (
                <p key={item.id} style={{ margin: "4px 0" }}>
                  <span className="num muted">{time(item.time)} </span>
                  {item.headline}{" "}
                  {item.sentiment ? (
                    <Tag
                      minimal
                      intent={
                        item.sentiment.score > 0.2
                          ? "success"
                          : item.sentiment.score < -0.2
                            ? "danger"
                            : "none"
                      }
                    >
                      {item.sentiment.score.toFixed(2)}
                    </Tag>
                  ) : null}
                </p>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

const ALIGNED = aligned(COLUMNS);

export function Positions() {
  const dark = useDark();
  const account = api.useQuery("get", "/account", undefined, { refetchInterval: 15_000 });
  const positions = api.useQuery("get", "/positions", undefined, { refetchInterval: 15_000 });
  const holdings = api.useQuery("get", "/compliance/holdings");
  const ledger = api.useQuery("get", "/ledger/lots", { params: { query: { method: "fifo" } } });
  const stream = useStream();
  const clock = api.useQuery("get", "/market/clock", undefined, { refetchInterval: 60_000 });
  const [selected, setSelected] = useState<string[]>([]);
  const asked = (useLocation().state as { symbol?: string } | null)?.symbol;
  const [chosen, setChosen] = useState<string | null>(asked ?? null);
  const rows = useMemo<Detailed[]>(() => {
    const verdicts = new Map((holdings.data ?? []).map((item) => [item.symbol, item.screening]));
    const opened = new Map<string, number>();
    for (const lot of ledger.data ?? []) {
      const days = lot.days;
      opened.set(lot.symbol, Math.max(opened.get(lot.symbol) ?? 0, days));
    }
    return positionRows(positions.data ?? [], account.data?.equity ?? 0, stream.quotes).map(
      (row) => {
        const verdict = verdicts.get(row.symbol);
        return {
          ...row,
          shariah: verdict?.reason ?? "",
          allowed: verdict ? verdict.allowed : null,
          days: opened.get(row.symbol) ?? null,
        };
      },
    );
  }, [positions.data, account.data, stream.quotes, holdings.data, ledger.data]);
  const open = rows.find((row) => row.symbol === chosen) ?? null;
  return (
    <div className="stack">
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <h1 className="panel-title" style={{ margin: 0, flex: 1 }}>
          <Explained text={page("Positions")}>Positions</Explained>
        </h1>
        <BulkClose
          symbols={selected.length ? selected : chosen ? [chosen] : []}
          onDone={() => setSelected([])}
        />
      </div>
      <div className="panel">
        <AgGridReact<Detailed>
          theme={dark ? darkGrid : lightGrid}
          rowData={rows}
          columnDefs={ALIGNED}
          defaultColDef={{
            sortable: true,
            resizable: true,
            minWidth: 70,
            enableCellChangeFlash: true,
          }}
          domLayout="autoHeight"
          getRowId={(params) => params.data.symbol}
          rowSelection={{ mode: "multiRow" }}
          onSelectionChanged={(event) =>
            setSelected(event.api.getSelectedRows().map((row) => row.symbol))
          }
          onRowClicked={(event) => {
            if (
              event.data &&
              !(event.event?.target as HTMLElement | null)?.closest(".ag-selection-checkbox")
            )
              setChosen(event.data.symbol);
            if (event.data) focusSymbol(event.data.symbol);
          }}
          overlayNoRowsTemplate="No positions"
          autoSizeStrategy={{ type: "fitGridWidth" }}
          getRowClass={(params) => {
            const symbol = params.data?.symbol ?? "";
            const quote = stream.quotes[symbol] ?? stream.quotes[symbol.replace(/USD$/, "/USD")];
            return quoteStale(symbol, quote?.time, clock.data?.is_open ?? false, Date.now())
              ? "stale-row"
              : undefined;
          }}
        />
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Faded rows have no quote for 30 seconds (coins) or a minute (stocks while the market is
          open): their prices are the last received.
        </p>
      </div>
      <Reconciliation />
      <PositionDrawer row={open} onClose={() => setChosen(null)} />
    </div>
  );
}
