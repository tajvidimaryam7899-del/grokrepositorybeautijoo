'use client';

/**
 * Minimal, dependency-free SVG charts for the admin dashboard.
 * No charting library is added on purpose — these are simple bar
 * sparklines sized for a handful of numeric series over ~30 days.
 */

export type ChartPoint = { label: string; value: number };

function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const rounded = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return rounded * pow;
}

export function MiniBarChart({
  data,
  color = '#2D6CDF',
  height = 96,
  formatValue,
}: {
  data: ChartPoint[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  if (!data.length) return null;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const barWidth = 100 / data.length;
  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {data.map((d, i) => {
          const h = max > 0 ? (d.value / max) * (height - 4) : 0;
          return (
            <rect
              key={i}
              x={i * barWidth + barWidth * 0.15}
              y={height - h}
              width={barWidth * 0.7}
              height={h}
              rx={1}
              fill={color}
              opacity={d.value === 0 ? 0.15 : 0.85}
            >
              <title>
                {d.label}: {formatValue ? formatValue(d.value) : d.value}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-gray/70">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function MiniStackedBarChart({
  data,
  series,
  height = 96,
}: {
  data: { label: string; values: number[] }[];
  series: { key: string; color: string; name: string }[];
  height?: number;
}) {
  if (!data.length) return null;
  const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0));
  const max = niceMax(Math.max(...totals, 0));
  const barWidth = 100 / data.length;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-gray">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {data.map((d, i) => {
          let yOffset = height;
          return (
            <g key={i}>
              {d.values.map((v, si) => {
                const h = max > 0 ? (v / max) * (height - 4) : 0;
                yOffset -= h;
                return (
                  <rect
                    key={si}
                    x={i * barWidth + barWidth * 0.15}
                    y={yOffset}
                    width={barWidth * 0.7}
                    height={h}
                    fill={series[si]?.color}
                    opacity={0.9}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-gray/70">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
