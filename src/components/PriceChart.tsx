import { type HotkeyConfig, NonIdealState, Spinner, useHotkeys } from "@blueprintjs/core";
import {
  type Chart,
  type DataLoaderSubscribeBarParams,
  dispose,
  type Indicator,
  init,
  type KLineData,
  type OverlayCreate,
  type Period,
} from "klinecharts";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { stream } from "../stream/store";
import { CANDLE_PANE, MAIN_NAMES } from "./chart/catalog";
import { DrawingBar } from "./chart/DrawingBar";
import { IndicatorSearch } from "./chart/IndicatorSearch";
import { IndicatorSettings } from "./chart/IndicatorSettings";
import {
  type Drawing,
  type Layout,
  loadDrawings,
  loadLayout,
  saveDrawings,
  saveLayout,
} from "./chart/layout";
import { MarkerCard } from "./chart/MarkerCard";
import { type Hover, type Marker, placeMarkers, registerMarkers } from "./chart/markers";
import { RULE_LINES, RULE_NAMES, RULE_PANE, registerRule, WEIGHT } from "./chart/rule";
import { type SourceControl, TopBar } from "./chart/TopBar";
import { chartStyles, palette } from "./chart/theme";
import { applyTrade, mergeBar } from "./liveBars";

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  extra?: Record<string, number | null>;
}

const DRAWINGS = "drawing";
const MIN_BAR_SPACE = 0.3;
const PRICE_AXIS = 90;
const DEFAULT_BAR_SPACE = 8;

function fitView(chart: Chart, count: number): void {
  const room = (chart.getSize()?.width ?? 0) - PRICE_AXIS;
  const space = count > 0 && room > 0 ? Math.max(room / count, MIN_BAR_SPACE) : DEFAULT_BAR_SPACE;
  chart.setBarSpace(Math.min(space, DEFAULT_BAR_SPACE));
  chart.scrollToRealTime();
}
const DAY: Period = { type: "day", span: 1 };

const PERIODS: Record<string, Period> = {
  "1Min": { type: "minute", span: 1 },
  "5Min": { type: "minute", span: 5 },
  "15Min": { type: "minute", span: 15 },
  "1Hour": { type: "hour", span: 1 },
  "1Day": DAY,
};

function precision(price: number | undefined) {
  if (price == null || price >= 10) return 2;
  return price >= 1 ? 3 : 5;
}

function toKLine(bar: Candle): KLineData {
  const found: KLineData = {
    timestamp: new Date(bar.time).getTime(),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  };
  for (const [name, value] of Object.entries(bar.extra ?? {})) {
    if (value != null) found[name] = value;
  }
  return found;
}

export interface Rule {
  lines: string[];
  values: string[];
}

export interface Focus {
  time: number;
  until: number | null;
  n: number;
}

export function PriceChart({
  bars,
  symbol,
  timeframe,
  onTimeframe,
  dark,
  recent,
  streaming,
  loading,
  failed,
  dataKey,
  markers,
  rule,
  source,
  focus,
}: {
  bars: Candle[];
  symbol: string;
  timeframe: string;
  onTimeframe: (frame: string) => void;
  dark: boolean;
  recent?: Candle[];
  streaming: boolean;
  loading: boolean;
  failed: boolean;
  dataKey: string;
  markers: Marker[];
  rule: Rule | null;
  source?: SourceControl;
  focus: Focus | null;
}) {
  const frozen = rule != null;
  const wrap = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<Chart | null>(null);
  const [layout, setLayout] = useState<Layout>(loadLayout);
  const [digits, setDigits] = useState(2);
  const [tool, setTool] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [count, setCount] = useState(0);
  const [searching, setSearching] = useState(false);
  const [settingsFor, setSettingsFor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const loaded = useRef<{ symbol: string; timeframe: string; key: string; data: KLineData[] }>({
    symbol: "",
    timeframe: "",
    key: "",
    data: [],
  });
  const feed = useRef<((bar: KLineData) => void) | null>(null);
  const last = useRef<KLineData | null>(null);
  const frame = useRef<number | null>(null);
  const drawing = useRef<string | null>(null);
  const selected = useRef<string | null>(null);
  const restoring = useRef(false);
  const current = useRef({ symbol, hidden });
  current.current = { symbol, hidden };

  useEffect(() => saveLayout(layout), [layout]);

  const persist = useCallback(
    (skip?: string) => {
      if (restoring.current || !chart) return;
      const found: Drawing[] = chart
        .getOverlays({ groupId: DRAWINGS })
        .filter((item) => item.id !== skip && item.id !== drawing.current)
        .map((item) => ({
          name: item.name,
          lock: item.lock,
          points: item.points.flatMap((point) =>
            point.timestamp != null && point.value != null
              ? [{ timestamp: point.timestamp, value: point.value }]
              : [],
          ),
        }));
      saveDrawings(current.current.symbol, found);
      setCount(found.length);
    },
    [chart],
  );

  const watchers = useMemo<Partial<OverlayCreate>>(
    () => ({
      onDrawEnd: () => {
        drawing.current = null;
        setTool(null);
        persist();
      },
      onPressedMoveEnd: () => persist(),
      onRemoved: ({ overlay }) => persist(overlay.id),
      onSelected: ({ overlay }) => {
        selected.current = overlay.id;
      },
      onDeselected: () => {
        selected.current = null;
      },
    }),
    [persist],
  );

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    registerMarkers();
    registerRule();
    const created = init(element, {
      locale: "en-US",
      layout: { barSpaceLimit: { min: MIN_BAR_SPACE, max: 50 } },
    });
    if (!created) return;
    created.setDataLoader({
      getBars: ({ type, symbol: wanted, period, callback }) => {
        const now = loaded.current;
        const same =
          wanted.ticker === now.symbol &&
          PERIODS[now.timeframe]?.type === period.type &&
          PERIODS[now.timeframe]?.span === period.span;
        callback(type === "init" && same ? [...now.data] : [], false);
      },
      subscribeBar: ({ callback }: DataLoaderSubscribeBarParams) => {
        feed.current = callback;
      },
      unsubscribeBar: () => {
        feed.current = null;
      },
    });
    created.subscribeAction("onIndicatorTooltipFeatureClick", (data) => {
      const { feature, indicator } = data as { feature: { id: string }; indicator?: Indicator };
      if (!indicator) return;
      if (feature.id === "visible") {
        created.overrideIndicator({
          name: indicator.name,
          paneId: indicator.paneId,
          visible: !indicator.visible,
        });
      } else if (feature.id === "settings") {
        setSettingsFor(indicator.name);
      } else if (feature.id === "remove") {
        setLayout((now) => ({
          ...now,
          indicators: now.indicators.filter((name) => name !== indicator.name),
        }));
      }
    });
    setChart(created);
    const observer = new ResizeObserver(() => created.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      feed.current = null;
      setChart(null);
      dispose(element);
    };
  }, []);

  useEffect(() => {
    chart?.setStyles(chartStyles(dark, layout.type, layout.colours, digits));
  }, [chart, dark, layout.type, layout.colours, digits]);

  useEffect(() => {
    chart?.overrideYAxis({ paneId: CANDLE_PANE, name: layout.scale });
  }, [chart, layout.scale]);

  const restore = useCallback(() => {
    if (!chart) return;
    restoring.current = true;
    chart.removeOverlay({ groupId: DRAWINGS });
    drawing.current = null;
    let made = 0;
    for (const item of loadDrawings(current.current.symbol)) {
      const id = chart.createOverlay({
        name: item.name,
        groupId: DRAWINGS,
        points: item.points,
        lock: item.lock,
        visible: !current.current.hidden,
        ...watchers,
      });
      if (id) made += 1;
    }
    restoring.current = false;
    setTool(null);
    setCount(made);
  }, [chart, watchers]);

  useEffect(() => {
    if (!chart) return;
    const data = bars.map(toKLine).sort((a, b) => a.timestamp - b.timestamp);
    const now = loaded.current;
    const same = now.symbol === symbol && now.timeframe === timeframe && now.key === dataKey;
    if (same && now.data.length > 0) {
      const tail = data.at(-1);
      const merged = tail ? mergeBar(last.current, tail) : null;
      if (merged) {
        last.current = merged;
        feed.current?.(merged);
      }
      return;
    }
    const switched = now.key !== dataKey;
    loaded.current = { symbol, timeframe, key: dataKey, data };
    last.current = data.at(-1) ?? null;
    setDigits(precision(data.at(-1)?.close));
    chart.setTimezone(frozen || symbol.includes("/") ? "UTC" : "America/New_York");
    chart.setSymbol({
      ticker: symbol,
      pricePrecision: precision(data.at(-1)?.close),
      volumePrecision: 0,
    });
    chart.setPeriod(PERIODS[timeframe] ?? DAY);
    chart.resetData();
    restore();
    if (switched) fitView(chart, frozen ? data.length : 0);
  }, [chart, bars, symbol, timeframe, dataKey, frozen, restore]);

  useEffect(() => {
    if (!chart) return;
    const wanted = new Set(layout.indicators);
    for (const existing of chart.getIndicators()) {
      if (!wanted.has(existing.name) && !RULE_NAMES.has(existing.name)) {
        chart.removeIndicator({ id: existing.id });
      }
    }
    const present = new Set(chart.getIndicators().map((item) => item.name));
    for (const name of layout.indicators) {
      if (present.has(name)) continue;
      const calcParams = layout.params[name];
      const base = calcParams ? { name, calcParams } : { name };
      if (MAIN_NAMES.has(name)) chart.createIndicator({ ...base, paneId: CANDLE_PANE }, true);
      else chart.createIndicator(base);
    }
    for (const existing of chart.getIndicators()) {
      const calcParams = layout.params[existing.name];
      if (calcParams && JSON.stringify(calcParams) !== JSON.stringify(existing.calcParams)) {
        chart.overrideIndicator({ name: existing.name, paneId: existing.paneId, calcParams });
      }
    }
  }, [chart, layout.indicators, layout.params]);

  useEffect(() => {
    if (!chart || frozen) return;
    for (const bar of [...(recent ?? [])].map(toKLine).sort((a, b) => a.timestamp - b.timestamp)) {
      const merged = mergeBar(last.current, bar);
      if (merged && feed.current) {
        last.current = merged;
        feed.current(merged);
      }
    }
  }, [chart, recent, frozen]);

  useEffect(() => {
    if (!chart || frozen) return;
    const crypto = symbol.includes("/");
    const push = () => {
      frame.current = null;
      if (last.current) feed.current?.(last.current);
    };
    const unwatch = stream.watch(symbol);
    const off = stream.onTrade(symbol, (trade) => {
      const result = applyTrade(
        last.current,
        { price: trade.price, size: trade.size, ms: Date.parse(trade.time) },
        timeframe,
        crypto,
      );
      if (!result) return;
      if (result.opened && last.current) feed.current?.(last.current);
      last.current = result.bar;
      if (frame.current == null) frame.current = requestAnimationFrame(push);
    });
    return () => {
      off();
      unwatch();
      if (frame.current != null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [chart, symbol, timeframe, frozen]);

  const colours = palette(dark, layout.colours);

  useEffect(() => {
    if (!chart) return;
    placeMarkers(
      chart,
      markers,
      { buy: colours.gain, sell: colours.loss, edge: colours.panel },
      setHover,
    );
    return () => {
      setHover(null);
    };
  }, [chart, markers, colours.gain, colours.loss, colours.panel]);

  useEffect(() => {
    if (!chart) return;
    for (const name of RULE_NAMES) chart.removeIndicator({ name });
    if (!rule) return;
    const shade = `${colours.gain}1f`;
    chart.createIndicator(
      {
        name: RULE_LINES,
        paneId: CANDLE_PANE,
        calcParams: rule.lines,
        extendData: { shade, bar: colours.gain },
        precision: digits,
      },
      true,
    );
    chart.createIndicator({
      name: RULE_PANE,
      calcParams: [WEIGHT, ...rule.values],
      extendData: { shade, bar: colours.gain },
      precision: 2,
    });
  }, [chart, rule, colours.gain, digits]);

  useEffect(() => {
    if (!chart || !focus) return;
    const list = chart.getDataList();
    const first = list.findIndex((bar) => bar.timestamp >= focus.time);
    if (first < 0) return;
    const until = focus.until;
    const found = until == null ? -1 : list.findIndex((bar) => bar.timestamp >= until);
    const last = found < 0 ? list.length - 1 : found;
    const count = last - first + 1;
    const pad = Math.max(Math.round(count * 0.25), 6);
    const room = (chart.getSize()?.width ?? 0) - PRICE_AXIS;
    if (room > 0)
      chart.setBarSpace(Math.min(Math.max(room / (count + 2 * pad), MIN_BAR_SPACE), 50));
    chart.scrollToDataIndex(Math.min(last + pad, list.length - 1), 300);
  }, [chart, focus]);

  const cancelTool = useCallback(() => {
    if (drawing.current) chart?.removeOverlay({ id: drawing.current });
    drawing.current = null;
    setTool(null);
  }, [chart]);

  const pick = useCallback(
    (name: string) => {
      if (!chart) return;
      const same = drawing.current != null && tool === name;
      cancelTool();
      if (same) return;
      if (current.current.hidden) {
        chart.overrideOverlay({ groupId: DRAWINGS, visible: true });
        setHidden(false);
      }
      const id = chart.createOverlay({
        name,
        groupId: DRAWINGS,
        mode: layout.magnet ? "weak_magnet" : "normal",
        ...watchers,
      });
      drawing.current = typeof id === "string" ? id : null;
      setTool(name);
    },
    [chart, tool, cancelTool, layout.magnet, watchers],
  );

  const toggleHidden = () => {
    chart?.overrideOverlay({ groupId: DRAWINGS, visible: hidden });
    setHidden(!hidden);
  };

  const clear = () => {
    cancelTool();
    chart?.removeOverlay({ groupId: DRAWINGS });
    saveDrawings(symbol, []);
    setCount(0);
  };

  const reset = useCallback(() => {
    if (chart) fitView(chart, frozen ? loaded.current.data.length : 0);
  }, [chart, frozen]);

  const shoot = () => {
    if (!chart) return;
    const link = document.createElement("a");
    link.href = chart.getConvertPictureUrl(true, "png", palette(dark, layout.colours).panel);
    link.download = `${symbol.replace("/", "-")}-${timeframe}.png`;
    link.click();
  };

  const toggleExpanded = useCallback(() => setExpanded((now) => !now), []);

  const toggleIndicator = (name: string) =>
    setLayout((now) => ({
      ...now,
      indicators: now.indicators.includes(name)
        ? now.indicators.filter((item) => item !== name)
        : [...now.indicators, name],
    }));

  const hotkeys = useMemo<HotkeyConfig[]>(() => {
    const chartKey = (combo: string, label: string, run: () => void): HotkeyConfig => ({
      combo,
      label,
      group: "Chart",
      global: true,
      preventDefault: true,
      onKeyDown: run,
    });
    return [
      chartKey("alt+t", "Trend line", () => pick("straightLine")),
      chartKey("alt+h", "Horizontal line", () => pick("horizontalStraightLine")),
      chartKey("alt+v", "Vertical line", () => pick("verticalStraightLine")),
      chartKey("alt+f", "Fibonacci retracement", () => pick("fibonacciLine")),
      chartKey("alt+m", "Magnet", () => setLayout((now) => ({ ...now, magnet: !now.magnet }))),
      chartKey("alt+i", "Indicators", () => setSearching(true)),
      chartKey("alt+r", "Reset view", reset),
      chartKey("alt+l", "Logarithmic scale", () =>
        setLayout((now) => ({ ...now, scale: now.scale === "logarithm" ? "normal" : "logarithm" })),
      ),
      chartKey("alt+p", "Percent scale", () =>
        setLayout((now) => ({
          ...now,
          scale: now.scale === "percentage" ? "normal" : "percentage",
        })),
      ),
      chartKey("alt+enter", "Full window", toggleExpanded),
    ];
  }, [pick, reset, toggleExpanded]);
  useHotkeys(hotkeys);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && (drawing.current || expanded)) {
      event.stopPropagation();
      if (drawing.current) cancelTool();
      else setExpanded(false);
    } else if ((event.key === "Delete" || event.key === "Backspace") && selected.current) {
      event.stopPropagation();
      event.preventDefault();
      chart?.removeOverlay({ id: selected.current });
      selected.current = null;
    }
  };

  const panes = layout.indicators.filter((name) => !MAIN_NAMES.has(name)).length + (rule ? 1 : 0);
  const height = 400 + 110 * panes;
  const empty = !loading && !failed && bars.length === 0;
  const settings = useMemo(
    () =>
      settingsFor && chart
        ? ((chart.getIndicators({ name: settingsFor })[0]?.calcParams as number[] | undefined) ??
          [])
        : [],
    [chart, settingsFor],
  );

  return (
    <div className={expanded ? "price-chart expanded" : "price-chart"} ref={wrap}>
      <TopBar
        frame={timeframe}
        onFrame={onTimeframe}
        frozen={frozen}
        source={source}
        indicators={layout.indicators.length}
        onIndicators={() => setSearching(true)}
        type={layout.type}
        onType={(type) => setLayout((now) => ({ ...now, type }))}
        colours={layout.colours}
        onColours={(colours) => setLayout((now) => ({ ...now, colours }))}
        scale={layout.scale}
        onScale={(scale) => setLayout((now) => ({ ...now, scale }))}
        streaming={streaming}
        expanded={expanded}
        onReset={reset}
        onShot={shoot}
        onExpand={toggleExpanded}
      />
      <div className="chart-body">
        <DrawingBar
          tool={tool}
          magnet={layout.magnet}
          hidden={hidden}
          count={count}
          onTool={pick}
          onMagnet={() => setLayout((now) => ({ ...now, magnet: !now.magnet }))}
          onHidden={toggleHidden}
          onClear={clear}
        />
        <div
          className="chart-stage"
          role="application"
          aria-roledescription="chart"
          aria-label={`Price chart for ${symbol}`}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the chart region takes keyboard commands (Delete, Esc)
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          <div ref={box} className="chart-canvas" style={expanded ? undefined : { height }} />
          <MarkerCard hover={hover} />
          {loading || failed || empty ? (
            <div className="chart-state">
              {loading ? (
                <Spinner size={24} />
              ) : (
                <NonIdealState
                  icon="timeline-line-chart"
                  title={failed ? `Could not load ${symbol}` : `No bars for ${symbol}`}
                  description={
                    failed
                      ? "The data service did not answer. Try again in a moment."
                      : "Nothing traded in this window. Try a longer bar size."
                  }
                />
              )}
            </div>
          ) : null}
        </div>
      </div>
      <IndicatorSearch
        open={searching}
        active={layout.indicators}
        onToggle={toggleIndicator}
        onClose={() => setSearching(false)}
      />
      <IndicatorSettings
        name={settingsFor}
        current={settings}
        onApply={(name, params) => {
          setLayout((now) => ({ ...now, params: { ...now.params, [name]: params } }));
          setSettingsFor(null);
        }}
        onReset={(name) => {
          chart?.removeIndicator({ name });
          setLayout((now) => {
            const { [name]: _dropped, ...params } = now.params;
            return { ...now, params };
          });
          setSettingsFor(null);
        }}
        onClose={() => setSettingsFor(null)}
      />
    </div>
  );
}
