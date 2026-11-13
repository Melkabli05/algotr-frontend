export const CANDLE_PANE = "candle_pane";

export interface IndicatorInfo {
  name: string;
  label: string;
  group: "Trend" | "Momentum" | "Volatility" | "Volume";
  main: boolean;
  about: string;
}

export const INDICATORS: IndicatorInfo[] = [
  {
    name: "MA",
    label: "Moving average",
    group: "Trend",
    main: true,
    about: "Plain average of the close over several lengths; shows direction and support.",
  },
  {
    name: "EMA",
    label: "Exponential moving average",
    group: "Trend",
    main: true,
    about: "Average that weights recent bars more, so it turns sooner than a plain average.",
  },
  {
    name: "SMA",
    label: "Smoothed moving average",
    group: "Trend",
    main: true,
    about: "Moving average with a weight on the newest bar; smoother than the plain one.",
  },
  {
    name: "BBI",
    label: "Bull and bear index",
    group: "Trend",
    main: true,
    about: "Mean of four moving averages; price above it leans bullish.",
  },
  {
    name: "SAR",
    label: "Parabolic SAR",
    group: "Trend",
    main: true,
    about: "Dots that trail price and flip sides when the trend turns; often used as a stop.",
  },
  {
    name: "BOLL",
    label: "Bollinger bands",
    group: "Volatility",
    main: true,
    about:
      "Moving average with bands two standard deviations away; they widen when volatility rises.",
  },
  {
    name: "MACD",
    label: "MACD",
    group: "Momentum",
    main: false,
    about: "Gap between a fast and a slow average, its signal line and the histogram between them.",
  },
  {
    name: "RSI",
    label: "Relative strength index",
    group: "Momentum",
    main: false,
    about: "Momentum from 0 to 100; above 70 is stretched up, below 30 stretched down.",
  },
  {
    name: "KDJ",
    label: "Stochastic KDJ",
    group: "Momentum",
    main: false,
    about:
      "Where the close sits in the recent high-low range, with smoothed K and D lines and a J line.",
  },
  {
    name: "CCI",
    label: "Commodity channel index",
    group: "Momentum",
    main: false,
    about: "How far price is from its average; beyond plus or minus 100 is unusual.",
  },
  {
    name: "WR",
    label: "Williams %R",
    group: "Momentum",
    main: false,
    about: "Close against the recent high, from 0 to minus 100; near 0 is overbought.",
  },
  {
    name: "DMI",
    label: "Directional movement index",
    group: "Trend",
    main: false,
    about: "Plus and minus directional lines with ADX, which measures how strong the trend is.",
  },
  {
    name: "ROC",
    label: "Rate of change",
    group: "Momentum",
    main: false,
    about: "Percent change of the close over a set number of bars.",
  },
  {
    name: "MTM",
    label: "Momentum",
    group: "Momentum",
    main: false,
    about: "Close minus the close some bars ago, with an average of it.",
  },
  {
    name: "TRIX",
    label: "Triple exponential average",
    group: "Momentum",
    main: false,
    about: "Rate of change of a triple-smoothed average; filters out small swings.",
  },
  {
    name: "AO",
    label: "Awesome oscillator",
    group: "Momentum",
    main: false,
    about: "Fast minus slow average of bar midpoints; shows momentum shifts.",
  },
  {
    name: "BIAS",
    label: "Bias",
    group: "Momentum",
    main: false,
    about: "How far price is from its moving average, in percent.",
  },
  {
    name: "PSY",
    label: "Psychological line",
    group: "Momentum",
    main: false,
    about: "Share of up bars over the window; extremes suggest a turn.",
  },
  {
    name: "BRAR",
    label: "BRAR",
    group: "Momentum",
    main: false,
    about: "Two lines, BR and AR, that gauge buying and selling pressure.",
  },
  {
    name: "CR",
    label: "CR energy index",
    group: "Momentum",
    main: false,
    about: "Strength of price against the previous bar's midpoint.",
  },
  {
    name: "DMA",
    label: "Difference of moving averages",
    group: "Trend",
    main: false,
    about: "Gap between a short and a long average, with an average of the gap.",
  },
  {
    name: "VOL",
    label: "Volume",
    group: "Volume",
    main: false,
    about: "Shares or coins traded per bar, with moving averages of volume.",
  },
  {
    name: "OBV",
    label: "On-balance volume",
    group: "Volume",
    main: false,
    about: "Running total that adds volume on up bars and subtracts it on down bars.",
  },
  {
    name: "PVT",
    label: "Price and volume trend",
    group: "Volume",
    main: false,
    about: "Running total of volume scaled by each bar's percent price change.",
  },
  {
    name: "VR",
    label: "Volume ratio",
    group: "Volume",
    main: false,
    about: "Volume on up bars against volume on down bars.",
  },
  {
    name: "EMV",
    label: "Ease of movement",
    group: "Volume",
    main: false,
    about: "How easily price moves per unit of volume; high means it moves on little volume.",
  },
];

export const MAIN_NAMES = new Set(INDICATORS.filter((item) => item.main).map((item) => item.name));

export interface ToolInfo {
  name: string;
  label: string;
  about: string;
  hotkey?: string;
  group: "lines" | "channels" | "fib" | "free";
}

export const TOOLS: ToolInfo[] = [
  {
    name: "straightLine",
    label: "Trend line",
    about: "Two clicks; the line runs on past both points.",
    hotkey: "alt+t",
    group: "lines",
  },
  {
    name: "rayLine",
    label: "Ray",
    about: "Two clicks; runs on from the second point.",
    group: "lines",
  },
  {
    name: "segment",
    label: "Segment",
    about: "Two clicks; stops at both points.",
    group: "lines",
  },
  {
    name: "horizontalStraightLine",
    label: "Horizontal line",
    about: "One click at a price.",
    hotkey: "alt+h",
    group: "lines",
  },
  {
    name: "verticalStraightLine",
    label: "Vertical line",
    about: "One click at a time.",
    hotkey: "alt+v",
    group: "lines",
  },
  {
    name: "priceLine",
    label: "Price line",
    about: "One click; a line that carries its price label.",
    group: "lines",
  },
  {
    name: "priceChannelLine",
    label: "Price channel",
    about: "Three clicks; two parallel lines, the third sets their gap.",
    group: "channels",
  },
  {
    name: "parallelStraightLine",
    label: "Parallel lines",
    about: "Three clicks; a trend line and one parallel to it.",
    group: "channels",
  },
  {
    name: "fibonacciLine",
    label: "Fibonacci retracement",
    about: "Two clicks; levels at 23.6, 38.2, 50, 61.8 and 78.6 percent between them.",
    hotkey: "alt+f",
    group: "fib",
  },
  {
    name: "brush",
    label: "Brush",
    about: "Press and drag to draw freehand.",
    group: "free",
  },
];

export const TYPES = [
  { value: "candle_solid", label: "Candles" },
  { value: "candle_stroke", label: "Hollow candles" },
  { value: "candle_up_stroke", label: "Hollow up candles" },
  { value: "ohlc", label: "Bars" },
  { value: "area", label: "Area" },
];

export const SCALES = [
  { value: "normal", short: "Auto", label: "Linear price scale" },
  { value: "logarithm", short: "Log", label: "Logarithmic price scale", hotkey: "alt+l" },
  { value: "percentage", short: "%", label: "Percent from the first visible bar", hotkey: "alt+p" },
] as const;

export type Scale = (typeof SCALES)[number]["value"];

export const FRAMES = [
  { value: "1Min", short: "1m", label: "1 minute" },
  { value: "5Min", short: "5m", label: "5 minutes" },
  { value: "15Min", short: "15m", label: "15 minutes" },
  { value: "1Hour", short: "1h", label: "1 hour" },
  { value: "1Day", short: "1D", label: "1 day" },
] as const;
