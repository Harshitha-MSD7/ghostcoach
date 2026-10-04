import type { Points } from './types';
export default function PoseOverlay({ points, edges, color, active = [], viewBox, label }: {
  points: Points; edges: [string, string][]; color: string; active?: string[]; viewBox: string; label: string;
}) {
  const vb = viewBox.split(' ').map(Number);
  const unit = Math.max(vb[2], vb[3]) / 500;
  const valid = (name: string) => points[name] && points[name].confidence >= .35;
  return <svg className="pose-layer" viewBox={viewBox} role="img" aria-label={label}>
    {edges.filter(([a, b]) => valid(a) && valid(b)).map(([a, b]) => <line key={a + b}
      x1={points[a].x} y1={points[a].y} x2={points[b].x} y2={points[b].y}
      stroke={color} strokeWidth={unit * (active.includes(a) && active.includes(b) ? 5 : 2.5)}
      opacity={active.length && !(active.includes(a) && active.includes(b)) ? .35 : .9} strokeLinecap="round" />)}
    {Object.entries(points).filter(([n]) => valid(n)).map(([name, p]) => <circle key={name}
      cx={p.x} cy={p.y} r={unit * (active.includes(name) ? 5 : 3)} fill={color} stroke="#111716" strokeWidth={unit} />)}
  </svg>;
}
