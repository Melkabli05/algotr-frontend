import { type Chart, type OverlayEvent, registerOverlay } from "klinecharts";

export interface Marker {
  id: string;
  time: number;
  price: number;
  side: "buy" | "sell";
  title: string;
  lines: string[];
}

export interface MarkerColours {
  buy: string;
  sell: string;
  edge: string;
}

export const MARKERS = "markers";
const SIZE = 6;

let registered = false;

export function registerMarkers(): void {
  if (registered) return;
  registered = true;
  registerOverlay({
    name: "tradeMark",
    totalStep: 2,
    lock: true,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ coordinates, overlay }) => {
      const at = coordinates[0];
      const { side, colours } = overlay.extendData as {
        side: Marker["side"];
        colours: MarkerColours;
      };
      if (!at) return [];
      const reach = SIZE * 1.6 * (side === "buy" ? 1 : -1);
      return {
        type: "polygon",
        attrs: {
          coordinates: [
            { x: at.x, y: at.y },
            { x: at.x - SIZE, y: at.y + reach },
            { x: at.x + SIZE, y: at.y + reach },
          ],
        },
        styles: {
          style: "stroke_fill",
          color: colours[side],
          borderColor: colours.edge,
          borderSize: 1,
        },
      };
    },
  });
}

export interface Hover {
  marker: Marker;
  x: number;
  y: number;
}

export function placeMarkers(
  chart: Chart,
  markers: Marker[],
  colours: MarkerColours,
  onHover: (hover: Hover | null) => void,
): void {
  chart.removeOverlay({ groupId: MARKERS });
  for (const marker of markers) {
    chart.createOverlay({
      name: "tradeMark",
      groupId: MARKERS,
      lock: true,
      points: [{ timestamp: marker.time, value: marker.price }],
      extendData: { side: marker.side, colours },
      onMouseEnter: (event: OverlayEvent<unknown>) =>
        onHover({ marker, x: event.pageX ?? 0, y: event.pageY ?? 0 }),
      onMouseLeave: () => onHover(null),
      onRightClick: (event: OverlayEvent<unknown>) => event.preventDefault?.(),
    });
  }
}
