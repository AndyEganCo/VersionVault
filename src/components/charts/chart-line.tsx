import { Line } from 'recharts';

type ChartLineProps = {
  maxUpdates: number;
};

export function ChartLine({ maxUpdates }: ChartLineProps) {
  // If there's no data, return a flat line at y=0
  const yScale = maxUpdates === 0 ? 1 : maxUpdates;

  return (
    <>
      <defs>
        <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
        </linearGradient>
      </defs>
      <Line
        type="monotone"
        dataKey="updates"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        dot={{
          r: 4,
          fill: "hsl(var(--background))",
          strokeWidth: 2,
        }}
        activeDot={{
          r: 6,
          fill: "hsl(var(--background))",
          strokeWidth: 2,
        }}
        yAxisId={0}
        scale={yScale}
      />
    </>
  );
}