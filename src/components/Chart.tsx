import { BarChart, HeatmapChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts/types/dist/shared";
import ReactEChartsCore from "echarts-for-react/esm/core";

echarts.use([
  LineChart,
  BarChart,
  HeatmapChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  SVGRenderer,
]);

import { useDark } from "../shell/theme";

export const GAIN = "#3fbf5f";
export const LOSS = "#f0605d";
export const ACCENT_DARK = "#ff9f1a";
export const ACCENT_LIGHT = "#b86e00";
export const GRAY = "#898781";

export function Chart({
  option,
  height = 240,
  label,
}: {
  option: EChartsOption;
  height?: number;
  label: string;
}) {
  const dark = useDark();
  const text = dark ? "#8f8e88" : "#6b6b66";
  const rule = dark ? "#2a2a28" : "#e2e2df";
  const themed: EChartsOption = {
    backgroundColor: "transparent",
    textStyle: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: text },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    ...option,
  };
  for (const axis of ["xAxis", "yAxis"] as const) {
    const found = themed[axis];
    if (found && !Array.isArray(found)) {
      themed[axis] = {
        axisLine: { lineStyle: { color: rule } },
        splitLine: { lineStyle: { color: rule } },
        axisLabel: { color: text },
        ...found,
      } as never;
    }
  }
  return (
    <div role="img" aria-label={label}>
      <ReactEChartsCore
        echarts={echarts}
        option={themed}
        style={{ height }}
        notMerge
        lazyUpdate
        opts={{ renderer: "svg" }}
      />
    </div>
  );
}
