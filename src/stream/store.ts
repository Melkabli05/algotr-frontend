import { useSyncExternalStore } from "react";

export interface Quote {
  symbol: string;
  bid_price: number;
  ask_price: number;
  time: string;
}

export interface Trade {
  symbol: string;
  price: number;
  size: number;
  time: string;
}

export interface OrderUpdate {
  symbol: string;
  event: string;
  order_id?: string;
  time?: string;
  [key: string]: unknown;
}

export interface StreamState {
  connected: boolean;
  quotes: Record<string, Quote>;
  trades: Record<string, Trade>;
  updates: OrderUpdate[];
  last: number | null;
}

type Listener = () => void;
type Handler = (update: OrderUpdate) => void;

const KEPT = 100;
const RETRY_MS = 2000;
const NOTIFY_MS = 200;

export class StreamStore {
  private state: StreamState = {
    connected: false,
    quotes: {},
    trades: {},
    updates: [],
    last: null,
  };
  private listeners = new Set<Listener>();
  private tradeListeners = new Map<string, Set<(trade: Trade) => void>>();
  private watched = new Map<string, number>();
  private socket: WebSocket | null = null;
  private stopped = false;
  private pending: ReturnType<typeof setTimeout> | null = null;
  onOrder: Handler = () => {};

  constructor(private readonly url: string) {}

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  snapshot = (): StreamState => this.state;

  watch = (symbol: string): (() => void) => {
    this.watched.set(symbol, (this.watched.get(symbol) ?? 0) + 1);
    this.sendWatch();
    return () => {
      const left = (this.watched.get(symbol) ?? 1) - 1;
      if (left > 0) this.watched.set(symbol, left);
      else this.watched.delete(symbol);
      this.sendWatch();
    };
  };

  private sendWatch(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ action: "watch", symbols: [...this.watched.keys()] }));
  }

  onTrade = (symbol: string, listener: (trade: Trade) => void): (() => void) => {
    const found = this.tradeListeners.get(symbol) ?? new Set();
    found.add(listener);
    this.tradeListeners.set(symbol, found);
    return () => found.delete(listener);
  };

  start(): void {
    this.stopped = false;
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.onopen = () => {
      this.set({ connected: true });
      this.sendWatch();
    };
    socket.onmessage = (message) => this.handle(JSON.parse(String(message.data)));
    socket.onclose = () => {
      this.set({ connected: false });
      if (!this.stopped) setTimeout(() => this.start(), RETRY_MS);
    };
  }

  stop(): void {
    this.stopped = true;
    this.socket?.close();
  }

  handle(event: { type: string; symbol: string } & Record<string, unknown>): void {
    const last = Date.now();
    if (event.type === "quote") {
      this.set({
        quotes: { ...this.state.quotes, [event.symbol]: event as unknown as Quote },
        last,
      });
    } else if (event.type === "trade") {
      this.set({
        trades: { ...this.state.trades, [event.symbol]: event as unknown as Trade },
        last,
      });
      for (const listener of this.tradeListeners.get(event.symbol) ?? []) {
        listener(event as unknown as Trade);
      }
    } else if (event.type === "order_update") {
      const update = event as unknown as OrderUpdate;
      this.set({ updates: [update, ...this.state.updates].slice(0, KEPT), last });
      this.onOrder(update);
    }
  }

  private set(change: Partial<StreamState>): void {
    this.state = { ...this.state, ...change };
    if (this.pending == null) {
      this.pending = setTimeout(() => {
        this.pending = null;
        for (const listener of this.listeners) listener();
      }, NOTIFY_MS);
    }
  }
}

const scheme = window.location.protocol === "https:" ? "wss" : "ws";
export const stream = new StreamStore(`${scheme}://${window.location.host}/stream`);

export function useStream(): StreamState {
  return useSyncExternalStore(stream.subscribe, stream.snapshot);
}
