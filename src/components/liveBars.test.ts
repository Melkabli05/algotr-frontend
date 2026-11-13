import type { KLineData } from "klinecharts";
import { describe, expect, it } from "vitest";
import { applyTrade, barStart, mergeBar } from "./liveBars";

const at = (iso: string) => Date.parse(iso);

function bar(iso: string, close = 10, volume = 100): KLineData {
  return { timestamp: at(iso), open: 10, high: 11, low: 9, close, volume };
}

describe("barStart", () => {
  it("floors intraday to the period grid", () => {
    expect(barStart(at("2026-11-11T20:07:31Z"), "15Min", false)).toBe(at("2026-11-11T20:00:00Z"));
    expect(barStart(at("2026-11-11T20:59:59Z"), "1Hour", false)).toBe(at("2026-11-11T20:00:00Z"));
  });

  it("starts a stock day at New York midnight, in winter and summer", () => {
    expect(barStart(at("2026-11-11T20:00:00Z"), "1Day", false)).toBe(at("2026-11-11T05:00:00Z"));
    expect(barStart(at("2026-07-10T20:00:00Z"), "1Day", false)).toBe(at("2026-07-10T04:00:00Z"));
    expect(barStart(at("2026-11-11T03:00:00Z"), "1Day", false)).toBe(at("2026-11-10T05:00:00Z"));
  });

  it("starts a crypto day at UTC midnight", () => {
    expect(barStart(at("2026-11-11T20:00:00Z"), "1Day", true)).toBe(at("2026-11-11T00:00:00Z"));
  });
});

describe("applyTrade", () => {
  it("extends the open bar", () => {
    const result = applyTrade(
      bar("2026-11-11T20:00:00Z"),
      { price: 12, size: 5, ms: at("2026-11-11T20:00:40Z") },
      "1Min",
      false,
    );
    expect(result?.bar).toMatchObject({ close: 12, high: 12, low: 9, volume: 105 });
  });

  it("extends within the period", () => {
    const result = applyTrade(
      bar("2026-11-11T20:00:00Z"),
      { price: 8, size: 5, ms: at("2026-11-11T20:10:00Z") },
      "15Min",
      false,
    );
    expect(result).toMatchObject({ opened: false, bar: { close: 8, low: 8, volume: 105 } });
  });

  it("opens a new bar when the period rolls over", () => {
    const result = applyTrade(
      bar("2026-11-11T20:00:00Z"),
      { price: 13, size: 7, ms: at("2026-11-11T20:15:02Z") },
      "15Min",
      false,
    );
    expect(result?.opened).toBe(true);
    expect(result?.bar).toEqual({
      timestamp: at("2026-11-11T20:15:00Z"),
      open: 13,
      high: 13,
      low: 13,
      close: 13,
      volume: 7,
    });
  });

  it("starts from the first print when there are no bars", () => {
    const result = applyTrade(
      null,
      { price: 3, size: 1, ms: at("2026-11-11T20:00:10Z") },
      "1Min",
      true,
    );
    expect(result).toMatchObject({ opened: false, bar: { open: 3, volume: 1 } });
  });

  it("ignores a print older than the open bar", () => {
    const result = applyTrade(
      bar("2026-11-11T20:15:00Z"),
      { price: 1, size: 1, ms: at("2026-11-11T20:14:59Z") },
      "15Min",
      false,
    );
    expect(result).toBeNull();
  });
});

describe("mergeBar", () => {
  it("takes a newer bar", () => {
    const fetched = bar("2026-11-11T20:15:00Z");
    expect(mergeBar(bar("2026-11-11T20:00:00Z"), fetched)).toBe(fetched);
  });

  it("keeps the live bar when the fetched one has less volume", () => {
    expect(
      mergeBar(bar("2026-11-11T20:00:00Z", 10, 100), bar("2026-11-11T20:00:00Z", 9, 80)),
    ).toBeNull();
  });

  it("takes the fetched bar when it has caught up", () => {
    const fetched = bar("2026-11-11T20:00:00Z", 9, 120);
    expect(mergeBar(bar("2026-11-11T20:00:00Z", 10, 100), fetched)).toBe(fetched);
  });

  it("drops an older bar", () => {
    expect(mergeBar(bar("2026-11-11T20:15:00Z"), bar("2026-11-11T20:00:00Z"))).toBeNull();
  });
});
