import type {
  KLineData,
  NeighborData,
  Styles,
  TooltipLegend,
  TooltipLegendChild,
} from "klinecharts";
import type { Colours } from "./layout";

const FONT = "IBM Plex Mono, monospace";

const SURFACES = {
  dark: {
    muted: "#8f8e88",
    rule: "#2a2a28",
    panel: "#141413",
    ink: "#e8e8e4",
    label: "#2a2a28",
    gain: "#3fbf5f",
    loss: "#f0605d",
  },
  light: {
    muted: "#6b6b66",
    rule: "#e2e2df",
    panel: "#ffffff",
    ink: "#1c1c1a",
    label: "#1c1c1a",
    gain: "#0ca30c",
    loss: "#d03b3b",
  },
};

const BLUE_ORANGE = {
  dark: { gain: "#4c9aff", loss: "#f08a24" },
  light: { gain: "#1d6fd6", loss: "#c25e00" },
};

export const ACCENT = "#ff9f1a";

export function palette(dark: boolean, colours: Colours) {
  const surface = SURFACES[dark ? "dark" : "light"];
  const pair = colours === "blue" ? BLUE_ORANGE[dark ? "dark" : "light"] : surface;
  return { ...surface, gain: pair.gain, loss: pair.loss };
}

function fixed(value: number, digits: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function signed(value: number, digits: number): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${fixed(Math.abs(value), digits)}`;
}

function compact(value: number): string {
  return value.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });
}

export function legend(digits: number, gain: string, loss: string, muted: string) {
  return (data: NeighborData<KLineData | null>): TooltipLegend[] => {
    const bar = data.current;
    if (!bar) return [];
    const first = data.prev === bar;
    const base = first ? bar.open : (data.prev?.close ?? bar.open);
    const change = bar.close - base;
    const colour = change > 0 ? gain : change < 0 ? loss : muted;
    const title = (text: string): TooltipLegendChild => ({ text, color: muted });
    const value = (text: string): TooltipLegendChild => ({ text, color: colour });
    const rows: TooltipLegend[] = [
      { title: title("O "), value: value(fixed(bar.open, digits)) },
      { title: title("H "), value: value(fixed(bar.high, digits)) },
      { title: title("L "), value: value(fixed(bar.low, digits)) },
      { title: title("C "), value: value(fixed(bar.close, digits)) },
      {
        title: title(""),
        value: value(
          `${signed(change, digits)} (${base ? signed((change / base) * 100, 2) : "0.00"}%)`,
        ),
      },
    ];
    if (bar.volume != null)
      rows.push({ title: title("Vol "), value: { text: compact(bar.volume), color: muted } });
    return rows;
  };
}

const ICONS = {
  visible: "M1 6 C3 2 9 2 11 6 C9 10 3 10 1 6 Z M5 6 L6 5 L7 6 L6 7 Z",
  settings: "M1 3 L11 3 M4 1 L4 5 M1 9 L11 9 M8 7 L8 11",
  remove: "M2 2 L10 10 M10 2 L2 10",
};

export const FEATURES = [
  { id: "visible", label: "Hide or show", path: ICONS.visible },
  { id: "settings", label: "Settings", path: ICONS.settings },
  { id: "remove", label: "Remove", path: ICONS.remove },
];

function feature(id: string, path: string, muted: string, ink: string) {
  return {
    id,
    position: "middle",
    marginLeft: 6,
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    paddingLeft: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    size: 12,
    color: muted,
    activeColor: ink,
    backgroundColor: "transparent",
    activeBackgroundColor: "transparent",
    type: "path",
    content: { style: "stroke", path, lineWidth: 1.4 },
  };
}

export function chartStyles(
  dark: boolean,
  type: string,
  colours: Colours,
  digits: number,
): Partial<Styles> {
  const { muted, rule, ink, label, gain, loss } = palette(dark, colours);
  const axis = {
    axisLine: { color: rule },
    tickLine: { color: rule },
    tickText: { color: muted, family: FONT, size: 11 },
  };
  const crosshairText = {
    color: "#ffffff",
    family: FONT,
    size: 11,
    borderColor: "transparent",
    backgroundColor: label,
  };
  const candle = {
    type,
    bar: {
      upColor: gain,
      downColor: loss,
      noChangeColor: muted,
      upBorderColor: gain,
      downBorderColor: loss,
      noChangeBorderColor: muted,
      upWickColor: gain,
      downWickColor: loss,
      noChangeWickColor: muted,
    },
    area: {
      lineColor: gain,
      backgroundColor: [
        { offset: 0, color: `${gain}40` },
        { offset: 1, color: `${gain}00` },
      ],
    },
    priceMark: {
      high: { color: muted, textFamily: FONT },
      low: { color: muted, textFamily: FONT },
      last: {
        upColor: gain,
        downColor: loss,
        noChangeColor: muted,
        text: { family: FONT, color: "#ffffff" },
      },
    },
    tooltip: {
      title: { color: ink, family: FONT, size: 12, weight: 500 },
      legend: { color: muted, family: FONT, size: 11, template: legend(digits, gain, loss, muted) },
    },
  };
  return {
    grid: { horizontal: { color: rule }, vertical: { show: false } },
    candle,
    indicator: {
      tooltip: {
        title: { color: ink, family: FONT, size: 11 },
        legend: { color: muted, family: FONT, size: 11 },
        features: FEATURES.map((item) => feature(item.id, item.path, muted, ink)),
      },
    },
    xAxis: axis,
    yAxis: axis,
    separator: { color: rule, activeBackgroundColor: `${ACCENT}33` },
    crosshair: {
      horizontal: { line: { color: muted }, text: crosshairText },
      vertical: { line: { color: muted }, text: crosshairText },
    },
    overlay: {
      point: { color: ACCENT, borderColor: ACCENT, activeColor: ACCENT, activeBorderColor: ACCENT },
      line: { color: ACCENT },
      text: { color: ink, family: FONT, backgroundColor: SURFACES[dark ? "dark" : "light"].panel },
    },
  } as unknown as Partial<Styles>;
}
