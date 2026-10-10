/** Lightweight SVG charts — no chart library dependency, SSR-friendly. */

export function LineChart({
  data,
  height = 160,
  label = "trend",
}: {
  data: { date: string; count: number }[];
  height?: number;
  label?: string;
}) {
  if (!data.length) return null;
  const w = 600;
  const h = height;
  const pad = 8;
  const max = Math.max(1, ...data.map((d) => d.count));
  const step = (w - pad * 2) / Math.max(1, data.length - 1);
  const points = data.map((d, i) => {
    const x = pad + i * step;
    const y = h - pad - (d.count / max) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `M${points[0]} L${points.join(" L")} L${w - pad},${h - pad} L${pad},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`${label} chart`}>
      <defs>
        <linearGradient id="lg-brand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f766e" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0f766e" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={pad} x2={w - pad} y1={h * f} y2={h * f} stroke="#e2e8f0" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#lg-brand)" />
      <polyline points={points.join(" ")} fill="none" stroke="#0f766e" strokeWidth="2.5" strokeLinejoin="round" />
      <text x={pad} y={12} fontSize="10" fill="#64748b">
        max {max}/day
      </text>
    </svg>
  );
}

export function BarChart({
  data,
  height = 160,
  valuePrefix = "",
}: {
  data: { label: string; value: number }[];
  height?: number;
  valuePrefix?: string;
}) {
  if (!data.length) return null;
  const w = 600;
  const h = height;
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = (w - 16) / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="bar chart">
      {data.map((d, i) => {
        const bh = Math.max(2, (d.value / max) * (h - 26));
        const x = 8 + i * barW;
        return (
          <g key={d.label}>
            <rect
              x={x + barW * 0.15}
              y={h - 18 - bh}
              width={barW * 0.7}
              height={bh}
              rx="4"
              fill="#0f766e"
              opacity={0.85}
            >
              <title>{`${d.label}: ${valuePrefix}${d.value}`}</title>
            </rect>
            <text
              x={x + barW / 2}
              y={h - 5}
              textAnchor="middle"
              fontSize="9"
              fill="#64748b"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function DonutChart({
  segments,
  size = 140,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label="distribution">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="18" />
        {segments.map((s, i) => {
          const frac = s.value / total;
          const start = segments.slice(0, i).reduce((a, x) => a + x.value / total, 0);
          return (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="18"
              strokeDasharray={`${frac * c} ${c}`}
              strokeDashoffset={-start * c}
              transform="rotate(-90 70 70)"
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          );
        })}
        <text x="70" y="66" textAnchor="middle" fontSize="20" fontWeight="700" fill="#0f172a">
          {total}
        </text>
        <text x="70" y="84" textAnchor="middle" fontSize="9" fill="#64748b">
          total
        </text>
      </svg>
      <ul className="space-y-1.5 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-slate-600">{s.label}</span>
            <span className="ml-auto font-bold text-slate-800">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
