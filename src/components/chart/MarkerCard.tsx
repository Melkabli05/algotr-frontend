import type { Hover } from "./markers";

const GAP = 14;
const WIDTH = 260;

export function MarkerCard({ hover }: { hover: Hover | null }) {
  if (!hover) return null;
  const left = Math.min(hover.x - window.scrollX + GAP, window.innerWidth - WIDTH - GAP);
  const top = hover.y - window.scrollY + GAP;
  return (
    <div className="marker-card" role="tooltip" style={{ left, top, width: WIDTH }}>
      <div className="marker-card-title">{hover.marker.title}</div>
      {hover.marker.lines.map((text) => (
        <div key={text} className="muted">
          {text}
        </div>
      ))}
    </div>
  );
}
