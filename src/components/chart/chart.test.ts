import { getSupportedIndicators, getSupportedOverlays } from "klinecharts";
import { afterEach, describe, expect, it } from "vitest";
import { barStart } from "../liveBars";
import { INDICATORS, MAIN_NAMES, TOOLS } from "./catalog";
import { DEFAULT_LAYOUT, loadDrawings, loadLayout, saveDrawings, saveLayout } from "./layout";
import { fillMarkers, traceMarkers } from "./sources";
import { legend, palette } from "./theme";

afterEach(() => localStorage.clear());

describe("catalog", () => {
  it("only names indicators and tools the installed chart library supports", () => {
    const indicators = getSupportedIndicators();
    const overlays = getSupportedOverlays();
    expect(INDICATORS.filter((item) => !indicators.includes(item.name))).toEqual([]);
    expect(TOOLS.filter((item) => !overlays.includes(item.name))).toEqual([]);
  });

  it("lists each indicator once, and the ones that draw on the candles are the library's", () => {
    const names = INDICATORS.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
    expect([...MAIN_NAMES].sort()).toEqual(["BBI", "BOLL", "EMA", "MA", "SAR", "SMA"]);
  });

  it("gives every tool and indicator a label and a one-line explanation", () => {
    for (const item of [...INDICATORS, ...TOOLS]) {
      expect(item.label.length).toBeGreaterThan(2);
      expect(item.about.length).toBeGreaterThan(10);
    }
  });
});

describe("saved layout", () => {
  it("round-trips and falls back to the default when storage is empty or broken", () => {
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
    saveLayout({ ...DEFAULT_LAYOUT, scale: "logarithm", indicators: ["RSI"] });
    expect(loadLayout()).toMatchObject({ scale: "logarithm", indicators: ["RSI"] });
    localStorage.setItem("algotr-chart", "{not json");
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
  });

  it("keeps drawings per symbol and drops anything malformed", () => {
    const line = { name: "segment", points: [{ timestamp: 1, value: 2 }] };
    saveDrawings("SPUS", [line]);
    saveDrawings("SOL/USD", []);
    expect(loadDrawings("SPUS")).toEqual([line]);
    expect(loadDrawings("SOL/USD")).toEqual([]);
    localStorage.setItem(
      "algotr-chart-drawings:AAPL",
      JSON.stringify([line, { name: 3 }, { name: "ray", points: [{ timestamp: "x", value: 1 }] }]),
    );
    expect(loadDrawings("AAPL")).toEqual([line]);
  });
});

describe("candle legend", () => {
  const bar = { timestamp: 2, open: 10, high: 12, low: 9, close: 11, volume: 4350 };
  const rows = (data: Parameters<ReturnType<typeof legend>>[0]) =>
    legend(
      2,
      "#0f0",
      "#f00",
      "#888",
    )(data).map((row) => ({
      title: typeof row.title === "string" ? row.title : row.title.text,
      value: typeof row.value === "string" ? row.value : row.value.text,
      color: typeof row.value === "string" ? "" : row.value.color,
    }));

  it("reads open, high, low, close, the change from the previous close and the volume", () => {
    const found = rows({ prev: { ...bar, timestamp: 1, close: 10.5 }, current: bar, next: bar });
    expect(found.map((row) => row.value)).toEqual([
      "10.00",
      "12.00",
      "9.00",
      "11.00",
      "+0.50 (+4.76%)",
      "4.35K",
    ]);
    expect(found[3]?.color).toBe("#0f0");
  });

  it("measures the first bar against its own open and colours a fall", () => {
    const first = rows({ prev: bar, current: bar, next: bar });
    expect(first[4]?.value).toBe("+1.00 (+10.00%)");
    const down = { ...bar, close: 8 };
    const fell = rows({ prev: down, current: down, next: down });
    expect(fell[4]).toMatchObject({ value: "−2.00 (−20.00%)", color: "#f00" });
  });

  it("shows nothing for an empty slot", () => {
    expect(legend(2, "g", "l", "m")({ prev: null, current: null, next: null })).toEqual([]);
  });
});

describe("palette", () => {
  it("swaps red and green for blue and orange without touching the surface", () => {
    const classic = palette(true, "classic");
    const blue = palette(true, "blue");
    expect(blue.gain).not.toBe(classic.gain);
    expect(blue.loss).not.toBe(classic.loss);
    expect(blue.panel).toBe(classic.panel);
  });
});

describe("markers", () => {
  it("puts a fill on the start of the bar it happened in, not the nearest bar", () => {
    const fill = {
      id: "f1",
      time: "2026-10-28T19:16:00Z",
      symbol: "SPUS",
      side: "sell" as const,
      qty: 2,
      price: 59.97,
      value: 119.94,
      partial: false,
      order: "abcdef123456",
      fee_qty: null,
    };
    const [marker] = fillMarkers([fill], [], [], (ms) => barStart(ms, "1Day", false));
    expect(new Date(marker?.time ?? 0).toISOString()).toBe("2026-10-28T04:00:00.000Z");
    const [hourly] = fillMarkers([{ ...fill, time: "2026-10-28T14:35:00Z" }], [], [], (ms) =>
      barStart(ms, "1Hour", false),
    );
    expect(new Date(hourly?.time ?? 0).toISOString()).toBe("2026-10-28T14:00:00.000Z");
  });

  it("describes a fill with the cost report and the lots it closed", () => {
    const fill = {
      id: "f2",
      time: "2026-10-28T19:16:00Z",
      symbol: "SPUS",
      side: "buy" as const,
      qty: 1,
      price: 60,
      value: 60,
      partial: false,
      order: "o1",
      fee_qty: null,
    };
    const closed = [
      { order: "o1", gain: 1.5 },
      { order: "o1", gain: 0.5 },
      { order: "o2", gain: 9 },
    ];
    const cost = {
      order: "o1",
      decision: 59.9,
      arrival: 59.95,
      shortfall_bps: 12.34,
      seconds_to_fill: 4,
    };
    const [marker] = fillMarkers([fill], closed as never, [cost as never], (ms) => ms);
    expect(marker?.title).toBe("Bought 1 SPUS");
    expect(marker?.lines).toContain("Shortfall 12.3 bps");
    expect(marker?.lines.some((line) => line.startsWith("Closed lots +$2.00"))).toBe(true);
  });

  it("marks each trade of a rule at its fills, an open one only at its entry", () => {
    const trace = {
      fills: "close",
      trades: [
        {
          entry: "2024-01-02",
          entry_price: 10,
          exit: "2024-02-01",
          exit_price: 12,
          days: 30,
          gain: 0.2,
          weight: 1,
          open: false,
          why_entry: "Closed at 10.00, above its 200-day average of 9.00",
          why_exit: "Closed at 12.00, at or below its 200-day average of 12.50",
        },
        {
          entry: "2024-03-01",
          entry_price: 11,
          exit: null,
          exit_price: null,
          days: 5,
          gain: 0.05,
          weight: 0.5,
          open: true,
          why_entry: "Closed at 11.00, above its 200-day average of 10.00",
          why_exit: null,
        },
      ],
    };
    const marks = traceMarkers(trace as never);
    expect(marks.map((mark) => `${mark.side}:${mark.price}`)).toEqual([
      "buy:10",
      "sell:12",
      "buy:11",
    ]);
    expect(marks[0]?.time).toBe(Date.parse("2024-01-02T00:00:00Z"));
    expect(marks[2]?.lines.some((line) => line.startsWith("Open"))).toBe(true);
    expect(marks[0]?.lines).toContain("Closed at 10.00, above its 200-day average of 9.00");
    expect(marks[1]?.lines.some((line) => line.includes("at or below"))).toBe(true);
  });

  it("merges the fills of one bar and side into one marker at their average price", () => {
    const base = {
      symbol: "BTC/USD",
      side: "buy" as const,
      partial: false,
      fee_qty: null,
    };
    const fills = [
      {
        ...base,
        id: "a",
        time: "2026-11-02T00:05:00Z",
        qty: 1,
        price: 100,
        value: 100,
        order: "o1",
      },
      {
        ...base,
        id: "b",
        time: "2026-11-02T00:35:00Z",
        qty: 3,
        price: 104,
        value: 312,
        order: "o2",
      },
      { ...base, id: "c", time: "2026-11-02T01:10:00Z", qty: 1, price: 90, value: 90, order: "o3" },
      {
        ...base,
        id: "d",
        time: "2026-11-02T00:40:00Z",
        qty: 2,
        price: 105,
        value: 210,
        order: "o4",
        side: "sell" as const,
      },
    ];
    const marks = fillMarkers(fills, [], [], (ms) => barStart(ms, "1Hour", true));
    expect(marks).toHaveLength(3);
    const hour = marks.find((mark) => mark.side === "buy" && mark.price === 103);
    expect(hour?.title).toBe("Bought 4 BTC/USD");
    expect(hour?.lines[0]).toBe("2 fills in 2 orders, average $103.00");
    expect(marks.filter((mark) => mark.side === "sell")).toHaveLength(1);
  });
});
