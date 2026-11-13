import { type HotkeyConfig, MenuItem, useHotkeys } from "@blueprintjs/core";
import { type ItemRenderer, Omnibar } from "@blueprintjs/select";
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { emit, useCommand, useFocusedSymbol } from "./commands";
import { VIEWS } from "./Sidebar";
import { useTicket } from "./ticket";

interface Action {
  key: string;
  label: string;
  hint?: string;
  run: () => void;
}

const SYMBOL = /^[A-Za-z]{1,6}(\/[A-Za-z]{3,4})?$/;
const GO_KEYS: Record<string, string> = {
  c: "/",
  d: "/dashboard",
  t: "/book",
  m: "/markets",
  p: "/positions",
  o: "/orders",
  r: "/risk",
  s: "/settings",
};
const ARMED_MS = 1500;
const DOUBLE_MS = 800;

function overlayOpen(): boolean {
  return Boolean(document.querySelector(".bp6-overlay-open"));
}

const INPUT = { placeholder: "A symbol, a view or an action" };
const NO_RESULTS = <MenuItem disabled text="Nothing matches" />;
const matches = (text: string, action: Action) =>
  action.label.toLowerCase().includes(text.toLowerCase());

const renderAction: ItemRenderer<Action> = (action, { handleClick, modifiers }) =>
  modifiers.matchesPredicate ? (
    <MenuItem
      key={action.key}
      text={action.label}
      label={action.hint}
      active={modifiers.active}
      onClick={handleClick}
    />
  ) : null;

export function Hotkeys() {
  const navigate = useNavigate();
  const ticket = useTicket();
  const symbol = useFocusedSymbol();
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState("");
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const escaped = useRef(0);
  useCommand("palette", () => setPalette(true));
  const arm = useCallback(() => {
    setArmed(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setArmed(false), ARMED_MS);
  }, []);
  const go = useCallback(
    (path: string) => {
      setArmed(false);
      navigate(path);
    },
    [navigate],
  );
  const hotkeys = useMemo<HotkeyConfig[]>(
    () => [
      {
        combo: "mod+k",
        global: true,
        label: "Command palette",
        preventDefault: true,
        onKeyDown: () => setPalette(true),
      },
      {
        combo: "/",
        global: true,
        label: "Search a symbol",
        preventDefault: true,
        onKeyDown: () => setPalette(true),
      },
      {
        combo: "b",
        global: true,
        label: "Buy the focused symbol",
        onKeyDown: () => ticket({ symbol, side: "buy" }),
      },
      {
        combo: "s",
        global: true,
        label: "Sell the focused symbol",
        disabled: armed,
        onKeyDown: () => ticket({ symbol, side: "sell" }),
      },
      {
        combo: "del",
        global: true,
        label: "Cancel the selected order (Orders)",
        onKeyDown: () => emit("cancel-selected"),
      },
      {
        combo: "shift+del",
        global: true,
        label: "Cancel every order, after confirming",
        onKeyDown: () => emit("cancel-all"),
      },
      {
        combo: "f",
        global: true,
        label: "Close the selected position (Positions), after confirming",
        onKeyDown: () => emit("flatten-selected"),
      },
      {
        combo: "esc",
        global: true,
        label: "Twice: kill switch, after confirming",
        onKeyDown: () => {
          if (overlayOpen()) {
            escaped.current = 0;
            return;
          }
          const now = Date.now();
          if (now - escaped.current < DOUBLE_MS) {
            escaped.current = 0;
            emit("halt");
          } else escaped.current = now;
        },
      },
      { combo: "g", global: true, label: "Go to: then c, d, t, m, p, o, r or s", onKeyDown: arm },
      ...Object.entries(GO_KEYS).map(([key, path]) => ({
        combo: key,
        global: true,
        group: "After g",
        label: `Go to ${VIEWS.find((view) => view.path === path)?.label ?? path}`,
        disabled: !armed,
        onKeyDown: () => go(path),
      })),
    ],
    [armed, symbol, ticket, arm, go],
  );
  useHotkeys(hotkeys);
  const typed = query.trim().toUpperCase();
  const actions = useMemo<Action[]>(
    () => [
      ...(SYMBOL.test(typed)
        ? [
            {
              key: `chart-${typed}`,
              label: `Chart ${typed}`,
              hint: "Markets",
              run: () => navigate("/markets", { state: { symbol: typed } }),
            },
            {
              key: `buy-${typed}`,
              label: `Buy ${typed}`,
              hint: "ticket",
              run: () => ticket({ symbol: typed, side: "buy" }),
            },
            {
              key: `sell-${typed}`,
              label: `Sell ${typed}`,
              hint: "ticket",
              run: () => ticket({ symbol: typed, side: "sell" }),
            },
          ]
        : []),
      ...VIEWS.map((view) => ({
        key: `view-${view.path}`,
        label: view.label,
        hint: "view",
        run: () => navigate(view.path),
      })),
      { key: "order", label: "New order", hint: "B / S", run: () => ticket({ symbol }) },
      {
        key: "cancel-all",
        label: "Cancel every order",
        hint: "Shift+Del",
        run: () => emit("cancel-all"),
      },
      { key: "halt", label: "Kill switch", hint: "Esc Esc", run: () => emit("halt") },
      {
        key: "cancel-one",
        label: "Cancel the selected order",
        hint: "Del",
        run: () => emit("cancel-selected"),
      },
      {
        key: "flatten",
        label: "Flatten the selected positions",
        hint: "F",
        run: () => emit("flatten-selected"),
      },
      { key: "buy", label: `Buy ${symbol}`, hint: "B", run: () => ticket({ symbol, side: "buy" }) },
      {
        key: "sell",
        label: `Sell ${symbol}`,
        hint: "S",
        run: () => ticket({ symbol, side: "sell" }),
      },
    ],
    [typed, symbol, navigate, ticket],
  );
  return (
    <Omnibar<Action>
      isOpen={palette}
      items={actions}
      onQueryChange={setQuery}
      itemRenderer={renderAction}
      itemPredicate={matches}
      onItemSelect={(action) => {
        setPalette(false);
        setQuery("");
        action.run();
      }}
      onClose={() => setPalette(false)}
      inputProps={INPUT}
      resetOnSelect
      noResults={NO_RESULTS}
    />
  );
}
