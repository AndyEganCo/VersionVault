export function ChartGradient() {
  return (
    <defs>
      <linearGradient id="colorUpdates" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
      </linearGradient>
    </defs>
  );
}