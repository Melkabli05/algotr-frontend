import {
  AreaSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  LineSeries,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

export interface Point {
  time: string;
  value: number;
}

export interface Mark {
  time: string;
  side: "buy" | "sell";
  text: string;
}

interface Props {
  equity: Point[];
  benchmark?: Point[];
  marks?: Mark[];
  dark: boolean;
  height?: number;
}

const seconds = (value: string): UTCTimestamp =>
  Math.floor(new Date(value).getTime() / 1000) as UTCTimestamp;

function unique(points: { time: UTCTimestamp; value: number }[]) {
  const seen = new Map<number, number>();
  for (const point of points) seen.set(point.time, point.value);
  return [...seen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time: time as UTCTimestamp, value }));
}

export function rebased(benchmark: Point[], start: number): Point[] {
  const first = benchmark[0]?.value;
  return first
    ? benchmark.map((point) => ({ time: point.time, value: (point.value / first) * start }))
    : [];
}

export function drawdown(equity: Point[]): Point[] {
  let peak = -Infinity;
  return equity.map((point) => {
    peak = Math.max(peak, point.value);
    return { time: point.time, value: peak > 0 ? point.value / peak - 1 : 0 };
  });
}

export function EquityChart({ equity, benchmark = [], marks = [], dark, height = 280 }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  useEffect(() => {
    if (!box.current) return;
    const text = dark ? "#8f8e88" : "#6b6b66";
    const rule = dark ? "#2a2a28" : "#e2e2df";
    const made = createChart(box.current, {
      height,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: text,
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: rule } },
      rightPriceScale: { borderColor: rule },
      timeScale: { borderColor: rule, timeVisible: true },
    });
    chart.current = made;
    const line = made.addSeries(LineSeries, {
      color: dark ? "#ff9f1a" : "#b86e00",
      lineWidth: 2,
      priceLineVisible: false,
      title: "Account",
    });
    line.setData(
      unique(equity.map((point) => ({ time: seconds(point.time), value: point.value }))),
    );
    if (benchmark.length && equity.length) {
      const spy = made.addSeries(LineSeries, {
        color: "#898781",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "SPY",
      });
      spy.setData(
        unique(
          rebased(benchmark, equity[0]?.value ?? 0).map((point) => ({
            time: seconds(point.time),
            value: point.value,
          })),
        ),
      );
    }
    const shade = made.addSeries(
      AreaSeries,
      {
        lineColor: dark ? "#f0605d" : "#d03b3b",
        topColor: "rgba(208, 59, 59, 0.05)",
        bottomColor: "rgba(208, 59, 59, 0.35)",
        lineWidth: 1,
        priceLineVisible: false,
        priceFormat: { type: "percent" },
        title: "Drawdown",
      },
      1,
    );
    shade.setData(
      unique(
        drawdown(equity).map((point) => ({ time: seconds(point.time), value: point.value * 100 })),
      ),
    );
    made.panes()[1]?.setHeight(70);
    const markers: SeriesMarker<Time>[] = marks
      .map((mark) => ({
        time: seconds(mark.time),
        position: mark.side === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
        shape: mark.side === "buy" ? ("arrowUp" as const) : ("arrowDown" as const),
        color: mark.side === "buy" ? "#3fbf5f" : "#f0605d",
        text: mark.text,
      }))
      .sort((a, b) => a.time - b.time);
    createSeriesMarkers(line, markers);
    made.timeScale().fitContent();
    return () => {
      made.remove();
      chart.current = null;
    };
  }, [equity, benchmark, marks, dark, height]);
  return (
    <div ref={box} style={{ height, width: "100%" }} aria-label="Account value chart" role="img" />
  );
}
