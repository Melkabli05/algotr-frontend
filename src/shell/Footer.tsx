import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Explained } from "../components/Explained";
import { time } from "../format";
import { explain } from "../glossary";
import { useStream } from "../stream/store";
import { FeedDots } from "./Freshness";

const PROBE_MS = 10_000;

function useLatency(): number | null {
  const [latency, setLatency] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const probe = async () => {
      const started = performance.now();
      try {
        await fetch("/health", { cache: "no-store" });
        if (alive) setLatency(Math.round(performance.now() - started));
      } catch {
        if (alive) setLatency(null);
      }
    };
    probe();
    const timer = setInterval(probe, PROBE_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return latency;
}

export function session(
  clock: { is_open: boolean; next_open: string; next_close: string } | undefined,
  now: Date,
): string {
  if (!clock) return "Session unknown";
  if (clock.is_open) return "Market open";
  const zone = { timeZone: "America/New_York" } as const;
  const day = now.toLocaleDateString("en-US", zone);
  const hour = Number(now.toLocaleString("en-US", { ...zone, hour: "numeric", hour12: false }));
  const opensToday = new Date(clock.next_open).toLocaleDateString("en-US", zone) === day;
  if (opensToday && hour >= 4) return "Pre-market";
  const weekday = now.toLocaleDateString("en-US", { ...zone, weekday: "short" });
  if (!["Sat", "Sun"].includes(weekday) && hour >= 16 && hour < 20) return "After hours";
  return "Market closed";
}

function Dot({ ok, label, tip }: { ok: boolean | null; label: string; tip?: string }) {
  const kind = ok == null ? "" : ok ? "dot-ok" : "dot-error";
  return (
    <span>
      <span className={`dot ${kind}`} aria-hidden />
      <Explained text={tip}>{label}</Explained>
    </span>
  );
}

const STREAM_TIP =
  "The terminal's live connection to this platform, which carries prices and order updates.";

export function Footer() {
  const latency = useLatency();
  const stream = useStream();
  const account = api.useQuery("get", "/account");
  const clock = api.useQuery("get", "/market/clock", undefined, { refetchInterval: 60_000 });
  const feed = api.useQuery("get", "/market/feed", undefined, { staleTime: 600_000 });
  return (
    <footer className="shell-foot">
      <Dot
        ok={latency != null}
        label={latency == null ? "API down" : `API ${latency} ms`}
        tip={explain("api")}
      />
      <Dot
        ok={stream.connected}
        label={stream.connected ? "Stream" : "Stream down"}
        tip={STREAM_TIP}
      />
      <Dot
        ok={account.data ? account.data.status === "ACTIVE" : null}
        label="Broker"
        tip={explain("broker")}
      />
      <Explained text={explain("last quote")}>
        {stream.last ? `Last quote ${time(new Date(stream.last))}` : "No quotes yet"}
      </Explained>
      <Explained text={explain("market")}>{session(clock.data, new Date())}</Explained>
      {feed.data ? (
        <Explained text={explain("stock data")}>
          Stock data {feed.data.feed.toUpperCase()}
        </Explained>
      ) : null}
      <span className="grow" />
      <Explained text={explain("data feeds")}>Feeds</Explained>
      <FeedDots />
    </footer>
  );
}
