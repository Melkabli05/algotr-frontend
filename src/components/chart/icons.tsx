import type { ReactNode } from "react";

const dot = (x: number, y: number) => (
  <circle key={`${x}-${y}`} cx={x} cy={y} r={1.7} fill="currentColor" stroke="none" />
);

const SHAPES: Record<string, ReactNode> = {
  straightLine: (
    <>
      <path d="M2 15 L16 3" />
      {dot(5, 12.5)}
      {dot(13, 5.5)}
    </>
  ),
  rayLine: (
    <>
      <path d="M3 14 L16 4" />
      {dot(3, 14)}
      {dot(9, 9.4)}
    </>
  ),
  segment: (
    <>
      <path d="M4 14 L14 4" />
      {dot(4, 14)}
      {dot(14, 4)}
    </>
  ),
  horizontalStraightLine: (
    <>
      <path d="M1.5 9 H16.5" />
      {dot(9, 9)}
    </>
  ),
  verticalStraightLine: (
    <>
      <path d="M9 1.5 V16.5" />
      {dot(9, 9)}
    </>
  ),
  priceLine: <path d="M2 9 H10.5 M10.5 6 H16 V12 H10.5 Z" />,
  priceChannelLine: (
    <>
      <path d="M2 11 L16 4 M2 16 L16 9" />
      <path d="M2 11 V16 M16 4 V9" strokeDasharray="1.5 2" />
    </>
  ),
  parallelStraightLine: (
    <>
      <path d="M2 10 L16 3 M2 16 L16 9" />
      {dot(5, 8.5)}
      {dot(13, 4.5)}
    </>
  ),
  fibonacciLine: (
    <>
      <path d="M2 3 H16 M2 7 H16 M2 11 H16 M2 15 H16" strokeWidth={1} />
      <path d="M3 15 L15 3" />
    </>
  ),
  brush: (
    <path d="M3 15 C5 15 6 13 7.5 11.5 L14 5 C14.8 4.2 14.8 3.2 14 2.5 C13.3 1.8 12.3 1.8 11.5 2.6 L5 9 C4 10 4 13 3 15 Z" />
  ),
  magnet: <path d="M4.5 3 V9 A4.5 4.5 0 0 0 13.5 9 V3 M4.5 6 H7.5 M10.5 6 H13.5" />,
};

export function ToolIcon({ name }: { name: string }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[name]}
    </svg>
  );
}
