export type ChartDataPoint = {
  date: string;
  updates: number;
};

export type ActivityChartProps = {
  data: ChartDataPoint[];
};