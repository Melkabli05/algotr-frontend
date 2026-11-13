const PAGES: Record<string, string> = {
  "command center":
    "The morning view: today's P&L, open positions, what the autopilot and the agents decided, and whether everything is connected.",
  dashboard: "Account value over time, open orders and the main risk numbers in one screen.",
  markets: "Live prices and charts of the symbols the platform streams.",
  positions: "What the account holds now, what each holding cost and what it is worth.",
  orders:
    "Every order with its status. Orders are queued as commands and placed by the trading node.",
  "trade blotter": "Every fill, with what it cost against the arrival price, TWAP and VWAP.",
  "order book":
    "The bids and asks waiting on a coin, and what a market order of a given size would cost.",
  strategies:
    "The rule strategies, their backtests and the lifecycle stage that decides whether they trade.",
  "signals and xai":
    "What the AI agents decided each day and why: SHAP shows which inputs pushed each decision.",
  backtesting: "Run a strategy over past prices to see how it would have done, with costs.",
  research: "Labs that search for better rules and judge them against overfitting.",
  risk: "How much the portfolio could lose, where it is concentrated, and the limits on new orders.",
  compliance: "The Shariah screen of each symbol, and purification of impure income.",
  reconciliation:
    "Checks that the platform's own record of holdings matches what Alpaca says the account holds.",
  "audit log": "A tamper-evident record of every order, setting change and decision.",
  system: "Health of the API, the connection to Alpaca, the data feeds and the scheduled jobs.",
  settings: "Autopilot, risk limits, alerts and display settings.",
  automation:
    "How strategies earn the right to trade (lifecycle), the circuit breakers and kill switches that stop them, the AI models in use, and the quality of the market data.",
};

const TERMS: Record<string, string> = {
  paper: "A paper account: simulated money at Alpaca. Nothing here risks real cash.",
  live: "A live account: real money.",
  "account value": "Cash plus the market value of everything held, as Alpaca reports it.",
  today: "Change in account value since yesterday's close, in dollars and percent.",
  "autopilot drawdown":
    "How far the autopilot's own holdings have fallen from their highest value. Past the limit in Settings it sells and stops.",
  "kill switch":
    "Stops all trading at once: cancels open orders and sells every position. Resume clears it.",
  "daily p&l": "Profit or loss of the account today.",
  "open positions": "How many symbols the account holds, and their combined value.",
  "net exposure": "Value of long holdings minus short ones. This account never shorts.",
  "active strategies": "Strategies trading now (lifecycle canary or live), paused, or in error.",
  "risk state":
    "The autopilot's kill-switch step: normal, reduce (positions cut) or flatten (sold and stopped).",
  "live activity": "The latest events: runs, research, settings changes and alerts.",
  "agent signals":
    "What each AI agent wanted to hold each day. The ensemble blends them by how well each has done.",
  "ensemble weights": "How much each agent counts in the blended decision, learned from results.",
  "alpaca connection":
    "Whether the platform's streams to Alpaca are up and how recent the data is.",
  "order path": "How long an order takes from your click to Alpaca accepting it, then to a fill.",
  streams: "Live connections to Alpaca for account updates and market data.",
  "data feeds": "Each source of data, when it last updated, and whether that is too long ago.",
  "models and storage": "The AI models, when they were trained, and how much disk each store uses.",
  checks:
    "Pass or fail tests. For a strategy: the statistical checks it must pass to be trusted. For the system: the health checks.",
  "scheduled jobs": "Background tasks and when each runs next.",
  "promotion readiness":
    "How close each strategy is to trading: its lifecycle stage and the gates it has passed.",
  "paper fills against the backtest's cost":
    "What orders actually cost to fill, compared with the cost the backtest assumed. Paying more means live results will trail the backtest.",
  "paid, bps":
    "Average cost of filling, in basis points (1 bp = 0.01%) against the decision price.",
  "backtest assumes, bps": "The cost per trade the backtest charged.",
  "shortfall, bps":
    "Implementation shortfall: how far fills landed from the price when the decision was made. Positive is a cost.",
  shortfall: "How far fills landed from the decision price. Positive is a cost.",
  strategy: "A fixed trading rule, or the AI agents' ensemble.",
  type: "The kind of rule or order.",
  status: "Where it stands now.",
  sharpe:
    "Return per unit of risk, per year. Above 1 is good; below 0 loses money. Higher is better.",
  "median sharpe": "The middle Sharpe across the variants or folds tested.",
  "best sharpe": "The highest Sharpe among the variants tested; likely flattered by luck.",
  cagr: "Compound annual growth rate: the yearly return that would give the same total growth.",
  "max drawdown": "The largest fall from a peak to a low, as a percent. Smaller is safer.",
  "best drawdown": "The smallest maximum drawdown among the variants tested.",
  drawdown: "Fall from the highest value so far.",
  deflated:
    "Deflated Sharpe: the probability the Sharpe is real after allowing for how many rules were tried. Above 95% is convincing.",
  "deflated sharpe":
    "The probability the Sharpe is real after allowing for how many rules were tried. Above 95% is convincing.",
  overfit:
    "Probability of backtest overfitting: the chance the best rule in-sample does worse than average out of sample.",
  "reality p":
    "White's reality check: chance the best rule beat buy-and-hold only by luck. Low is good.",
  "out of sample": "Results on data the rule was not tuned on: the honest test.",
  "beats cash": "Whether the rule earned more than holding cash.",
  consistency: "How often the rule beat its benchmark across separate periods.",
  survives: "Whether the result holds after costs and the overfitting checks.",
  fold: "One slice of history in walk-forward testing: tune on the past, test on the next slice.",
  "walk-forward folds of the best":
    "The best rule's results on each slice of history it was not tuned on.",
  gates: "The tests a strategy or agent must pass to move to the next stage or to trade.",
  "judged by the gates": "Each AI agent against the five gates that decide whether it may trade.",
  eligible: "Passed every gate, so it may trade.",
  stage:
    "Lifecycle stage: research, validated, shadow (paper only), canary (10% of capital), live, retired.",
  "days in stage": "How long it has been at its current lifecycle stage.",
  "days in a row": "Consecutive days it has passed its checks.",
  "typical stay": "How long strategies usually stay at this stage.",
  "next step": "What it needs next to move on.",
  confidence:
    "How often the agent's own randomised policy makes the same move. 1.0 means it always agrees with itself.",
  "calibration: stated confidence against hit rate":
    "Whether confident decisions are actually right more often. A calibrated agent's 70% calls are right about 70% of the time.",
  agent: "One of the AI agents: PPO, SAC or A2C, three reinforcement-learning methods.",
  signal: "What the rule or agent wants: buy, sell or hold, and how much.",
  weight: "Share of the capital it wants in that asset.",
  "ensemble weight": "How much this agent counts in the blended decision.",
  change: "How much the wanted weight moved since the previous decision.",
  "what the agents rely on, mean shap push and rank":
    "Which inputs move the agents' decisions most. SHAP splits each decision into the push from each input.",
  push: "SHAP value: how much this input pushed the decision up (+) or down (-).",
  feature: "One input a model reads, such as a 20-day return or RSI.",
  "recent signals": "The latest decisions of the rules and agents.",
  "right the next day": "Whether the decision's direction matched the next day's move.",
  "right?": "Whether the decision's direction matched the next day's move.",
  "next day": "The asset's return the day after the decision.",
  "recent outcomes": "How recent decisions turned out.",
  unexplained: "Decisions still waiting for their SHAP explanation.",
  "days followed": "Days of paper record the agent has.",
  "agents followed": "The AI agents being tracked on paper.",
  "risk use": "How much of each risk limit is used now.",
  "risk events": "Orders the risk checks refused, and limits crossed.",
  limits: "The risk limits every new buy is checked against.",
  "near misses: orders that passed using 80% or more of a limit":
    "Orders that were allowed but came close to a limit.",
  var: "Value at risk: the loss not exceeded on 95% of days.",
  sizing: "How big each position should be for the risk it carries.",
  symbol: "The ticker: a stock or fund (SPUS), or a coin pair (BTC/USD).",
  side: "Buy or sell.",
  qty: "Quantity: shares, or coins.",
  price: "Price per share or coin.",
  limit: "The worst price the order accepts: no higher for a buy, no lower for a sell.",
  filled: "How much of the order has traded.",
  "avg fill": "Average price of the fills.",
  tif: "Time in force: how long the order stays open. day, gtc (until canceled), ioc (fill now or cancel), fok (all now or nothing), opg (at the open), cls (at the close).",
  submitted: "When the order was sent.",
  notional: "Dollar value: quantity times price.",
  "p&l": "Profit or loss.",
  "p&l %": "Profit or loss as a percent of cost.",
  "avg cost": "Average price paid for what is held.",
  basis: "Cost basis: what was paid, used for tax and profit.",
  value: "Market value now.",
  held: "Quantity held.",
  "days held": "How long it has been held.",
  impact: "How much the order itself would move the price.",
  arrival: "The price when the order arrived: the benchmark for its cost.",
  "vs twap":
    "Fill against the time-weighted average price over the order's life. Negative is better for a buy.",
  "vs vwap": "Fill against the volume-weighted average price. Negative is better for a buy.",
  "day vwap": "The day's volume-weighted average price.",
  algo: "Execution algorithm: TWAP (even slices), VWAP (slices by usual volume), shortfall (balances cost and risk), iceberg (shows only part).",
  slice: "One child order of an algorithm.",
  bid: "Highest price a buyer is offering.",
  ask: "Lowest price a seller is asking.",
  "bid size": "Quantity offered at the bid.",
  "ask size": "Quantity offered at the ask.",
  depth: "How much is offered at each price level.",
  ladder: "Prices with the size waiting at each; click to place a limit order there.",
  shariah: "Whether the symbol passes the Shariah screen; buys of failing stocks are refused.",
  purification: "The share of income from impure sources that must be given away.",
  "impure share": "Share of the company's income from impermissible sources.",
  owed: "Amount to give away for purification.",
  "wash sale": "A sale at a loss with a repurchase within 30 days: the loss is not deductible.",
  "open lots": "Separate purchases still held, each with its own cost and date.",
  "lots this sell closes": "Which purchases this sale would sell, first in first out.",
  ledger: "The platform's own record of trades, rebuilt from Alpaca's activity.",
  "ledger qty": "Quantity the platform's ledger says is held.",
  "alpaca qty": "Quantity Alpaca says is held. Should match the ledger.",
  "ledger cost": "Cost the ledger records.",
  "alpaca cost": "Cost Alpaca reports.",
  "ledger p&l": "Profit the ledger computes.",
  "alpaca p&l": "Profit Alpaca reports.",
  delta: "The difference between the two.",
  env: "Environment: paper or live.",
  time: "When it happened.",
  event: "What happened.",
  kind: "The category of event.",
  source: "Where it came from.",
  payload: "The full details recorded.",
  detail: "More about it.",
  tier: "Alert urgency: P0 needs action now and must be acknowledged; P1 soon; P2 for information.",
  job: "A background task.",
  "next run": "When the job runs next.",
  part: "The part of the platform the job belongs to.",
  stream: "A live data connection.",
  samples: "How many measurements this is based on.",
  median: "The middle value.",
  worst: "The worst value seen.",
  turnover: "How much of the portfolio is traded per period. High turnover costs more.",
  trades: "Number of trades.",
  "parameters (fixed)":
    "The rule's settings, fixed in advance so they cannot be tuned to the past.",
  universes: "The sets of symbols each rule trades.",
  variants: "Versions of a rule with different settings, tested together.",
  variant: "One version of a rule's settings.",
  candidate: "A rule being tested before it may be used.",
  "sharpe by parameters":
    "How the Sharpe changes with the rule's settings. A smooth hill is robust; a spike is luck.",
  "bias controls":
    "Safeguards against fooling ourselves: look-ahead, survivorship and overfitting checks.",
  "event-driven check":
    "The same rule replayed bar by bar in Nautilus, the engine that trades live, to confirm the fast backtest.",
  "new backtest": "Choose a strategy and period to backtest.",
  "every order": "All orders the platform sent, newest first.",
  "price alerts": "Alerts when a price crosses a level you set.",
  watchlist: "Symbols you follow.",
  headlines: "News headlines with their FinBERT sentiment score (-1 bad to +1 good).",
  "shadow picks, mean excess over spus":
    "What the scanner would have picked, and how those picks did against SPUS.",
  scans: "Market scans run by the scanner.",
  lifecycle:
    "The stages a strategy passes to trade: research, validated, shadow (paper), canary (10% capital), live. Each move needs its gates; canary to live needs your approval.",
  "circuit breakers":
    "Automatic stops at four levels. Trade: one order rejected. Strategy: paused 24h. Portfolio: every position halved until reset. System: trading halted and the autopilot's holdings sold until reset; positions you placed by hand are kept.",
  "kill switches":
    "Manual stops. Global and account switches halt and sell everything; a strategy switch stops that strategy only. They stay on through restarts.",
  "model registry":
    "Every trained AI model version. The production one is in use; promoting an archived one rolls back.",
  "data quality":
    "Problems found in market data: gaps, stale or extreme bars, and disagreement with a second source. Flagged bars are treated as missing. Each finding is chained by hash so the record cannot be edited.",
  "breaker events": "When each breaker opened, half-opened or closed, and why.",
  version:
    "The exact code and settings this was validated with. Any change starts a new version in research.",
  capital: "Share of its allocation the strategy trades with: 10% in canary, 100% live.",
  gate: "A test that must pass before the next stage.",
  "drift severity":
    "How far a model has drifted: low, medium (its allocation is halved) or high (its orders are blocked).",
  "deployment stage":
    "staging (trained, not used), production (in use) or archived (kept for rollback).",
  "quality flags":
    "Why a bar is not trusted: gap, stale, anomalous or cross-source mismatch. Flagged bars count as missing.",
  "chain verified":
    "Every data-quality finding's hash links to the one before; an edited record breaks the chain.",
  "half-open":
    "Cooldown over; the next check decides whether the breaker closes or opens again for twice as long.",
  open: "Tripped: blocking what it guards.",
  closed: "Normal: letting everything through.",
  "api p50": "Half of API requests are answered faster than this.",
  p95: "95% of requests are answered faster than this.",
  p99: "99% of requests are answered faster than this.",
  "server errors": "API requests that failed on the server.",
  "alpaca api": "How long Alpaca took to answer the last health check.",
  "alpaca error rate": "Share of recent calls to Alpaca that failed.",
  api: "Response time of this platform's API.",
  broker: "Whether Alpaca answers.",
  "last quote": "When the last price arrived.",
  market: "Whether the US stock market is open.",
  "stock data": "Which Alpaca stock data feed is used: IEX (free) or SIP (all exchanges).",
  news: "How long since the last headline arrived.",
  coins: "How long since the crypto table was refreshed.",
  scan: "When the market scanner last ran.",
  books: "How long since the coin order books updated.",
};

function key(label: string): string {
  return label.replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().toLowerCase();
}

export function explain(label: string): string | undefined {
  const found = key(label);
  return TERMS[found] ?? PAGES[found];
}

export function page(label: string): string | undefined {
  return PAGES[key(label)];
}
