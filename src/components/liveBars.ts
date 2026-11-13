import type { KLineData } from "klinecharts";

const DAY = 86_400_000;

export const STEPS: Record<string, number> = {
  "1Min": 60_000,
  "5Min": 300_000,
  "15Min": 900_000,
  "1Hour": 3_600_000,
  "1Day": DAY,
};

const NEW_YORK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

function newYorkMidnight(ms: number): number {
  const part = (type: string) =>
    Number(NEW_YORK.formatToParts(ms).find((item) => item.type === type)?.value);
  const local = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  const offset = local - Math.floor(ms / 1000) * 1000;
  return Date.UTC(part("year"), part("month") - 1, part("day")) - offset;
}

export function barStart(ms: number, timeframe: string, crypto: boolean): number {
  const step = STEPS[timeframe] ?? DAY;
  if (timeframe === "1Day" && !crypto) return newYorkMidnight(ms);
  return Math.floor(ms / step) * step;
}

export interface Print {
  price: number;
  size: number;
  ms: number;
}

export function applyTrade(
  last: KLineData | null,
  print: Print,
  timeframe: string,
  crypto: boolean,
): { bar: KLineData; opened: boolean } | null {
  const start = barStart(print.ms, timeframe, crypto);
  if (!last || start > last.timestamp) {
    return {
      opened: last != null,
      bar: {
        timestamp: start,
        open: print.price,
        high: print.price,
        low: print.price,
        close: print.price,
        volume: print.size,
      },
    };
  }
  if (start < last.timestamp) return null;
  return {
    opened: false,
    bar: {
      ...last,
      close: print.price,
      high: Math.max(last.high, print.price),
      low: Math.min(last.low, print.price),
      volume: (last.volume ?? 0) + print.size,
    },
  };
}

export function mergeBar(last: KLineData | null, fetched: KLineData): KLineData | null {
  if (!last || fetched.timestamp > last.timestamp) return fetched;
  if (fetched.timestamp < last.timestamp) return null;
  return (fetched.volume ?? 0) >= (last.volume ?? 0) ? fetched : null;
}
