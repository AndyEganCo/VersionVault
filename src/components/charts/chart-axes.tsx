import { XAxis, YAxis } from 'recharts';

const axisStyle = {
  fontSize: 12,
  stroke: "hsl(var(--muted-foreground))",
};

export function ChartAxes() {
  return (
    <>
      <XAxis 
        {...axisStyle}
        dataKey="date"
        tickLine={false}
        axisLine={false}
        dy={10}
      />
      <YAxis
        {...axisStyle}
        tickLine={false}
        axisLine={false}
        dx={-10}
        tickFormatter={(value: number) => `${value}`}
      />
    </>
  );
}