import { YAxis as RechartsYAxis } from 'recharts';

type YAxisProps = {
  maxValue: number;
};

export function YAxis({ maxValue }: YAxisProps) {
  const ticks = Array.from(
    { length: 5 }, 
    (_, i) => Math.round(i * maxValue / 4)
  );

  return (
    <RechartsYAxis
      stroke="hsl(var(--muted-foreground))"
      fontSize={12}
      tickLine={false}
      axisLine={false}
      dx={-10}
      ticks={ticks}
      domain={[0, maxValue]}
      scale="linear"
      padding={{ top: 10, bottom: 10 }}
    />
  );
}