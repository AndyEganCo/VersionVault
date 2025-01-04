import { Line } from 'recharts';

export function DataLine() {
  return (
    <Line
      type="monotone"
      dataKey="updates"
      stroke="hsl(var(--primary))"
      strokeWidth={2}
      dot={{
        r: 4,
        fill: "hsl(var(--background))",
        stroke: "hsl(var(--primary))",
        strokeWidth: 2
      }}
      activeDot={{
        r: 6,
        fill: "hsl(var(--background))",
        stroke: "hsl(var(--primary))",
        strokeWidth: 2
      }}
      fill="url(#colorUpdates)"
      connectNulls
    />
  );
}