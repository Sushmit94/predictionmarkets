import { formatDate } from "@/lib/format";
import type { PricePoint } from "@/lib/types";

export function PriceChart({ points }: { points: PricePoint[] }) {
  const width = 720;
  const height = 280;
  const padding = 28;
  const safePoints = points.length > 1 ? points : [];

  const path = safePoints
    .map((point, index) => {
      const x = padding + (index / Math.max(safePoints.length - 1, 1)) * (width - padding * 2);
      const y = padding + (1 - point.yesProbability) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <section className="rounded-lg border border-[#dce8dd] bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Price History</h2>
          <p className="text-sm text-[#5a6b60]">YES probability over indexed trades</p>
        </div>
        {safePoints.at(-1) ? <p className="text-sm text-[#5a6b60]">Last {formatDate(safePoints.at(-1)!.timestamp)}</p> : null}
      </div>
      <div className="mt-5 overflow-hidden rounded border border-[#edf2ee] bg-[#fbfdfb]">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="YES price history chart" className="h-72 w-full">
          {[0.25, 0.5, 0.75].map((tick) => (
            <g key={tick}>
              <line
                x1={padding}
                y1={padding + (1 - tick) * (height - padding * 2)}
                x2={width - padding}
                y2={padding + (1 - tick) * (height - padding * 2)}
                stroke="#e5ece6"
                strokeWidth="1"
              />
              <text x="8" y={padding + (1 - tick) * (height - padding * 2) + 4} fill="#657369" fontSize="12">
                {Math.round(tick * 100)}%
              </text>
            </g>
          ))}
          <path d={path} fill="none" stroke="#1a9f5b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          {safePoints.map((point, index) => {
            const x = padding + (index / Math.max(safePoints.length - 1, 1)) * (width - padding * 2);
            const y = padding + (1 - point.yesProbability) * (height - padding * 2);
            return <circle key={point.id} cx={x} cy={y} r="3" fill="#35d07f" />;
          })}
        </svg>
      </div>
    </section>
  );
}
