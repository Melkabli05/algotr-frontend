import { drawdown, rebased } from "../components/EquityChart";
import { money, percent, signedMoney, signedPercent, tone } from "../format";
import { session } from "../shell/Footer";
import { StreamStore } from "../stream/store";
import { dailyMarks, positionRows } from "../views/Dashboard";
import { stages } from "../views/Orders";
import { algoOf, requestOf } from "../views/OrderTicket";
import { closePhrase } from "../views/Positions";
import { changed, type Draft, described, rewordedOnly } from "../views/StrategyLibrary";

describe("format", () => {
  it("writes money, signs and percentages", () => {
    expect(money(1234.5)).toBe("$1,234.50");
    expect(signedMoney(-2)).toBe("−$2.00");
    expect(percent(0.1234)).toBe("12.3%");
    expect(signedPercent(0.0118)).toBe("+1.18%");
    expect(money(null)).toBe("—");
    expect(tone(-1)).toBe("loss");
  });
});

describe("market session", () => {
  const clock = (open: boolean, next: string) => ({
    is_open: open,
    next_open: next,
    next_close: next,
  });
  it("reads open, pre-market, after hours and closed in New York time", () => {
    expect(session(clock(true, "2026-11-06T14:30:00Z"), new Date("2026-11-06T15:00:00Z"))).toBe(
      "Market open",
    );
    expect(session(clock(false, "2026-11-06T14:30:00Z"), new Date("2026-11-06T11:00:00Z"))).toBe(
      "Pre-market",
    );
    expect(session(clock(false, "2026-11-09T14:30:00Z"), new Date("2026-11-06T22:00:00Z"))).toBe(
      "After hours",
    );
    expect(session(clock(false, "2026-11-09T14:30:00Z"), new Date("2026-11-07T15:00:00Z"))).toBe(
      "Market closed",
    );
    expect(session(undefined, new Date())).toBe("Session unknown");
  });
});

describe("equity chart", () => {
  it("rebases the benchmark to the account's first value and measures drawdown from the peak", () => {
    expect(
      rebased(
        [
          { time: "a", value: 50 },
          { time: "b", value: 55 },
        ],
        1000,
      ).map((p) => p.value),
    ).toEqual([1000, 1100]);
    expect(
      drawdown([
        { time: "a", value: 100 },
        { time: "b", value: 120 },
        { time: "c", value: 90 },
      ]).map((p) => p.value),
    ).toEqual([0, 0, -0.25]);
  });

  it("folds a day's fills into one marker per side", () => {
    const marks = dailyMarks([
      { time: "2026-11-03T15:00:00Z", side: "buy", symbol: "SPUS" },
      { time: "2026-11-03T14:00:00Z", side: "buy", symbol: "HLAL" },
      { time: "2026-11-03T16:00:00Z", side: "sell", symbol: "BTC/USD" },
    ]);
    expect(marks).toEqual([
      { time: "2026-11-03T14:00:00Z", side: "buy", text: "HLAL SPUS" },
      { time: "2026-11-03T16:00:00Z", side: "sell", text: "BTC/USD" },
    ]);
  });
});

describe("positions", () => {
  const position = {
    symbol: "SPUS",
    asset_class: "us_equity",
    side: "long",
    qty: 10,
    avg_entry_price: 50,
    current_price: 55,
    market_value: 550,
    unrealized_pl: 50,
  };
  it("prices from the live quote when there is one and drops dust", () => {
    const [row] = positionRows(
      [position, { ...position, symbol: "BTCUSD", qty: 1e-9, market_value: 0.00007 }],
      1000,
      { SPUS: { bid_price: 59, ask_price: 61 } },
    );
    expect(row).toMatchObject({
      price: 60,
      value: 600,
      unrealized_pl: 100,
      weight: 0.6,
      gain_pct: 0.2,
    });
  });

  it("asks for a phrase that names the count", () => {
    expect(closePhrase(1)).toBe("CLOSE 1 POSITION");
    expect(closePhrase(5)).toBe("CLOSE 5 POSITIONS");
  });
});

describe("orders", () => {
  it("builds a request with only the prices its type uses and coins good till canceled", () => {
    const base = {
      symbol: " btc/usd ",
      side: "buy" as const,
      qty: 0.1,
      limit: 70_000,
      stop: 65_000,
      tif: "day" as const,
    };
    expect(requestOf({ ...base, kind: "limit" })).toMatchObject({
      symbol: "BTC/USD",
      limit_price: 70_000,
      stop_price: null,
      time_in_force: "gtc",
    });
    expect(requestOf({ ...base, symbol: "SPUS", kind: "market" })).toMatchObject({
      limit_price: null,
      stop_price: null,
      time_in_force: "day",
    });
  });

  it("orders the lifecycle by time and leaves out stages that did not happen", () => {
    const order = {
      created_at: "2026-11-06T14:00:00Z",
      submitted_at: "2026-11-06T14:00:01Z",
      filled_at: "2026-11-06T14:30:00Z",
      canceled_at: null,
    } as never;
    expect(stages(order).map((stage) => stage.label)).toEqual(["Created", "Submitted", "Filled"]);
  });
});

describe("stream batching", () => {
  it("tells listeners once for a burst of quotes", () => {
    vi.useFakeTimers();
    const store = new StreamStore("ws://test");
    let told = 0;
    store.subscribe(() => {
      told += 1;
    });
    for (let index = 0; index < 500; index += 1) {
      store.handle({
        type: "quote",
        symbol: "BTC/USD",
        bid_price: index,
        ask_price: index + 1,
        time: "t",
      });
    }
    expect(told).toBe(0);
    vi.advanceTimersByTime(250);
    expect(told).toBe(1);
    expect(store.snapshot().quotes["BTC/USD"]?.bid_price).toBe(499);
    vi.useRealTimers();
  });
});

describe("stream", () => {
  it("keeps the latest quote per symbol and passes order updates on", () => {
    const store = new StreamStore("ws://test");
    const seen: string[] = [];
    store.onOrder = (update) => seen.push(update.event);
    store.handle({ type: "quote", symbol: "SPUS", bid_price: 1, ask_price: 2, time: "t" });
    store.handle({ type: "order_update", symbol: "SPUS", event: "fill" });
    expect(store.snapshot().quotes.SPUS?.ask_price).toBe(2);
    expect(store.snapshot().updates).toHaveLength(1);
    expect(seen).toEqual(["fill"]);
  });
});

describe("stream watching", () => {
  class FakeSocket {
    static last: FakeSocket;
    readyState = 1;
    sent: string[] = [];
    onopen: () => void = () => {};
    onmessage: () => void = () => {};
    onclose: () => void = () => {};
    constructor() {
      FakeSocket.last = this;
    }
    send(text: string) {
      this.sent.push(text);
    }
    close() {}
  }

  it("asks for each watched symbol once and says so again after a reconnect", () => {
    vi.stubGlobal("WebSocket", Object.assign(FakeSocket, { OPEN: 1 }));
    const store = new StreamStore("ws://test");
    store.start();
    const socket = FakeSocket.last;
    const first = store.watch("SPUS");
    const second = store.watch("SPUS");
    store.watch("SOL/USD");
    first();
    expect(JSON.parse(socket.sent.at(-1) ?? "{}").symbols).toEqual(["SPUS", "SOL/USD"]);
    second();
    expect(JSON.parse(socket.sent.at(-1) ?? "{}").symbols).toEqual(["SOL/USD"]);
    store.start();
    FakeSocket.last.onopen();
    expect(JSON.parse(FakeSocket.last.sent.at(-1) ?? "{}")).toEqual({
      action: "watch",
      symbols: ["SOL/USD"],
    });
    vi.unstubAllGlobals();
  });

  it("hands every trade to the symbol's listeners until they unsubscribe", () => {
    const store = new StreamStore("ws://test");
    const prices: number[] = [];
    const off = store.onTrade("SPUS", (trade) => prices.push(trade.price));
    for (const price of [1, 2]) {
      store.handle({ type: "trade", symbol: "SPUS", price, size: 1, time: "t" });
    }
    off();
    store.handle({ type: "trade", symbol: "SPUS", price: 3, size: 1, time: "t" });
    expect(prices).toEqual([1, 2]);
  });
});

describe("order routes", () => {
  const form = {
    symbol: "aapl",
    side: "buy" as const,
    kind: "limit" as const,
    qty: 10,
    limit: 200,
    stop: null,
    tif: "day" as const,
  };

  it("sends a trailing stop by percent and exits only when asked for", () => {
    expect(requestOf({ ...form, kind: "trailing_stop", trail: 2 })).toMatchObject({
      type: "trailing_stop",
      trail_percent: 2,
      limit_price: null,
      order_class: "simple",
      take_profit: null,
    });
    expect(requestOf({ ...form, exits: "bracket", takeProfit: 220, stopLoss: 190 })).toMatchObject({
      order_class: "bracket",
      take_profit: 220,
      stop_loss: 190,
    });
  });

  it("leaves slices out of a VWAP and urgency to a shortfall", () => {
    const plan = { duration: 60, slices: 6, aversion: 5 };
    expect(algoOf("vwap", form, plan)).toMatchObject({ slices: null, risk_aversion: 1 });
    expect(algoOf("shortfall", form, plan)).toMatchObject({ slices: 6, risk_aversion: 5 });
    expect(algoOf("twap", { ...form, kind: "market" }, plan).limit_price).toBeNull();
  });
});

describe("sizing and the quick bar", () => {
  it("finds the shares that reach a weight and the weight after some shares", async () => {
    const { sharesFor, weightAfter } = await import("../views/Sizing");
    expect(sharesFor(0.1, 5_000, 50, 100_000)).toBe(100);
    expect(sharesFor(0.02, 5_000, 50, 100_000)).toBe(-60);
    expect(weightAfter(100, 5_000, 50, 100_000)).toBeCloseTo(0.1);
  });

  it("reads a quantity and an optional limit", async () => {
    const { parseQuick } = await import("../views/QuickOrder");
    expect(parseQuick("2", "")).toEqual({ qty: 2, price: null });
    expect(parseQuick("0.5", "70000")).toEqual({ qty: 0.5, price: 70_000 });
    expect(parseQuick("-1", "")).toBeNull();
    expect(parseQuick("1", "abc")).toBeNull();
  });
});

describe("refinements", () => {
  it("places a working order on its nearest level and sums a dragged range", async () => {
    const { nearest, dragQuantity } = await import("../views/Ladder");
    expect(nearest(100.4, [99, 100, 101])).toBe(100);
    const rungs = [
      { price: 1, size: 2, total: 2 },
      { price: 2, size: 3, total: 5 },
      { price: 3, size: 4, total: 9 },
    ];
    expect(dragQuantity(rungs, 2, 0)).toBe(9);
    expect(dragQuantity(rungs, 1, 1)).toBe(3);
  });

  it("accepts the quantity or CONFIRM on a live account", async () => {
    const { confirmedPhrase } = await import("../views/QuickOrder");
    expect(confirmedPhrase("confirm", "5")).toBe(true);
    expect(confirmedPhrase("5.0", "5")).toBe(true);
    expect(confirmedPhrase("4", "5")).toBe(false);
    expect(confirmedPhrase("", "5")).toBe(false);
  });

  it("weights costs by notional and skips unknowns", async () => {
    const { weightedBps } = await import("../views/Blotter");
    const trade = (notional: number, impact: number | null) =>
      ({ notional, impact_bps: impact, time: "2026-11-05T15:00:00Z" }) as never;
    expect(weightedBps([trade(100, 10), trade(300, 2), trade(50, null)], "impact_bps")).toBeCloseTo(
      4,
    );
  });

  it("counts promotion days on weekdays only", async () => {
    const { nextPromotion } = await import("../views/Promotion");
    expect(nextPromotion(1, new Date(2026, 10, 6))).toBe("Nov 9");
  });

  it("names an error's class", async () => {
    const { errorClass } = await import("../components/Loadable");
    expect(errorClass({ detail: "internal server error occurred" })).toBe("Server error");
    expect(errorClass(new Error("Failed to fetch"))).toBe("Network");
  });

  it("keeps the phone to monitoring views", async () => {
    const { allowedOnPhone } = await import("../shell/mobile");
    expect(allowedOnPhone("/")).toBe(true);
    expect(allowedOnPhone("/positions")).toBe(true);
    expect(allowedOnPhone("/orders")).toBe(false);
    expect(allowedOnPhone("/settings")).toBe(false);
  });
});

describe("agent confidence", () => {
  it("finds a signal's confidence by agent, day and symbol and colours it", async () => {
    const { confidenceOf, intentOf } = await import("../views/confidence");
    const found = { ppo: { "2026-11-06": { SPUS: 0.84 } }, sac: {}, a2c: {} };
    expect(confidenceOf(found, { algorithm: "ppo", decided: "2026-11-06", symbol: "SPUS" })).toBe(
      0.84,
    );
    expect(
      confidenceOf(found, { algorithm: "sac", decided: "2026-11-06", symbol: "SPUS" }),
    ).toBeNull();
    expect([intentOf(0.84), intentOf(0.65), intentOf(0.4), intentOf(null)]).toEqual([
      "success",
      "warning",
      "none",
      "none",
    ]);
  });
});

describe("a strategy version's values", () => {
  it("reads shares as percents, lists as text and leaves gaps as a dash", () => {
    expect(described("target_vol", 0.12)).toBe("12%");
    expect(described("trade_rate", 1)).toBe("100%");
    expect(described("lookbacks", [50, 100])).toBe("50, 100");
    expect(described("lookbacks", [])).toBe("—");
    expect(described("target_vol", null)).toBe("—");
    expect(described("signal", "multitrend")).toBe("Multi-speed trend");
    expect(described("proxy", true)).toBe("Yes");
    expect(described("fills", "close")).toBe("Close");
  });
});

describe("strategy edits", () => {
  const base: Draft = {
    name: "my-trend",
    title: "My trend",
    description: "SPUS above its average",
    universe: ["SPUS"],
    signal: "sma",
    window: 150,
    lookbacks: [],
    target_vol: null,
    vol_window: 20,
    band: 0,
    trade_rate: 1,
    top_n: 1,
    fee_bps: 5,
    fills: "next_open",
    proxy: false,
    note: null,
  };

  it("tells a change of wording from a change of rule", () => {
    expect(rewordedOnly(base, { ...base, title: "Better", description: "Clearer" })).toBe(true);
    expect(rewordedOnly(base, { ...base, window: 100 })).toBe(false);
  });

  it("says what changed between versions in words", () => {
    expect(
      changed([
        { field: "window", before: 150, after: 100 },
        { field: "trade_rate", before: 1, after: 0.25 },
      ]),
    ).toBe("Window, days 150 → 100 · Traded each day 100% → 25%");
    expect(changed([])).toBe("");
  });
});
