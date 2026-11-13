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
  NumericInput,
  Tab,
  Tabs,
  Tag,
} from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import type { ColDef, GridApi } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useMemo, useRef, useState } from "react";
import { api, detail } from "../api/client";
import type { components } from "../api/schema";
import { moneyCell, numClass, quantityCell, timeCell } from "../components/cells";
import { Explained, Th } from "../components/Explained";
import { aligned, darkGrid, lightGrid } from "../components/Grid";
import { money, quantity, time } from "../format";
import { page } from "../glossary";
import { focusSymbol, useCommand } from "../shell/commands";
import { ENV_COLUMN } from "../shell/EnvChip";
import { HotkeyTip } from "../shell/HotkeyTip";
import { useDark } from "../shell/theme";
import { LotPicks } from "./Ledger";

type Order = components["schemas"]["Order"];
type Algo = components["schemas"]["Algo"];

const WORKING = ["new", "accepted", "partially_filled", "held", "pending_new", "pending_replace"];

export function stages(order: Order): { label: string; at: string }[] {
  const steps: [string, string | null | undefined][] = [
    ["Created", order.created_at],
    ["Submitted", order.submitted_at],
    ["Replaced", order.replaced_at],
    ["Filled", order.filled_at],
    ["Canceled", order.canceled_at],
    ["Expired", order.expired_at],
    ["Failed", order.failed_at],
  ];
  return steps
    .filter((step): step is [string, string] => Boolean(step[1]))
    .map(([label, at]) => ({ label, at }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

const COLUMNS: ColDef<Order>[] = [
  ENV_COLUMN,
  {
    field: "submitted_at",
    headerName: "Submitted",
    valueFormatter: timeCell,
    cellClass: numClass,
    sort: "desc",
  },
  { field: "symbol", headerName: "Symbol" },
  { field: "side", headerName: "Side" },
  { field: "type", headerName: "Type" },
  {
    field: "qty",
    headerName: "Qty",
    valueFormatter: quantityCell,
    cellClass: numClass,
    type: "rightAligned",
  },
  {
    field: "filled_qty",
    headerName: "Filled",
    valueFormatter: quantityCell,
    cellClass: numClass,
    type: "rightAligned",
  },
  {
    field: "limit_price",
    headerName: "Limit",
    valueFormatter: moneyCell,
    cellClass: numClass,
    type: "rightAligned",
  },
  {
    field: "filled_avg_price",
    headerName: "Avg fill",
    valueFormatter: moneyCell,
    cellClass: numClass,
    type: "rightAligned",
  },
  { field: "time_in_force", headerName: "TIF" },
  { field: "status", headerName: "Status" },
];

function ChangeOrder({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const [qty, setQty] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const client = useQueryClient();
  const change = api.useMutation("patch", "/orders/{order_id}", {
    onSuccess: () => {
      client.invalidateQueries();
      onClose();
    },
  });
  if (!order) return null;
  return (
    <Dialog isOpen onClose={onClose} title={`Change ${order.symbol} ${order.side}`}>
      <DialogBody>
        <FormGroup label="Quantity" labelFor="change-qty">
          <NumericInput
            id="change-qty"
            fill
            placeholder={quantity(order.qty)}
            value={qty ?? ""}
            onValueChange={(value) => setQty(Number.isFinite(value) ? value : null)}
          />
        </FormGroup>
        {order.limit_price != null ? (
          <FormGroup label="Limit price" labelFor="change-price">
            <NumericInput
              id="change-price"
              fill
              placeholder={money(order.limit_price)}
              value={price ?? ""}
              onValueChange={(value) => setPrice(Number.isFinite(value) ? value : null)}
            />
          </FormGroup>
        ) : null}
        {change.error ? <Callout intent="danger">{detail(change.error)}</Callout> : null}
      </DialogBody>
      <DialogFooter
        actions={
          <Button
            intent="primary"
            disabled={qty == null && price == null}
            loading={change.isPending}
            onClick={() =>
              change.mutate({
                params: { path: { order_id: order.id } },
                body: { qty: qty ?? undefined, limit_price: price ?? undefined },
              })
            }
          >
            Change
          </Button>
        }
      />
    </Dialog>
  );
}

function CancelAll({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  useCommand("cancel-all", () => count > 0 && setOpen(true));
  const [typed, setTyped] = useState("");
  const client = useQueryClient();
  const cancel = api.useMutation("delete", "/orders", {
    onSuccess: () => {
      client.invalidateQueries();
      setOpen(false);
      setTyped("");
    },
  });
  return (
    <>
      <HotkeyTip combo="shift+del">
        <Button icon="disable" intent="danger" disabled={count === 0} onClick={() => setOpen(true)}>
          Cancel all
        </Button>
      </HotkeyTip>
      <Dialog isOpen={open} onClose={() => setOpen(false)} title="Cancel every open order">
        <DialogBody>
          <p>Stops every iceberg and algorithm order, then cancels every open order.</p>
          <FormGroup label="Type CANCEL ALL to confirm" labelFor="cancel-all">
            <InputGroup id="cancel-all" value={typed} onValueChange={setTyped} autoFocus />
          </FormGroup>
          {cancel.isError ? (
            <Callout intent="danger">The orders could not be canceled</Callout>
          ) : null}
        </DialogBody>
        <DialogFooter
          actions={
            <Button
              intent="danger"
              disabled={typed !== "CANCEL ALL"}
              loading={cancel.isPending}
              onClick={() => cancel.mutate({})}
            >
              Cancel all
            </Button>
          }
        />
      </Dialog>
    </>
  );
}

function OrderDrawer({
  order,
  parent,
  onClose,
}: {
  order: Order | null;
  parent: Algo | undefined;
  onClose: () => void;
}) {
  return (
    <Drawer
      isOpen={Boolean(order)}
      onClose={onClose}
      size={DrawerSize.STANDARD}
      title={order ? `${order.side} ${quantity(order.qty)} ${order.symbol}` : ""}
      icon="exchange"
    >
      {order ? (
        <div style={{ padding: 16 }} className="stack">
          <section>
            <h3 className="panel-title">Lifecycle</h3>
            <HTMLTable compact>
              <tbody>
                {stages(order).map((stage) => (
                  <tr key={stage.label}>
                    <td>{stage.label}</td>
                    <td className="num">{time(stage.at)}</td>
                  </tr>
                ))}
                <tr>
                  <td>Status</td>
                  <td>
                    <Tag minimal>{order.status}</Tag>
                  </td>
                </tr>
              </tbody>
            </HTMLTable>
          </section>
          {parent ? (
            <section>
              <h3 className="panel-title">
                {parent.algo.toUpperCase()} parent · {quantity(parent.qty)} {parent.symbol}
              </h3>
              <p className="num">
                Arrival {money(parent.arrival_price)} · Average {money(parent.average_price)} ·
                Slippage{" "}
                {parent.slippage_bps == null ? "—" : `${parent.slippage_bps.toFixed(1)} bps`}
              </p>
              <HTMLTable compact striped className="num">
                <thead>
                  <tr>
                    <Th>Slice</Th>
                    <Th>Qty</Th>
                    <Th>Filled</Th>
                    <Th>Average</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {parent.children.map((child) => (
                    <tr key={child.order}>
                      <td>{child.interval + 1}</td>
                      <td>{quantity(child.qty)}</td>
                      <td>{quantity(child.filled_qty)}</td>
                      <td>{money(child.average_price)}</td>
                      <td>{child.status}</td>
                    </tr>
                  ))}
                </tbody>
              </HTMLTable>
            </section>
          ) : null}
          {order.side === "sell" ? <LotPicks orderId={order.id} symbol={order.symbol} /> : null}
        </div>
      ) : null}
    </Drawer>
  );
}

export function Orders() {
  const dark = useDark();
  const orders = api.useQuery(
    "get",
    "/orders",
    { params: { query: { limit: 500 } } },
    { refetchInterval: 15_000 },
  );
  const algos = api.useQuery("get", "/orders/algo");
  const client = useQueryClient();
  const cancel = api.useMutation("delete", "/orders/{order_id}", {
    onSuccess: () => client.invalidateQueries(),
  });
  const [open, setOpen] = useState<Order | null>(null);
  const [changing, setChanging] = useState<Order | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  useCommand("cancel-selected", () => {
    if (selected && WORKING.includes(selected.status))
      cancel.mutate({ params: { path: { order_id: selected.id } } });
  });
  const grid = useRef<GridApi<Order> | null>(null);
  const all = orders.data ?? [];
  const working = all.filter((order) => WORKING.includes(order.status));
  const parentOf = useMemo(() => {
    const found = new Map<string, Algo>();
    for (const algo of algos.data ?? [])
      for (const child of algo.children) found.set(child.order, algo);
    return found;
  }, [algos.data]);
  const actions: ColDef<Order> = {
    headerName: "",
    minWidth: 150,
    sortable: false,
    cellRenderer: (params: { data?: Order }) =>
      params.data ? (
        <span style={{ display: "flex", gap: 4 }}>
          <Button
            small
            minimal
            icon="edit"
            aria-label="Change order"
            onClick={(event) => {
              event.stopPropagation();
              setChanging(params.data ?? null);
            }}
          />
          <Button
            small
            minimal
            intent="danger"
            icon="cross"
            aria-label="Cancel order"
            onClick={(event) => {
              event.stopPropagation();
              if (params.data) cancel.mutate({ params: { path: { order_id: params.data.id } } });
            }}
          />
        </span>
      ) : null,
  };
  const theme = dark ? darkGrid : lightGrid;
  return (
    <div className="stack">
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <h1 className="panel-title" style={{ margin: 0, flex: 1 }}>
          <Explained text={page("Orders")}>Orders</Explained>
        </h1>
        <CancelAll count={working.length} />
      </div>
      {cancel.error ? <Callout intent="danger">{detail(cancel.error)}</Callout> : null}
      <Tabs id="orders" renderActiveTabPanelOnly>
        <Tab
          id="open"
          title={`Open (${working.length})`}
          panel={
            <div className="panel">
              <AgGridReact<Order>
                theme={theme}
                rowData={working}
                columnDefs={aligned([...COLUMNS, actions])}
                domLayout="autoHeight"
                getRowId={(params) => params.data.id}
                onRowClicked={(event) => {
                  setSelected(event.data ?? null);
                  setOpen(event.data ?? null);
                  if (event.data) focusSymbol(event.data.symbol);
                }}
                overlayNoRowsTemplate="No open orders"
                autoSizeStrategy={{ type: "fitGridWidth" }}
              />
            </div>
          }
        />
        <Tab
          id="history"
          title="History"
          panel={
            <div className="panel stack">
              <div>
                <Button
                  small
                  icon="download"
                  onClick={() => grid.current?.exportDataAsCsv({ fileName: "orders.csv" })}
                >
                  Export CSV
                </Button>
              </div>
              <AgGridReact<Order>
                theme={theme}
                rowData={all}
                columnDefs={aligned(COLUMNS).map((column) => ({
                  ...column,
                  filter: true,
                  floatingFilter: true,
                }))}
                domLayout="normal"
                getRowId={(params) => params.data.id}
                onGridReady={(event) => {
                  grid.current = event.api;
                }}
                onRowClicked={(event) => {
                  setSelected(event.data ?? null);
                  setOpen(event.data ?? null);
                  if (event.data) focusSymbol(event.data.symbol);
                }}
                overlayNoRowsTemplate="No orders yet"
                autoSizeStrategy={{ type: "fitGridWidth" }}
                containerStyle={{ height: 520 }}
              />
            </div>
          }
        />
      </Tabs>
      <OrderDrawer
        order={open}
        parent={open ? parentOf.get(open.id) : undefined}
        onClose={() => setOpen(null)}
      />
      <ChangeOrder order={changing} onClose={() => setChanging(null)} />
    </div>
  );
}
